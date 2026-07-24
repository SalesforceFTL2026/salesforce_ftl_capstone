import express from 'express';
import * as organizationController from '../controllers/organizationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Organization Routes
 * Base path: /api/organizations
 *
 * Read-only public listing of participating organizations, shown to
 * help-seekers on their dashboard.
 */

// List participating organizations
// GET /api/organizations
router.get('/', requireAuth, organizationController.listOrganizations);

export default router;
