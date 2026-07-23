import express from 'express';
import * as chatController from '../controllers/chatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Chat Routes
 * Base path: /api/chat
 *
 * All routes require authentication.
 */

// Send a message to the help-seeker AI assistant.
// POST /api/chat
router.post('/', requireAuth, chatController.chat);

export default router;
