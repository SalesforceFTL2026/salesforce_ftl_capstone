import * as taskModel from '../models/volunteerTaskModel.js';
import * as resourceModel from '../models/resourceModel.js';
import { getRequestById } from '../models/requestModel.js';
import { suggestTaskDates } from '../services/ai/taskDateAdvisor.js';
import { suggestTasksForRequest } from '../services/ai/taskSuggestionAdvisor.js';

/**
 * Volunteer Task Controller
 * Lets an organization post help tasks for volunteers to sign up for, set the
 * min/max number of volunteers, mark resources ready, schedule a volunteer day,
 * and move a task to in-progress once it's fulfillable.
 *
 * All endpoints are organization-only and scoped to the caller's own
 * Organization profile, mirroring the resource controller.
 */

// Valid categories/urgencies, kept in sync with the request model's vocabulary.
const CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'];
// The statuses an org can set by hand. "in-progress" is gated on readiness;
// tasks also reach it automatically via the model's auto-progression.
const SETTABLE_STATUSES = ['open', 'in-progress', 'completed', 'cancelled'];

// Guard: only organizations may use these endpoints.
const ensureOrg = (req, res) => {
  if (req.user.role !== 'organization') {
    res.status(403).json({
      success: false,
      message: 'Only organizations can manage volunteer tasks.',
    });
    return false;
  }
  return true;
};

// GET /api/volunteer-tasks
// List the signed-in organization's volunteer tasks (auto-progression applied).
export const getMyTasks = async (req, res) => {
  try {
    if (!ensureOrg(req, res)) return;

    const org = await taskModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    const tasks = await taskModel.getTasksByOrg(org.id);

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching volunteer tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteer tasks',
      error: error.message,
    });
  }
};

// POST /api/volunteer-tasks
// Create a volunteer task. Every task must be attributed to an existing help
// request. Body: { requestId, title, description, category?, urgency?,
// skillsNeeded?, minVolunteers?, maxVolunteers?, volunteerDate? }.
export const createTask = async (req, res) => {
  try {
    if (!ensureOrg(req, res)) return;

    // A task must reference a real help request.
    const { requestId } = req.body;
    if (typeof requestId !== 'string' || requestId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A task must be linked to a help request (requestId).',
      });
    }
    const request = await getRequestById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'The help request this task links to was not found.',
      });
    }

    const parsed = parseTaskBody(req.body, { requireCore: true });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const org = await taskModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    const task = await taskModel.createTask({
      organizationId: org.id,
      requestId,
      ...parsed.data,
    });

    res.status(201).json({
      success: true,
      message: 'Volunteer task created.',
      data: task,
    });
  } catch (error) {
    console.error('Error creating volunteer task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create volunteer task',
      error: error.message,
    });
  }
};

// PATCH /api/volunteer-tasks/:id
// Update mutable fields of a task (details, volunteer count, resourcesReady,
// volunteerDate, status). Enforces the min-volunteers + resources gate before
// allowing a manual move to in-progress.
export const updateTask = async (req, res) => {
  try {
    if (!ensureOrg(req, res)) return;

    const existing = await loadOwnedTask(req, res);
    if (!existing) return;

    const parsed = parseTaskBody(req.body, { requireCore: false });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    // Compute the effective state after the update, to validate the status gate.
    const next = { ...existing, ...parsed.data };
    if (
      parsed.data.status === 'in-progress' &&
      existing.status !== 'in-progress' &&
      !taskModel.isFulfillable(next)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'This task can only move to in-progress once the minimum number of volunteers is confirmed and the necessary resources are ready.',
      });
    }

    const updated = await taskModel.updateTask(existing.id, parsed.data);

    res.status(200).json({
      success: true,
      message: 'Volunteer task updated.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating volunteer task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update volunteer task',
      error: error.message,
    });
  }
};

// DELETE /api/volunteer-tasks/:id
// Remove a task from the organization's board.
export const deleteTask = async (req, res) => {
  try {
    if (!ensureOrg(req, res)) return;

    const existing = await loadOwnedTask(req, res);
    if (!existing) return;

    await taskModel.deleteTask(existing.id);

    res.status(200).json({ success: true, message: 'Volunteer task removed.' });
  } catch (error) {
    console.error('Error deleting volunteer task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete volunteer task',
      error: error.message,
    });
  }
};

// GET /api/volunteer-tasks/:id/date-suggestions
// Ask the AI advisor for 2-3 candidate volunteer-day dates for the task,
// considering priority, readiness, resources, and skills.
export const getDateSuggestions = async (req, res) => {
  try {
    if (!ensureOrg(req, res)) return;

    const task = await loadOwnedTask(req, res);
    if (!task) return;

    const org = await taskModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    const available = await resourceModel.getAvailableResourcesByOrg(org.id);

    const suggestions = await suggestTaskDates(task, {
      availableResourceCount: available.length,
      // Skills coverage isn't tracked org-wide yet; pass what we know (none).
      availableSkills: [],
    });

    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error generating date suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate date suggestions',
      error: error.message,
    });
  }
};

// GET /api/volunteer-tasks/suggestions?requestId=...
// Ask the AI advisor for 2-3 candidate volunteer tasks that would help fulfill
// the given help request. Returns ready-to-edit task drafts; does NOT create
// anything — the org reviews and posts what it wants.
export const getTaskSuggestions = async (req, res) => {
  try {
    if (!ensureOrg(req, res)) return;

    const { requestId } = req.query;
    if (typeof requestId !== 'string' || requestId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Provide a requestId to suggest tasks for.',
      });
    }

    const request = await getRequestById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Help request not found.',
      });
    }

    const suggestions = await suggestTasksForRequest(request);

    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error generating task suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate task suggestions',
      error: error.message,
    });
  }
};

// --- helpers ---

// Load the task named by :id and confirm it belongs to the caller's org.
// Sends the 404 response itself and returns null when not found/owned.
async function loadOwnedTask(req, res) {
  const { id } = req.params;
  const task = await taskModel.getTaskById(id);
  const org = await taskModel.getOrCreateOrgProfile(req.user.id, req.user.name);
  if (!task || task.organizationId !== org.id) {
    res.status(404).json({ success: false, message: 'Volunteer task not found.' });
    return null;
  }
  return task;
}

// Validate and normalize the task fields from a request body. Only fields that
// are present are included in `data`, so PATCH can send partial updates.
// Returns { data } or { error }.
function parseTaskBody(body, { requireCore }) {
  const data = {};

  // title / description — required on create.
  if (requireCore || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return { error: 'A task title is required.' };
    }
    data.title = body.title.trim();
  }
  if (requireCore || body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.trim() === '') {
      return { error: 'A task description is required.' };
    }
    data.description = body.description.trim();
  }

  if (body.category !== undefined) {
    if (body.category !== null && !CATEGORIES.includes(body.category)) {
      return { error: `Category must be one of: ${CATEGORIES.join(', ')}.` };
    }
    data.category = body.category;
  }

  if (body.urgency !== undefined) {
    if (!URGENCIES.includes(body.urgency)) {
      return { error: `Urgency must be one of: ${URGENCIES.join(', ')}.` };
    }
    data.urgency = body.urgency;
  }

  if (body.skillsNeeded !== undefined) {
    if (!Array.isArray(body.skillsNeeded)) {
      return { error: 'skillsNeeded must be an array of skill names.' };
    }
    const skills = body.skillsNeeded
      .filter((s) => typeof s === 'string' && s.trim() !== '')
      .map((s) => s.trim());
    data.skillsNeeded = JSON.stringify(skills);
  }

  // minVolunteers / maxVolunteers — whole numbers; max (if set) must be >= min.
  if (body.minVolunteers !== undefined) {
    const min = Number(body.minVolunteers);
    if (!Number.isInteger(min) || min < 1) {
      return { error: 'Minimum volunteers must be a whole number of 1 or more.' };
    }
    data.minVolunteers = min;
  }
  if (body.maxVolunteers !== undefined) {
    if (body.maxVolunteers === null || body.maxVolunteers === '') {
      data.maxVolunteers = null;
    } else {
      const max = Number(body.maxVolunteers);
      if (!Number.isInteger(max) || max < 1) {
        return { error: 'Maximum volunteers must be a whole number of 1 or more.' };
      }
      data.maxVolunteers = max;
    }
  }
  // Cross-check min vs. max using the effective values from this body.
  if (
    data.maxVolunteers != null &&
    data.minVolunteers != null &&
    data.maxVolunteers < data.minVolunteers
  ) {
    return { error: 'Maximum volunteers cannot be less than the minimum.' };
  }

  if (body.volunteersConfirmed !== undefined) {
    const confirmed = Number(body.volunteersConfirmed);
    if (!Number.isInteger(confirmed) || confirmed < 0) {
      return { error: 'Confirmed volunteers must be a whole number of 0 or more.' };
    }
    data.volunteersConfirmed = confirmed;
  }

  if (body.resourcesReady !== undefined) {
    if (typeof body.resourcesReady !== 'boolean') {
      return { error: 'Provide `resourcesReady` as true or false.' };
    }
    data.resourcesReady = body.resourcesReady;
  }

  if (body.volunteerDate !== undefined) {
    if (body.volunteerDate === null || body.volunteerDate === '') {
      data.volunteerDate = null;
    } else {
      const date = new Date(body.volunteerDate);
      if (Number.isNaN(date.getTime())) {
        return { error: 'volunteerDate must be a valid date.' };
      }
      data.volunteerDate = date;
    }
  }

  if (body.status !== undefined) {
    if (!SETTABLE_STATUSES.includes(body.status)) {
      return { error: `Status must be one of: ${SETTABLE_STATUSES.join(', ')}.` };
    }
    data.status = body.status;
  }

  return { data };
}

export default {
  getMyTasks,
  createTask,
  updateTask,
  deleteTask,
  getDateSuggestions,
  getTaskSuggestions,
};
