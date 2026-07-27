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
 * Note: no upload middleware here, unlike POST /api/requests/voice. Speech
 * recognition happens in the browser, so these routes exchange text only.
 */

// Run one turn of the spoken intake conversation.
// POST /api/voice/turn
router.post('/turn', requireAuth, voiceController.voiceTurn);

export default router;
