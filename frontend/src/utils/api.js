import axios from 'axios';
import {
  isPreviewMode,
  isWriteMethod,
  handlePreviewWrite,
  applyPreviewOverlay,
} from './previewMode';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // Default timeout for ordinary CRUD calls. AI-backed endpoints (chat, voice,
  // transcription) routinely take longer than this, so they opt into a longer
  // timeout via AI_TIMEOUT_MS below instead of spuriously failing here.
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// AI/LLM + speech endpoints can legitimately take 20-30s (model latency, free-
// tier fallbacks, Whisper transcription). Give them a generous timeout so a slow
// but successful turn isn't reported to the user as an error.
const AI_TIMEOUT_MS = 45000;
const isAiEndpoint = (url = '') =>
  url.includes('/api/voice/') ||
  url.includes('/api/chat') ||
  url.includes('/api/requests/voice') ||
  url.includes('/api/prioritize');

// Some POST endpoints are conversational/compute requests, not persistent writes.
// In admin Preview mode they must still hit the backend, otherwise callers get
// synthetic preview payloads that do not match the real API contract.
const shouldBypassPreviewWrite = (config) => {
  const method = String(config?.method || 'get').toLowerCase();
  if (!isWriteMethod(method)) return false;
  const url = String(config?.url || '');
  return url.includes('/api/voice/') || url.includes('/api/chat/');
};

// Request interceptor: attach the login token (if we have one) to every
// request so protected endpoints like GET /api/auth/me recognize the user.
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Give AI/speech calls a longer timeout than ordinary CRUD (unless a caller
    // already set one explicitly), so a slow-but-successful turn doesn't get
    // cut off at the 10s default and surface as a false failure.
    if (config.timeout === undefined || config.timeout === 10000) {
      if (isAiEndpoint(String(config.url || ''))) {
        config.timeout = AI_TIMEOUT_MS;
      }
    }

    // Admin "Preview only" mode: don't let writes reach the server. We swap in a
    // one-off adapter that records the change in the session-only overlay and
    // resolves with a matching success, so the UI behaves as if the write
    // succeeded (and the change sticks for the session) while the database stays
    // untouched. Reads are never intercepted here; the overlay is layered onto
    // GET responses in the response interceptor below.
    if (isPreviewMode() && isWriteMethod(config.method) && !shouldBypassPreviewWrite(config)) {
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

    // Expired/invalid session handling. A 401 on a request we sent WITH a token
    // means the stored token is no longer good, so clear the session and send
    // the user to the landing page to sign in again — otherwise a stale token
    // just yields repeated silent failures. We scope this to requests that
    // actually carried a token and exclude the auth endpoints themselves, so a
    // failed login/signup (also 401) surfaces its own error instead of wiping
    // state and redirecting mid-form.
    const url = String(config.url || '');
    const sentWithToken = Boolean(config.headers?.Authorization);
    const isAuthEndpoint = url.includes('/api/auth/');
    if (error.response?.status === 401 && sentWithToken && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if we're not already on the landing page, to avoid a loop.
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.assign('/');
      }
    }

    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
