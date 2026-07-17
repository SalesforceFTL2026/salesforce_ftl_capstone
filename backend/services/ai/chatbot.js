import OpenAI from 'openai';

// OpenRouter speaks the OpenAI API format, so we reuse the OpenAI SDK but point
// it at OpenRouter's base URL and authenticate with the OpenRouter key in .env.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
});

// How many free models to try before giving up. Free models share a global
// rate-limit pool, so if one is temporarily rate-limited (429) we fall back to
// the next one that OpenRouter reports as free.
const MAX_MODELS_TO_TRY = 5;

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
      return isFree && outputsText;
    })
    .map((m) => m.id);

  if (cachedFreeModels.length === 0) {
    throw new Error('No free text models are currently available on OpenRouter.');
  }

  return cachedFreeModels;
}

// Ask the chatbot a question and get back its text answer.
// Discovers the currently-free models and tries them in order; if one is rate
// limited (429), it falls back to the next. Throws only if all attempts fail.
// @param {string} message - the user's latest question
// @param {object} [options]
// @param {string} [options.systemPrompt] - context/persona given to the model
// @param {Array<{role: string, content: string}>} [options.history] - prior
//   turns of the conversation, oldest first, so replies stay in context
// @returns {Promise<string>} the AI's reply
export async function askChatbot(message, { systemPrompt, history = [] } = {}) {
  const freeModels = await getFreeModels();
  const modelsToTry = freeModels.slice(0, MAX_MODELS_TO_TRY);

  // Assemble the full message list: optional system context, prior turns, then
  // the new question.
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history);
  messages.push({ role: 'user', content: message });

  let lastError;

  for (const model of modelsToTry) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages,
      });
      return completion.choices[0].message.content;
    } catch (err) {
      lastError = err;

      // Only a 429 (rate limit) is worth falling back on; anything else (bad
      // key, bad request) should surface immediately so we don't hide real bugs.
      if (err.status !== 429) throw err;

      // Honor the server's Retry-After hint (short waits only) before the next
      // model, so a brief spike can clear on its own.
      const retryAfter = Number(err.headers?.['retry-after']);
      if (Number.isFinite(retryAfter) && retryAfter <= 5) {
        await sleep(retryAfter * 1000);
      }
    }
  }

  throw lastError;
}
