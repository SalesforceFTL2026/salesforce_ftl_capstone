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
export const getPrioritizedRequests = async () => {
  const { data } = await api.get('/api/requests/prioritized');

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
