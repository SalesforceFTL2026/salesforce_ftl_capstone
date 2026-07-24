import OpenAI from 'openai';
import { gemini } from './clients.js';

// OpenRouter speaks the OpenAI API format, so we reuse the OpenAI SDK but point
// it at OpenRouter's base URL and authenticate with the OpenRouter key in .env.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Gemini model used as the free fallback when OpenRouter is exhausted.
// Configurable via env; "flash-latest" auto-tracks the current flash model so
// we don't 404 when Google retires a specific version. Flash is fast and has a
// generous free daily quota.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// Use Node's native fetch: the OpenAI v4 SDK bundles an older node-fetch that
// fails on gzipped responses under Node 24 ("Gunzip ... Premature close").
// (Native fetch needs duplex:'half' for streamed request bodies; harmless here
// since chat calls send plain JSON, but included to match the shared client.)
const nativeFetch = (url, init = {}) =>
  globalThis.fetch(url, init.body ? { duplex: 'half', ...init } : init);

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  fetch: nativeFetch,
});

// How many free models to try before giving up. Free models share a global
// rate-limit pool, so if one is temporarily rate-limited (429) we fall back to
// the next one that OpenRouter reports as free.
const MAX_MODELS_TO_TRY = 5;

// Model ids that are unsuitable for general chat / structured extraction, even
// though they output text: code models, safety/guard classifiers, vision/audio
// multimodal models, embedding/rerank models. Matched against the model id.
const SPECIALIZED_MODEL =
  /(code|coder|safety|guard|moderation|vision|embed|rerank|tts|stt|asr|whisper|omni|image|audio)/i;

// Cache the discovered free-model list so we only hit the /models endpoint once
// per server run instead of on every chat message.
let cachedFreeModels = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ask OpenRouter which models are currently available for free, and keep only
// the text-generating chat models (skips image/audio-only models). Returns an
// array of model id strings; the result is cached after the first call.
async function getFreeModels() {
  if (cachedFreeModels) return cachedFreeModels;

  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch OpenRouter models (${res.status}).`);
  }

  const { data } = await res.json();

  cachedFreeModels = data
    .filter((m) => {
      // Free = both prompt and completion cost nothing.
      const isFree =
        m.pricing &&
        Number(m.pricing.prompt) === 0 &&
        Number(m.pricing.completion) === 0;
      // Chat = the model can output text (drops image/audio-only models).
      const outputsText = m.architecture?.output_modalities?.includes('text');
      // Drop models that are structurally wrong for general chat / structured
      // extraction: code, safety/guard classifiers, vision/audio, embeddings.
      // These are in the free list but won't follow "reply with JSON" prompts
      // (e.g. a content-safety model returns a label, not request fields), which
      // made extraction fail non-deterministically depending on ordering.
      const isSpecialized = SPECIALIZED_MODEL.test(m.id);
      return isFree && outputsText && !isSpecialized;
    })
    .map((m) => m.id);

  if (cachedFreeModels.length === 0) {
    throw new Error('No free text models are currently available on OpenRouter.');
  }

  return cachedFreeModels;
}

// Ask the chatbot a question and get back its text answer.
// Discovers the currently-free models and tries them in order; if one is rate
// limited (429) — or returns a reply that fails the optional `validate` check —
// it falls back to the next. If OpenRouter is entirely unavailable (e.g. its
// free daily quota is exhausted), it falls back to Gemini's free tier, which
// has a separate quota. Throws only if every option fails.
// @param {string} message - the user's latest question
// @param {object} [options]
// @param {string} [options.systemPrompt] - context/persona given to the model
// @param {Array<{role: string, content: string}>} [options.history] - prior
//   turns of the conversation, oldest first, so replies stay in context
// @param {(reply: string) => boolean} [options.validate] - return false to
//   reject a reply and try the next model (e.g. "must be parseable JSON"). Lets
//   callers that need structured output skip models that reply with prose.
// @returns {Promise<string>} the AI's reply
export async function askLLM(message, { systemPrompt, history = [], validate } = {}) {
  // Assemble the full message list: optional system context, prior turns, then
  // the new question.
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history);
  messages.push({ role: 'user', content: message });

  let lastError;

  // --- Primary: OpenRouter free models ---
  try {
    const freeModels = await getFreeModels();
    const modelsToTry = freeModels.slice(0, MAX_MODELS_TO_TRY);

    for (const model of modelsToTry) {
      try {
        const completion = await client.chat.completions.create({ model, messages });
        const reply = completion.choices[0].message.content;

        // If the caller needs a specific shape (e.g. JSON) and this model didn't
        // produce it, treat it like a failure and fall through to the next model
        // rather than returning something the caller can't use.
        if (validate && !validate(reply)) {
          lastError = new Error(`Model ${model} returned a reply that failed validation`);
          continue;
        }

        return reply;
      } catch (err) {
        lastError = err;

        // Free models are flaky — any of them can time out or return a 4xx/5xx at
        // random. Rather than fail on the first bad model, fall through to the
        // next. For a rate limit (429), honor a short Retry-After hint first so a
        // brief spike can clear on its own.
        if (err.status === 429) {
          const retryAfter = Number(err.headers?.['retry-after']);
          if (Number.isFinite(retryAfter) && retryAfter <= 5) {
            await sleep(retryAfter * 1000);
          }
        }
      }
    }
  } catch (err) {
    // getFreeModels itself failed (e.g. OpenRouter unreachable). Remember it and
    // fall through to the Gemini fallback below.
    lastError = err;
  }

  // --- Fallback: Gemini free tier (separate daily quota from OpenRouter) ---
  if (gemini) {
    try {
      const reply = await askGemini(messages);
      if (!validate || validate(reply)) {
        return reply;
      }
      lastError = new Error('Gemini fallback returned a reply that failed validation');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

// Send the assembled OpenAI-style message list to Gemini and return its text.
// Gemini has no "system" role, so we fold any system message into the prompt.
// @param {Array<{role: string, content: string}>} messages
// @returns {Promise<string>}
async function askGemini(messages) {
  const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt = messages
    .map((m) => (m.role === 'system' ? m.content : `${m.role}: ${m.content}`))
    .join('\n\n');
  const result = await model.generateContent(prompt);
  return result.response.text();
}
