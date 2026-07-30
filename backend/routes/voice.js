import express from 'express';
import * as voiceController from '../controllers/voiceController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Voice Agent Routes
 * Base path: /api/voice
 *
 * All routes require authentication.
 *
 * Note: no upload middleware here, unlike POST /api/requests/voice. Even with
 * Deepgram streaming, audio goes browser -> Deepgram directly; these routes
 * exchange only text (a turn) and a short-lived streaming token.
 */

// Run one turn of the spoken intake conversation.
// POST /api/voice/turn
router.post('/turn', requireAuth, voiceController.voiceTurn);

// Mint a short-lived Deepgram token for browser-side streaming STT. Returns 501
// when Deepgram isn't configured, so the client falls back to Web Speech.
// POST /api/voice/token
router.post('/token', requireAuth, voiceController.voiceToken);

export default router;
