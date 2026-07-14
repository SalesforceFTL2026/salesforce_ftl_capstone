import express from 'express';
import * as requestController from '../controllers/requestController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Help Request Routes
 * Base path: /api/requests
 */

// Create a new help request
// POST /api/requests
router.post('/', requestController.createRequest);

// Get all requests
// GET /api/requests
router.get('/', requestController.getAllRequests);

// Get prioritized requests (sorted by AI priority score)
// GET /api/requests/prioritized
router.get('/prioritized', requestController.getPrioritizedRequests);

// Get single request by ID
// GET /api/requests/:id
router.get('/:id', requestController.getRequestById);

// Express interest in a request (volunteer "I can help with this")
// POST /api/requests/:id/interact
router.post('/:id/interact', requireAuth, requestController.interactWithRequest);

// Update request status
// PATCH /api/requests/:id/status
router.patch('/:id/status', requestController.updateRequestStatus);

// Delete request
// DELETE /api/requests/:id
router.delete('/:id', requestController.deleteRequest);

export default router;
