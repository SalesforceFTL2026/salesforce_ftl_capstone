import api from './api';

// All request/dashboard API calls live here so components stay thin and there
// is a single source of truth for how we talk to the requests API.
//
// Backend contract:
//   GET  /api/requests/prioritized      -> { success, data: [request, ...] }
//   GET  /api/dashboard/volunteer       -> { success, data: [request, ...] }  (auth)
//   POST /api/requests/:id/interact      -> { success, message, data }        (auth)

// Fetch the AI-prioritized feed of active requests (highest priority first).
// Returns the array of requests on success; throws on failure.
//
// Pass an optional { lat, lng, radiusMiles } to only get requests within that
// distance of a point ("Near me", issue #116). The backend (issue #115) filters
// by the geo-radius and annotates each request with `distanceMiles`. Omit the
// filter (or leave any field undefined) to get the full feed.
export const getPrioritizedRequests = async (near) => {
  const params =
    near && near.lat != null && near.lng != null && near.radiusMiles != null
      ? { lat: near.lat, lng: near.lng, radius: near.radiusMiles }
      : undefined;

  const { data } = await api.get('/api/requests/prioritized', { params });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load the priority feed.');
  }

  return data.data;
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

// Fetch the signed-in volunteer's profile skills (an array of skill strings).
// Returns [] if the volunteer has no skills listed yet; throws on failure.
export const getVolunteerSkills = async () => {
  const { data } = await api.get('/api/dashboard/volunteer/profile');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your profile skills.');
  }

  return data.data.skills || [];
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

// Turn any request error (axios or thrown Error) into a safe message to show.
export const requestErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;
