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

// --- Allocations: assigning resources to help requests ---
// (declared before the /:id routes so the static "requests"/"allocations"
// prefixes aren't captured as a resource id)

// AI-suggested allocations for a request
// GET /api/resources/requests/:requestId/suggestions
router.get(
  '/requests/:requestId/suggestions',
  requireAuth,
  resourceController.getAllocationSuggestions
);

// List resources allocated to a request
// GET /api/resources/requests/:requestId/allocations
router.get(
  '/requests/:requestId/allocations',
  requireAuth,
  resourceController.getRequestAllocations
);

// Allocate a resource to a request
// POST /api/resources/requests/:requestId/allocations
router.post(
  '/requests/:requestId/allocations',
  requireAuth,
  resourceController.allocateResource
);

// Remove an allocation (returns the quantity to the resource)
// DELETE /api/resources/allocations/:id
router.delete(
  '/allocations/:id',
  requireAuth,
  resourceController.deallocateResource
);

// Toggle a resource's availability
// PATCH /api/resources/:id
router.patch('/:id', requireAuth, resourceController.updateResourceAvailability);

// Remove a resource
// DELETE /api/resources/:id
router.delete('/:id', requireAuth, resourceController.deleteResource);

export default router;
