import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CohereClient } from 'cohere-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient as createDeepgramClient } from '@deepgram/sdk';

/**
 * Initialize OpenAI client for embeddings and Whisper transcription.
 *
 * We override the SDK's bundled fetch with Node's native fetch: the v4 SDK
 * ships an older node-fetch that fails on gzipped responses under Node 24
 * ("Gunzip ... Premature close"). Native fetch handles them correctly, but it
 * requires `duplex: 'half'` when the request has a streamed body (as Whisper's
 * multipart upload does), so we inject that here.
 */
const nativeFetch = (url, init = {}) =>
  globalThis.fetch(url, init.body ? { duplex: 'half', ...init } : init);

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: nativeFetch,
});

/**
 * Initialize Anthropic client for Claude API.
 *
 * LOCAL TESTING ONLY: Anthropic is never used in production. It is enabled only
 * outside production AND when a key is present, so it can serve as the preferred
 * provider during local development/testing. In production this is null and the
 * AI text chain (askLLM) falls back to OpenRouter -> Gemini -> OpenAI. Keeping
 * the gate here makes `anthropic` a single source of truth callers can null-check.
 */
export const anthropic =
  process.env.NODE_ENV !== 'production' && process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

/**
 * Initialize Cohere client for embeddings (free tier available)
 */
export const cohere = process.env.COHERE_API_KEY
  ? new CohereClient({ token: process.env.COHERE_API_KEY })
  : null;

/**
 * Initialize Google Gemini client. Used as a free fallback for chat/extraction
 * when OpenRouter's free tier is rate-limited — Gemini's free tier is a
 * separate daily quota, so the two rarely run dry at the same time. Null when
 * no key is configured, so callers can detect and skip the fallback.
 */
export const gemini = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

/**
 * Initialize Deepgram client for real-time speech-to-text in the voice agent.
 *
 * Optional and opt-in: the conversational voice call defaults to the browser's
 * free Web Speech API (see frontend useSpeechRecognition). Deepgram is a paid,
 * higher-accuracy upgrade for accents and background noise — the disaster-relief
 * caller profile — so it only turns on when a key is configured. When null, the
 * token endpoint returns "not configured" and the frontend stays on Web Speech,
 * keeping the zero-cost story intact.
 *
 * The browser streams mic audio straight to Deepgram over a WebSocket, so this
 * server-side client exists only to mint the short-lived scoped tokens that
 * authorize those connections — the API key itself never reaches the browser.
 */
export const deepgram = process.env.DEEPGRAM_API_KEY
  ? createDeepgramClient(process.env.DEEPGRAM_API_KEY)
  : null;
