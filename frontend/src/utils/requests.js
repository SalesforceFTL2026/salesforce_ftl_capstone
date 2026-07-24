import api from './api';

// All request/dashboard API calls live here so components stay thin and there
// is a single source of truth for how we talk to the requests API.
//
// Backend contract:
//   GET  /api/requests/prioritized      -> { success, data: [request, ...] }
//   GET  /api/dashboard/volunteer       -> { success, data: [request, ...] }  (auth)
//   POST /api/requests/:id/interact      -> { success, message, data }        (auth)

// Build the query params for a feed request from the optional "Near me"
// geo-radius filter (issue #116) and the optional category/urgency/keyword
// filters (issues #81, #82). Only the params that are actually set are
// included, so an omitted filter is simply absent from the request. The
// backend ignores blank/unknown values and returns the un-narrowed feed.
// See docs/FILTER_CONTRACT.md for the shared contract.
const buildFeedParams = (near, filters) => {
  const params = {};

  if (near && near.lat != null && near.lng != null && near.radiusMiles != null) {
    params.lat = near.lat;
    params.lng = near.lng;
    params.radius = near.radiusMiles;
  }

  if (filters?.category) params.category = filters.category;
  if (filters?.urgency) params.urgency = filters.urgency;
  if (filters?.search && filters.search.trim() !== '') {
    params.search = filters.search.trim();
  }

  return Object.keys(params).length ? params : undefined;
};

// Fetch the AI-prioritized feed of active requests (highest priority first).
// Returns the array of requests on success; throws on failure.
//
// Pass an optional { lat, lng, radiusMiles } to only get requests within that
// distance of a point ("Near me", issue #116). The backend (issue #115) filters
// by the geo-radius and annotates each request with `distanceMiles`. Omit the
// filter (or leave any field undefined) to get the full feed.
//
// Pass an optional { category, urgency, search } to narrow the feed by
// category, urgency, or a free-text keyword (issues #81, #82). These compose
// with the geo-radius filter, and the feed stays sorted by AI priority.
export const getPrioritizedRequests = async (near, filters) => {
  const params = buildFeedParams(near, filters);

  const { data } = await api.get('/api/requests/prioritized', { params });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load the priority feed.');
  }

  return data.data;
};

// Fetch every request in the system (any status: pending, in-progress,
// fulfilled, closed). Organizations use this to browse all requests, whether
// or not they've assigned themselves to any. Returns the array on success.
//
// Pass an optional { lat, lng, radiusMiles } to geo-filter by distance from a
// point ("Near me"). The backend handles invalid/missing filters by returning
// the full list.
export const getAllRequests = async (near) => {
  const params =
    near && near.lat != null && near.lng != null && near.radiusMiles != null
      ? { lat: near.lat, lng: near.lng, radius: near.radiusMiles }
      : undefined;
  const { data } = await api.get('/api/requests', { params });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load requests.');
  }

  return data.data;
};

// Fetch the distance (miles) from an origin location to each active request.
// Returns a map of { [requestId]: distanceMiles | null }; throws on failure.
export const getRequestDistances = async (origin) => {
  const { data } = await api.get('/api/requests/distances', {
    params: { origin },
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not compute distances.');
  }

  // Reshape the array into a quick lookup by request id.
  return Object.fromEntries(data.data.map((d) => [d.id, d.distanceMiles]));
};

// Fetch the requests the signed-in volunteer has expressed interest in.
// Returns the array of requests on success; throws on failure.
export const getVolunteerInterests = async () => {
  const { data } = await api.get('/api/dashboard/volunteer');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your interests.');
  }

  return data.data;
};

// Fetch the signed-in volunteer's profile skill names (an array of strings).
// The API returns { name, level } objects; this flattens to names for callers
// that only care about which skill areas are covered (e.g. dashboard stats).
// Returns [] if the volunteer has no skills listed yet; throws on failure.
export const getVolunteerSkills = async () => {
  const { data } = await api.get('/api/dashboard/volunteer/profile');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your profile skills.');
  }

  return (data.data.skills || []).map((s) => (typeof s === 'string' ? s : s.name));
};

// Fetch the requests the signed-in organization is responding to / tracking.
// Returns the array of requests on success; throws on failure.
export const getOrganizationResponses = async () => {
  const { data } = await api.get('/api/dashboard/organization');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your active responses.');
  }

  return data.data;
};

// Fetch the signed-in organization's inventory of resources.
// Returns the array of resources on success; throws on failure.
export const getOrganizationResources = async () => {
  const { data } = await api.get('/api/resources');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your resources.');
  }

  return data.data;
};

// Add a resource to the organization's inventory.
// Returns the created resource on success; throws on failure.
export const addOrganizationResource = async (resource) => {
  const { data } = await api.post('/api/resources', resource);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not add the resource.');
  }

  return data.data;
};

// Toggle whether a resource is currently available.
// Returns the updated resource on success; throws on failure.
export const setResourceAvailability = async (resourceId, available) => {
  const { data } = await api.patch(`/api/resources/${resourceId}`, { available });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update the resource.');
  }

  return data.data;
};

// Remove a resource from the organization's inventory.
// Resolves on success; throws on failure.
export const deleteOrganizationResource = async (resourceId) => {
  const { data } = await api.delete(`/api/resources/${resourceId}`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not remove the resource.');
  }

  return true;
};

// --- Resource allocation (assigning resources to help requests) ---

// List the resources currently allocated to a request.
// Returns the array of allocations on success; throws on failure.
export const getRequestAllocations = async (requestId) => {
  const { data } = await api.get(`/api/resources/requests/${requestId}/allocations`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load allocations.');
  }

  return data.data;
};

// Ask the AI advisor which resources to allocate to a request, and how much.
// Returns an array of { resourceId, quantity, reason }; throws on failure.
export const getAllocationSuggestions = async (requestId) => {
  const { data } = await api.get(`/api/resources/requests/${requestId}/suggestions`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load suggestions.');
  }

  return data.data;
};

// Allocate a quantity of a resource to a request.
// Returns the created allocation on success; throws on failure.
export const allocateResource = async (requestId, { resourceId, quantity, note }) => {
  const { data } = await api.post(`/api/resources/requests/${requestId}/allocations`, {
    resourceId,
    quantity,
    note,
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not allocate the resource.');
  }

  return data.data;
};

// Remove an allocation, returning its quantity to the resource.
// Resolves on success; throws on failure.
export const deallocateResource = async (allocationId) => {
  const { data } = await api.delete(`/api/resources/allocations/${allocationId}`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not remove the allocation.');
  }

  return true;
};

// --- Volunteer tasks (org posts help tasks for volunteers to sign up for) ---

// Fetch the signed-in organization's volunteer tasks.
// Returns the array of tasks on success; throws on failure.
export const getVolunteerTasks = async () => {
  const { data } = await api.get('/api/volunteer-tasks');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your volunteer tasks.');
  }

  return data.data;
};

// Create a volunteer task. `task` is
// { requestId, title, description, category?, urgency?, skillsNeeded?,
//   minVolunteers?, maxVolunteers? }. Every task must be linked to an existing
//   help request. Returns the created task on success; throws on failure.
export const createVolunteerTask = async (task) => {
  const { data } = await api.post('/api/volunteer-tasks', task);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not create the volunteer task.');
  }

  return data.data;
};

// Update a volunteer task (partial). `updates` may include any of the mutable
// fields: details, volunteersConfirmed, resourcesReady, volunteerDate, status.
// Returns the updated task on success; throws on failure.
export const updateVolunteerTask = async (taskId, updates) => {
  const { data } = await api.patch(`/api/volunteer-tasks/${taskId}`, updates);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update the volunteer task.');
  }

  return data.data;
};

// Remove a volunteer task. Resolves on success; throws on failure.
export const deleteVolunteerTask = async (taskId) => {
  const { data } = await api.delete(`/api/volunteer-tasks/${taskId}`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not remove the volunteer task.');
  }

  return true;
};

// Ask the AI advisor for 2-3 candidate volunteer-day dates for a task.
// Returns an array of { date: 'YYYY-MM-DD', reason }; throws on failure.
export const getTaskDateSuggestions = async (taskId) => {
  const { data } = await api.get(`/api/volunteer-tasks/${taskId}/date-suggestions`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load date suggestions.');
  }

  return data.data;
};

// Ask the AI advisor for 2-3 candidate volunteer tasks that would help fulfill
// a given help request. Returns ready-to-edit task drafts:
// { title, description, category, urgency, skillsNeeded, minVolunteers,
//   maxVolunteers }. Does NOT create anything. Throws on failure.
export const getTaskSuggestions = async (requestId) => {
  const { data } = await api.get('/api/volunteer-tasks/suggestions', {
    params: { requestId },
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load task suggestions.');
  }

  return data.data;
};

// --- Volunteer-facing task sign-up ---

// Fetch the open volunteer tasks the signed-in volunteer can sign up for. Each
// task carries its help request + organization summary and a `signedUp` flag.
// Returns the array on success; throws on failure.
export const getAvailableTasks = async () => {
  const { data } = await api.get('/api/volunteer-tasks/available');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load available tasks.');
  }

  return data.data;
};

// Sign the signed-in volunteer up for a task.
// Returns the updated task on success; throws on failure.
export const signUpForTask = async (taskId) => {
  const { data } = await api.post(`/api/volunteer-tasks/${taskId}/signup`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not sign up for the task.');
  }

  return data.data;
};

// Withdraw the signed-in volunteer from a task.
// Resolves on success; throws on failure.
export const withdrawFromTask = async (taskId) => {
  const { data } = await api.delete(`/api/volunteer-tasks/${taskId}/signup`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not withdraw from the task.');
  }

  return true;
};

// Update a request's status (organizations, or the help-seeker who owns it).
// Returns the updated request on success; throws on failure.
export const updateRequestStatus = async (requestId, status) => {
  const { data } = await api.patch(`/api/requests/${requestId}/status`, {
    status,
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update the request status.');
  }

  return data.data;
};

// Re-categorize a request (organizations only).
// Returns the updated request on success; throws on failure.
export const updateRequestCategory = async (requestId, category) => {
  const { data } = await api.patch(`/api/requests/${requestId}`, {
    category,
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update the request category.');
  }

  return data.data;
};

// Assign a request to the signed-in organization ("we'll help with this").
// This is what unlocks allocating resources to the request. Idempotent.
// Returns the response payload on success; throws on failure.
export const assignRequest = async (requestId) => {
  const { data } = await api.post(`/api/requests/${requestId}/assign`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not assign the request.');
  }

  return data;
};

// Remove the signed-in organization's assignment from a request.
// Resolves on success; throws on failure.
export const unassignRequest = async (requestId) => {
  const { data } = await api.delete(`/api/requests/${requestId}/assign`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not unassign the request.');
  }

  return true;
};

// Express interest in a request ("I can help with this").
// Returns the created/existing response on success; throws on failure.
export const expressInterest = async (requestId, notes) => {
  const { data } = await api.post(`/api/requests/${requestId}/interact`, {
    notes,
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not record your interest.');
  }

  return data;
};

// Mark a claimed request as helped (volunteers). The volunteer must already
// have expressed interest in the request. Returns the updated request on
// success; throws on failure.
export const markRequestHelped = async (requestId) => {
  const { data } = await api.post(`/api/requests/${requestId}/complete`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not mark the request as helped.');
  }

  return data.data;
};

// Withdraw the signed-in volunteer's interest in a request ("un-sign up").
// Resolves on success; throws on failure.
export const withdrawInterest = async (requestId) => {
  const { data } = await api.delete(`/api/requests/${requestId}/interact`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not withdraw your interest.');
  }

  return true;
};

// Fetch the signed-in volunteer's skills with self-rated proficiency.
// Returns an array of { name, level } on success; throws on failure.
export const getVolunteerSkillsDetailed = async () => {
  const { data } = await api.get('/api/dashboard/volunteer/profile');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your skills.');
  }

  return data.data.skills || [];
};

// Replace the signed-in volunteer's skills. `skills` is an array of
// { name, level } where level is a 1–5 self-rating.
// Returns the saved array of { name, level } on success; throws on failure.
export const updateVolunteerSkills = async (skills) => {
  const { data } = await api.put('/api/dashboard/volunteer/profile/skills', { skills });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not save your skills.');
  }

  return data.data.skills || [];
};

// Voice intake: upload a recorded audio clip and get back the transcript plus
// the request fields Claude extracted from it, for the user to review before
// submitting (issues #152–156). Does NOT create the request — the confirm step
// posts the reviewed fields to POST /api/requests like the manual form.
//
// @param {Blob} audioBlob - the recorded audio (e.g. from MediaRecorder)
// @param {string} [filename] - name w/ extension so Whisper infers the format
// @returns {Promise<{transcript: string, fields: object}>}
export const submitVoiceIntake = async (audioBlob, filename = 'recording.webm') => {
  const form = new FormData();
  form.append('audio', audioBlob, filename);

  const { data } = await api.post('/api/requests/voice', form, {
    // Let the browser set multipart/form-data with the correct boundary; the
    // shared api instance otherwise defaults to application/json.
    headers: { 'Content-Type': undefined },
    // Transcription + extraction is slower than a normal call; give it room.
    timeout: 60000,
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not process the recording.');
  }

  return data.data;
};

// Turn any request error (axios or thrown Error) into a safe message to show.
export const requestErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;
