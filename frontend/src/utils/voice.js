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
