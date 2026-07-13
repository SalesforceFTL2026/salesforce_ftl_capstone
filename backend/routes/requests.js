import express from 'express';
import * as requestController from '../controllers/requestController.js';
import { requireAuth, attachUserIfPresent } from '../middleware/auth.js';

const router = express.Router();

/**
 * Help Request Routes
 * Base path: /api/requests
 */

// Create a new help request (attaches userId if the user is logged in)
// POST /api/requests
router.post('/', attachUserIfPresent, requestController.createRequest);

// Get all requests
// GET /api/requests
router.get('/', requestController.getAllRequests);

// Get prioritized requests (sorted by AI priority score)
// GET /api/requests/prioritized
router.get('/prioritized', requestController.getPrioritizedRequests);

// Get the logged-in user's own requests (protected)
// GET /api/requests/my-requests  (must come before /:id so it isn't treated as an id)
router.get('/my-requests', requireAuth, requestController.getMyRequests);

// Get single request by ID
// GET /api/requests/:id
router.get('/:id', requestController.getRequestById);

// Update request status
// PATCH /api/requests/:id/status
router.patch('/:id/status', requestController.updateRequestStatus);

// Delete request
// DELETE /api/requests/:id
router.delete('/:id', requestController.deleteRequest);

export default router;
