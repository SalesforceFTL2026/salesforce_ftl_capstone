import axios from 'axios';
import {
  isPreviewMode,
  isWriteMethod,
  handlePreviewWrite,
  applyPreviewOverlay,
} from './previewMode';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach the login token (if we have one) to every
// request so protected endpoints like GET /api/auth/me recognize the user.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Admin "Preview only" mode: don't let writes reach the server. We swap in a
    // one-off adapter that records the change in the session-only overlay and
    // resolves with a matching success, so the UI behaves as if the write
    // succeeded (and the change sticks for the session) while the database stays
    // untouched. Reads are never intercepted here; the overlay is layered onto
    // GET responses in the response interceptor below.
    if (isPreviewMode() && isWriteMethod(config.method)) {
      config.adapter = async (cfg) => ({
        data: handlePreviewWrite(cfg),
        status: 200,
        statusText: 'OK (preview)',
        headers: {},
        config: cfg,
        request: null,
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor. In admin Preview mode, layer the session overlay onto
// GET responses for help requests so simulated creates/edits/deletes show
// through the real (untouched) database data. A no-op for everyone else.
api.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || 'get').toLowerCase();
    if (method === 'get') {
      response.data = applyPreviewOverlay(response.config?.url || '', response.data);
    }
    return response;
  },
  (error) => {
    // Admin Preview mode: role-specific GET endpoints (the org/volunteer
    // dashboards, resources, volunteer tasks) reject the admin account with 403,
    // since the admin isn't literally an organization/volunteer. Rather than let
    // those reads fail — which would leave the preview lists empty and swallow
    // simulated assignments/interests/allocations — we treat a failed GET as an
    // empty server list and layer the session overlay onto it, so preview
    // changes still show. Scoped to admin preview + GET, so real users and real
    // writes are never affected.
    const config = error.config || {};
    const method = String(config.method || 'get').toLowerCase();
    if (isPreviewMode() && method === 'get') {
      const data = applyPreviewOverlay(config.url || '', { success: true, data: [] });
      return Promise.resolve({
        data,
        status: 200,
        statusText: 'OK (preview fallback)',
        headers: {},
        config,
        request: null,
      });
    }

    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
