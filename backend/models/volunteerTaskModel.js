import prisma from '../services/database/prisma.js';
import { getOrCreateOrgProfile } from './resourceModel.js';

/**
 * Volunteer Task Model
 * Database operations for the help tasks an organization posts for volunteers
 * to sign up for. Tasks belong to an Organization profile
 * (VolunteerTask.organizationId -> Organization.id).
 *
 * Readiness + auto-progression rules live here so the controller stays thin:
 *   - A task is "fulfillable" when it has at least `minVolunteers` confirmed AND
 *     its resources are marked ready. `readySince` records when that first
 *     became true (and is cleared if it lapses).
 *   - Once a task has been fulfillable for AUTO_IN_PROGRESS_DAYS, it auto-moves
 *     from "open" to "in-progress". This is computed on load (no cron), so it
 *     takes effect the next time anyone reads the org's tasks.
 */

// Re-exported so callers can lazily create an org profile the same way the
// resource flow does.
export { getOrCreateOrgProfile };

// How long a task must stay fulfillable before it auto-advances to in-progress.
const AUTO_IN_PROGRESS_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

// A task can be fulfilled (min met + resources ready). Pure helper, no DB.
export const isFulfillable = (task) =>
  task.volunteersConfirmed >= task.minVolunteers && task.resourcesReady === true;

// A compact view of the help request a task addresses, embedded in each task
// so the org's task board can show which need it's tied to without a second
// round-trip. Kept small on purpose (no PII beyond what the feed already shows).
const REQUEST_SUMMARY = {
  select: {
    id: true,
    category: true,
    urgency: true,
    location: true,
    description: true,
    status: true,
  },
};

// List all of an organization's tasks (newest first), after running the
// auto-progression pass so statuses are up to date when they're read. Each task
// includes a summary of the help request it addresses.
export const getTasksByOrg = async (organizationId) => {
  const tasks = await prisma.volunteerTask.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { request: REQUEST_SUMMARY },
  });
  return await applyAutoProgression(tasks);
};

// Load a single task (used to check ownership before update/delete).
export const getTaskById = async (id) => {
  return await prisma.volunteerTask.findUnique({ where: { id } });
};

// Create a new volunteer task. `readySince` is stamped up front if the task
// somehow starts out already fulfillable (e.g. minVolunteers 0 + resources ready).
export const createTask = async (data) => {
  const created = await prisma.volunteerTask.create({
    data,
    include: { request: REQUEST_SUMMARY },
  });
  return await reconcileReadiness(created);
};

// Update the mutable fields of a task, then reconcile its readiness stamp so
// `readySince` reflects the new volunteer count / resource state.
export const updateTask = async (id, data) => {
  const updated = await prisma.volunteerTask.update({
    where: { id },
    data,
    include: { request: REQUEST_SUMMARY },
  });
  return await reconcileReadiness(updated);
};

// Remove a task from an organization's board.
export const deleteTask = async (id) => {
  return await prisma.volunteerTask.delete({ where: { id } });
};

// Keep `readySince` in sync with the current fulfillable state:
//   - just became fulfillable -> stamp readySince (if not already set)
//   - no longer fulfillable   -> clear readySince
// Returns the (possibly re-read) task. A no-op when nothing changed.
async function reconcileReadiness(task) {
  const fulfillable = isFulfillable(task);

  if (fulfillable && !task.readySince) {
    return await prisma.volunteerTask.update({
      where: { id: task.id },
      data: { readySince: new Date() },
      include: { request: REQUEST_SUMMARY },
    });
  }
  if (!fulfillable && task.readySince) {
    return await prisma.volunteerTask.update({
      where: { id: task.id },
      data: { readySince: null },
      include: { request: REQUEST_SUMMARY },
    });
  }
  return task;
}

// Auto-advance any "open" task that has been fulfillable for at least
// AUTO_IN_PROGRESS_DAYS to "in-progress". Persists the change and returns the
// list with the updated statuses applied. Only touches tasks that qualify.
async function applyAutoProgression(tasks) {
  const now = Date.now();
  const cutoffMs = AUTO_IN_PROGRESS_DAYS * DAY_MS;

  const toAdvance = tasks.filter(
    (t) =>
      t.status === 'open' &&
      t.readySince &&
      now - new Date(t.readySince).getTime() >= cutoffMs
  );

  if (toAdvance.length === 0) return tasks;

  const advancedIds = new Set(toAdvance.map((t) => t.id));
  await prisma.volunteerTask.updateMany({
    where: { id: { in: [...advancedIds] } },
    data: { status: 'in-progress' },
  });

  // Reflect the change in the list we already have rather than re-querying.
  return tasks.map((t) =>
    advancedIds.has(t.id) ? { ...t, status: 'in-progress' } : t
  );
}

export default {
  getOrCreateOrgProfile,
  isFulfillable,
  getTasksByOrg,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
