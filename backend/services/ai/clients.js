import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CohereClient } from 'cohere-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
 * Initialize Anthropic client for Claude API
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
