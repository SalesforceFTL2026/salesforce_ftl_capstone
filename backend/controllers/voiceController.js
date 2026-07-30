import { runVoiceTurn, missingSlots } from '../services/ai/voiceAgent.js';
import * as requestModel from '../models/requestModel.js';

/**
 * Voice Controller
 *
 * One endpoint, one conversational turn. Deliberately does NOT create the help
 * request itself: when the agent reports readyToSubmit, the client posts the
 * collected fields to POST /api/requests like every other intake path, so
 * validation, scoring, and prioritization stay in exactly one place.
 *
 * Audio never reaches this server — the browser does speech-to-text and
 * text-to-speech via the Web Speech API, so this is plain JSON in / JSON out
 * (and therefore curl-testable without a microphone).
 */

// Cap on conversation turns we accept from the client, mirroring chatController.
// Bounds both the model's context and how much a single caller can spend of a
// scarce daily request quota.
const MAX_HISTORY_TURNS = 24;
const VALID_ROLES = new Set(['user', 'assistant']);

// Slot keys we accept back from the client. The client echoes the slots we gave
// it on the previous turn; allowlisting them stops a caller from injecting
// arbitrary fields into the request draft.
const ALLOWED_SLOTS = ['category', 'urgency', 'location', 'description', 'householdSize'];

/**
 * POST /api/voice/turn
 *
 * Body: {
 *   message: string,                       // what the caller just said
 *   slots?: object,                        // draft from the previous turn
 *   history?: [{ role, content }]          // prior turns, oldest first
 * }
 *
 * Replies with { say, slots, missing, readyToSubmit, lifeSafety, handoff }.
 * The conversation is stateless server-side: the client round-trips slots and
 * history, same as the existing chat assistant.
 */
export const voiceTurn = async (req, res) => {
  try {
    // Voice intake is primarily for help-seekers. We also allow the seeded
    // admin account so demo mode can exercise the full help-seeker flow.
    if (!['help-seeker', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Voice intake is only available to help-seekers.',
      });
    }

    const { message, slots, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please include what the caller said.',
      });
    }

    const safeSlots = sanitizeSlots(slots);
    const safeHistory = sanitizeHistory(history);

    // Ground the agent in the caller's existing requests so it can answer
    // status questions without inventing anything.
    const requests = await requestModel.getRequestsByUser(req.user.id);

    const result = await runVoiceTurn({
      user: req.user,
      requests,
      slots: safeSlots,
      history: safeHistory,
      message: message.trim(),
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in voice turn:', error);

    // Every free provider failing is the expected failure here, not an outage.
    // Hand back the draft so the client can drop the caller into the manual form
    // with their answers preserved instead of losing the conversation.
    return res.status(503).json({
      success: false,
      message:
        'The voice assistant is unavailable right now. Your answers are saved — ' +
        'please finish the request on the form.',
      data: {
        slots: sanitizeSlots(req.body?.slots),
        missing: missingSlots(sanitizeSlots(req.body?.slots)),
        handoff: true,
      },
      error: error.message,
    });
  }
};

/**
 * Keep only the slot keys the agent owns, so the client can't smuggle extra
 * fields into the draft it will later submit.
 *
 * @param {any} slots
 * @returns {Object}
 */
function sanitizeSlots(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return {};

  const clean = {};
  for (const key of ALLOWED_SLOTS) {
    const value = slots[key];
    if (value === null || value === undefined || value === '') continue;
    clean[key] = key === 'householdSize' ? Number(value) : String(value);
  }
  return clean;
}

/**
 * Drop malformed turns and cap the length, mirroring chatController's handling.
 *
 * @param {any} history
 * @returns {Array<{role: string, content: string}>}
 */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (m) =>
        m &&
        VALID_ROLES.has(m.role) &&
        typeof m.content === 'string' &&
        m.content.trim() !== ''
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));
}

export default { voiceTurn };
