import express from 'express';
import * as requestController from '../controllers/requestController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Help Request Routes
 * Base path: /api/requests
 */

// Create a new help request (must be logged in)
// POST /api/requests
router.post('/', requireAuth, requestController.createRequest);

// Get all requests (must be logged in)
// GET /api/requests
router.get('/', requireAuth, requestController.getAllRequests);

// Get prioritized requests (sorted by AI priority score) (must be logged in)
// GET /api/requests/prioritized
router.get('/prioritized', requireAuth, requestController.getPrioritizedRequests);

// Get the logged-in user's own requests (protected)
// GET /api/requests/my-requests  (must come before /:id so it isn't treated as an id)
router.get('/my-requests', requireAuth, requestController.getMyRequests);

// Get distance (miles) from an origin to each active request (must be logged in)
// GET /api/requests/distances?origin=<location>  (before /:id so it isn't an id)
router.get('/distances', requireAuth, requestController.getRequestDistances);

// Get single request by ID (must be logged in)
// GET /api/requests/:id
router.get('/:id', requireAuth, requestController.getRequestById);

// Express interest in a request (volunteer "I can help with this")
// POST /api/requests/:id/interact
router.post('/:id/interact', requireAuth, requestController.interactWithRequest);

// Categorize / add detail to a request (organizations only)
// PATCH /api/requests/:id
router.patch('/:id', requireAuth, requestController.updateRequestDetails);

// Update request status (orgs, or the help-seeker who owns the request)
// PATCH /api/requests/:id/status
router.patch('/:id/status', requireAuth, requestController.updateRequestStatus);

// Delete request (orgs, or the help-seeker who owns the request)
// DELETE /api/requests/:id
router.delete('/:id', requireAuth, requestController.deleteRequest);

export default router;
