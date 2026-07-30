import api from './api';

// API calls for the conversational voice agent.
//
// Backend contract:
//   POST /api/voice/turn -> { success, data: { say, slots, missing,
//                             readyToSubmit, lifeSafety, handoff } }   (auth)
//
// The conversation is stateless on the server: we round-trip `slots` and
// `history` on every turn, the same way ChatAssistant does. Audio never leaves
// the browser — speech recognition and playback are both local (see
// useSpeechRecognition / useSpeechSynthesis), so this endpoint is text-only.

/**
 * Run one turn of the spoken intake conversation.
 *
 * @param {object} params
 * @param {string} params.message - what the caller just said
 * @param {object} [params.slots] - draft fields from the previous turn
 * @param {Array<{role: string, content: string}>} [params.history] - prior turns
 * @returns {Promise<{say: string, slots: object, missing: string[],
 *   readyToSubmit: boolean, lifeSafety: boolean, handoff: boolean}>}
 */
export const postVoiceTurn = async ({ message, slots = {}, history = [] }) => {
  const { data } = await api.post(
    '/api/voice/turn',
    { message, slots, history },
    // A turn is one LLM round-trip, and a rotated-through provider chain can
    // take a while before it lands on a model with quota left.
    { timeout: 45000 }
  );

  if (!data?.success) {
    throw new Error(data?.message || 'The voice assistant could not respond.');
  }

  return data.data;
};

/**
 * Fetch a short-lived Deepgram streaming token, or null if unavailable.
 *
 * Deepgram is an opt-in accuracy upgrade over the browser's Web Speech API. This
 * returns null — rather than throwing — whenever streaming can't be used (the
 * backend hasn't configured a Deepgram key, so it answers 501, or minting
 * failed), which is the signal for the caller to stay on browser recognition.
 * Only genuine surprises are logged; the "not configured" case is expected.
 *
 * @returns {Promise<{token: string, expiresIn: number}|null>}
 */
export const fetchDeepgramToken = async () => {
  try {
    const { data } = await api.post('/api/voice/token', {}, { timeout: 8000 });
    if (!data?.success || !data?.data?.token) return null;
    return data.data;
  } catch {
    // 501 (not configured), 403, network error — all mean "fall back to Web
    // Speech". The hook handles that transparently, so no need to surface this.
    return null;
  }
};
