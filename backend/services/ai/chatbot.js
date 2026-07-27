import OpenAI from 'openai';
import { gemini, anthropic, openai } from './clients.js';

// OpenRouter speaks the OpenAI API format, so we reuse the OpenAI SDK but point
// it at OpenRouter's base URL and authenticate with the OpenRouter key in .env.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Gemini model used as the free fallback when OpenRouter is exhausted.
// Configurable via env; "flash-latest" auto-tracks the current flash model so
// we don't 404 when Google retires a specific version.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// Gemini's free tier meters requests PER MODEL, not per project: each Flash
// model carries its own ~20 requests/day and 5-10 requests/minute allowance.
// Pointing every call at one model (as GEMINI_MODEL alone did) caps us at ~20
// free requests/day and wastes the identical allowance sitting on every sibling
// model. Rotating multiplies the free budget, which is what makes a per-turn
// voice agent affordable at all.
//
// Ordered cheapest-capability-first so the weakest model absorbs the easy calls
// and the stronger ones stay in reserve. Override with a comma-separated env
// list as Google's lineup changes (retired ids are skipped automatically —
// a 404 just falls through to the next entry).
const GEMINI_MODEL_CHAIN = (
  process.env.GEMINI_MODEL_CHAIN ||
  `gemini-2.5-flash-lite,gemini-2.5-flash,${GEMINI_MODEL}`
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

// Models we've seen return 429 (per-model daily quota gone). Skipped for the
// rest of the process so we don't spend a round-trip rediscovering the same
// exhaustion on every call. Deliberately not persisted: Google's quotas reset at
// midnight Pacific, and a restart is a cheap enough excuse to re-probe.
const exhaustedGeminiModels = new Set();

// Whether askLLM may fall through to the PAID OpenAI chat model. Off by default
// so no code path — including a runaway retry loop — can spend real credits
// without an explicit opt-in. Set ALLOW_PAID_FALLBACK=true to buy availability
// once the free tiers are dry.
const ALLOW_PAID_FALLBACK = process.env.ALLOW_PAID_FALLBACK === 'true';

// Claude model used only for LOCAL testing — the `anthropic` client is null in
// production (see clients.js), so this branch never runs there.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// OpenAI chat model used as the final paid fallback when OpenRouter and Gemini
// are both unavailable. Configurable via env; kept cheap by default.
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

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
//
// Provider chain (each falls through to the next on error or failed `validate`):
//   0. Anthropic Claude — LOCAL TESTING ONLY. `anthropic` is null in production
//      (see clients.js), so this step is skipped there entirely.
//   1. OpenRouter free models — discovers the currently-free models and tries
//      them in order; a rate-limited (429) or invalid reply falls through.
//   2. Gemini free tier — separate daily quota from OpenRouter.
//   3. OpenAI chat — final paid fallback so the feature still works if the free
//      tiers are exhausted.
// Throws only if every available option fails.
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

  // --- Local-only preferred provider: Anthropic Claude ---
  // Null in production (clients.js), so this is skipped on the deployed server.
  if (anthropic) {
    try {
      const reply = await askAnthropic(messages);
      if (!validate || validate(reply)) {
        return reply;
      }
      lastError = new Error('Anthropic reply failed validation');
    } catch (err) {
      lastError = err;
    }
  }

  // --- Primary: Gemini free tier, rotated across models ---
  // Ahead of OpenRouter because Gemini's per-model metering gives us a larger
  // combined free budget (~20 req/day/model across several models) and Flash is
  // markedly more reliable at "reply with only JSON" than the average free
  // OpenRouter model, which matters for every structured caller we have.
  if (gemini) {
    for (const model of GEMINI_MODEL_CHAIN) {
      if (exhaustedGeminiModels.has(model)) continue;

      try {
        const reply = await askGemini(messages, model);
        if (!validate || validate(reply)) {
          return reply;
        }
        lastError = new Error(`Gemini ${model} returned a reply that failed validation`);
      } catch (err) {
        lastError = err;

        // 429 = this model's daily/minute quota is gone. Remember it so the rest
        // of this process skips straight past it. The SDK surfaces the status on
        // `status`, but older versions only put it in the message, so check both.
        if (err.status === 429 || /429|quota|rate limit/i.test(err.message || '')) {
          exhaustedGeminiModels.add(model);
        }
      }
    }
  }

  // --- Fallback: OpenRouter free models ---
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

  // --- Final fallback: OpenAI chat (PAID, opt-in) ---
  // Gated so exhausting the free tiers fails loudly instead of quietly billing
  // us. Callers already surface a "try again in a moment" message on throw.
  if (ALLOW_PAID_FALLBACK) {
    try {
      const reply = await askOpenAI(messages);
      if (!validate || validate(reply)) {
        return reply;
      }
      lastError = new Error('OpenAI fallback returned a reply that failed validation');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

// Send the assembled OpenAI-style message list to Anthropic and return its text.
// Anthropic wants the system prompt as a top-level param, not a message role, so
// we split it out and pass the rest as user/assistant turns.
// @param {Array<{role: string, content: string}>} messages
// @returns {Promise<string>}
async function askAnthropic(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    ...(system ? { system } : {}),
    messages: rest,
  });
  return response.content[0].text;
}

// Send the assembled message list to OpenAI's chat API and return its text.
// @param {Array<{role: string, content: string}>} messages
// @returns {Promise<string>}
async function askOpenAI(messages) {
  const completion = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages,
  });
  return completion.choices[0].message.content;
}

// Send the assembled OpenAI-style message list to Gemini and return its text.
// Gemini has no "system" role, so we fold any system message into the prompt.
// @param {Array<{role: string, content: string}>} messages
// @param {string} [modelName] - which Gemini model to spend quota on; defaults
//   to GEMINI_MODEL so direct callers keep the previous behaviour.
// @returns {Promise<string>}
async function askGemini(messages, modelName = GEMINI_MODEL) {
  const model = gemini.getGenerativeModel({ model: modelName });
  const prompt = messages
    .map((m) => (m.role === 'system' ? m.content : `${m.role}: ${m.content}`))
    .join('\n\n');
  const result = await model.generateContent(prompt);
  return result.response.text();
}
