// Preview mode for the admin dashboard.
//
// When ON, mutating API calls (POST/PUT/PATCH/DELETE) are short-circuited before
// they reach the network: the caller gets a synthetic success response so the UI
// still updates for a demo, but nothing is persisted to the database. When OFF
// ("Permanent"), writes go through normally.
//
// The flag lives in localStorage so it survives the page reloads that happen
// when the admin switches persona views, and so api.js (a plain module, not a
// React component) can read it synchronously on every request.

const KEY = 'adminPreviewMode';

// True only when the signed-in account is the demo admin. Preview mode must
// never affect real help-seeker/volunteer/organization users — their writes
// always go through. We read the stored user directly (not utils/auth, to avoid
// a circular import via api.js) and treat a corrupt/absent value as "not admin".
const isAdminSession = () => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored)?.role === 'admin' : false;
  } catch {
    return false;
  }
};

// Read the current flag. Only ever true for the admin session; for everyone
// else it is always false so their writes reach the server normally. For the
// admin it defaults to true (preview) so a demo can't accidentally write to the
// database before the presenter has explicitly chosen "Permanent".
export const isPreviewMode = () =>
  isAdminSession() && localStorage.getItem(KEY) !== 'off';

// Turn preview mode on (true) or off/permanent (false).
export const setPreviewMode = (on) => {
  localStorage.setItem(KEY, on ? 'on' : 'off');
};

// HTTP methods that change server state. Everything else (GET, HEAD) always
// goes through, even in preview mode, so the dashboards can still read data.
const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export const isWriteMethod = (method) =>
  WRITE_METHODS.has(String(method || 'get').toLowerCase());
