import express from 'express';
import * as volunteerTaskController from '../controllers/volunteerTaskController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Volunteer Task Routes
 * Base path: /api/volunteer-tasks
 *
 * All routes require authentication and are organization-only (enforced in the
 * controller). These are the help tasks an org posts for volunteers to sign up
 * for. The volunteer-facing side isn't built yet.
 */

// List the signed-in organization's volunteer tasks
// GET /api/volunteer-tasks
router.get('/', requireAuth, volunteerTaskController.getMyTasks);

// Create a volunteer task
// POST /api/volunteer-tasks
router.post('/', requireAuth, volunteerTaskController.createTask);

// AI-suggested volunteer tasks for a help request
// (static path declared before /:id so it isn't captured as an id)
// GET /api/volunteer-tasks/suggestions?requestId=...
router.get(
  '/suggestions',
  requireAuth,
  volunteerTaskController.getTaskSuggestions
);

// AI-suggested volunteer-day dates for a task
// (declared before /:id so "date-suggestions" isn't captured as an id)
// GET /api/volunteer-tasks/:id/date-suggestions
router.get(
  '/:id/date-suggestions',
  requireAuth,
  volunteerTaskController.getDateSuggestions
);

// Update a task (details, volunteer count, resourcesReady, date, status)
// PATCH /api/volunteer-tasks/:id
router.patch('/:id', requireAuth, volunteerTaskController.updateTask);

// Remove a task
// DELETE /api/volunteer-tasks/:id
router.delete('/:id', requireAuth, volunteerTaskController.deleteTask);

export default router;
