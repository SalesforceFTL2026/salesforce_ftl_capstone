import api from '../utils/api';

// All calls to the /api/requests endpoints live here so components stay thin
// and there is one place that knows how to talk to the request API.
//
// Backend contract (backend/controllers/requestController.js):
//   GET /api/requests -> { success, data: [ ...requests ] }

// Fetch the help-seeker's requests.
//
// NOTE: auth is still being built, so the backend has no "my requests" endpoint
// yet and this returns ALL requests. Once login is merged and the API supports
// filtering by the logged-in user, swap this for GET /api/requests/mine (or add
// a ?userId= filter). See the TODO in HelpSeekerDashboard.
//
// @returns {Promise<Array>} list of request objects (empty array on no data)
export const getMyRequests = async () => {
  const { data } = await api.get('/api/requests');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load your requests.');
  }

  return data.data || [];
};

// Turn any request-API error into a safe message to show the user.
// Never surface a raw stack trace.
export const requestErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;
