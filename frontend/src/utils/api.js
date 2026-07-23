import axios from 'axios';
import { isPreviewMode, isWriteMethod } from './previewMode';

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
    // one-off adapter that resolves with a synthetic success, so callers (and
    // their optimistic UI updates) behave as if the write succeeded while the
    // database stays untouched. Reads are never intercepted.
    if (isPreviewMode() && isWriteMethod(config.method)) {
      config.adapter = async (cfg) => ({
        data: { success: true, data: null, preview: true },
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

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;
