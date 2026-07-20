import express from 'express';
import * as resourceController from '../controllers/resourceController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Resource Routes
 * Base path: /api/resources
 *
 * All routes require authentication and are organization-only (enforced in
 * the controller). Resources are the things an org has available to give out.
 */

// List the signed-in organization's resources
// GET /api/resources
router.get('/', requireAuth, resourceController.getMyResources);

// Add a resource to the organization's inventory
// POST /api/resources
router.post('/', requireAuth, resourceController.createResource);

// Toggle a resource's availability
// PATCH /api/resources/:id
router.patch('/:id', requireAuth, resourceController.updateResourceAvailability);

// Remove a resource
// DELETE /api/resources/:id
router.delete('/:id', requireAuth, resourceController.deleteResource);

export default router;
