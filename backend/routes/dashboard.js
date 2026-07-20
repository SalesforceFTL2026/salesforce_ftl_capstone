import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Dashboard Routes
 * Base path: /api/dashboard
 *
 * All routes require authentication
 */

// Get volunteer's interested requests
// GET /api/dashboard/volunteer
router.get('/volunteer', requireAuth, dashboardController.getVolunteerDashboard);

// Get the volunteer's profile skills (for the dashboard's skillset metric)
// GET /api/dashboard/volunteer/profile
router.get('/volunteer/profile', requireAuth, dashboardController.getVolunteerProfile);

// Get organization's active responses
// GET /api/dashboard/organization
router.get('/organization', requireAuth, dashboardController.getOrganizationDashboard);

// Get help-seeker's submitted requests
// GET /api/dashboard/help-seeker
router.get('/help-seeker', requireAuth, dashboardController.getHelpSeekerDashboard);

export default router;
