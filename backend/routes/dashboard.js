import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * Dashboard Routes
 * Base path: /api/dashboard  (set in server.js)
 */

// Organization dashboard: active requests overview + this org's responses.
// Protected: must be logged in AND have the "organization" role.
// GET /api/dashboard/organization
router.get(
  '/organization',
  requireAuth,
  requireRole('organization'),
  dashboardController.getOrganizationDashboard
);

export default router;
