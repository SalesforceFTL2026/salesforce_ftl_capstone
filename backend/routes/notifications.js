import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Notification Routes
 * Base path: /api/notifications
 * All routes require a logged-in user; each is scoped to that user.
 */

// List the signed-in user's notifications + unread count
// GET /api/notifications
router.get('/', requireAuth, notificationController.getMyNotifications);

// Just the unread count (cheap, for badge polling)
// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, notificationController.getUnreadCount);

// Mark all unread notifications read
// PATCH /api/notifications/read-all  (before /:id/read so it isn't treated as an id)
router.patch('/read-all', requireAuth, notificationController.markAllRead);

// Mark a single notification read
// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, notificationController.markRead);

export default router;
