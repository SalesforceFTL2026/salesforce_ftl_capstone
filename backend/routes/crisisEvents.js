import express from 'express';
import * as crisisEventController from '../controllers/crisisEventController.js';

const router = express.Router();

/**
 * Crisis Event Routes
 * Base path: /api/crisis-events
 *
 * Public (no requireAuth): these are ingested real-world disaster events with
 * no user data, intended for a map overlay that can appear pre-login. If you'd
 * rather gate them, add requireAuth like the /api/requests routes do.
 */

// List crisis events for the map overlay
// GET /api/crisis-events?source=&includeStale=&limit=
router.get('/', crisisEventController.getCrisisEvents);

export default router;
