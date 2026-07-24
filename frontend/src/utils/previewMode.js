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
export const isAdminSession = () => {
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

// --- Session-only preview overlay for help requests -------------------------
//
// In Preview mode we don't just swallow writes — we remember them for the rest
// of the session so the presenter can create, edit, and delete help requests
// and see those changes reflected across the dashboards, WITHOUT ever touching
// the database. The overlay lives in sessionStorage, so it survives page
// reloads and persona switches but is cleared when the tab closes or the admin
// signs out (see clearPreviewStore, called from utils/auth logout). Switching
// to Permanent simply stops the overlay from being applied (isPreviewMode is
// false), so real database data shows through again.

const STORE_KEY = 'adminPreviewStore';

const emptyStore = () => ({ creates: [], updates: {}, deletes: [] });

const readStore = () => {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? { ...emptyStore(), ...JSON.parse(raw) } : emptyStore();
  } catch {
    return emptyStore();
  }
};

const writeStore = (store) => {
  sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
};

// Wipe every simulated change. Called on sign-out so preview edits never leak
// into a later session or a real user's view.
export const clearPreviewStore = () => {
  sessionStorage.removeItem(STORE_KEY);
};

// Read the signed-in user (used to stamp a simulated request's submitter).
const storedUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Pull the ":id" out of a request URL like "/api/requests/abc123" or
// "/api/requests/abc123/status". Returns null when there is no id segment.
const requestIdFromUrl = (url) => {
  const match = String(url || '').match(/\/api\/requests\/([^/?]+)/);
  const id = match?.[1];
  // These are named collection endpoints, not request ids.
  if (!id || ['prioritized', 'my-requests', 'distances', 'voice'].includes(id)) {
    return null;
  }
  return id;
};

// Build one simulated request record that matches the shape the dashboards
// expect (mirrors backend/models/requestModel.createRequest + the interaction
// counts the feed adds), so it renders like a real request.
const buildPreviewRequest = (item, body, index) => {
  const now = new Date().toISOString();
  const user = storedUser();
  const size = body.householdSize;
  return {
    id: `preview-${Date.now()}-${index}`,
    userId: user?.id ?? null,
    submitterName: user?.name ?? null,
    submitterRole: user?.role ?? null,
    category: item.category,
    urgency: item.urgency,
    location: body.location,
    latitude: null,
    longitude: null,
    description: body.description,
    householdSize: size === '' || size == null ? null : Number(size),
    status: 'pending',
    priorityScore: 0,
    reasoning: null,
    createdAt: now,
    updatedAt: now,
    volunteerInterestCount: 0,
    organizationRespondingCount: 0,
    __preview: true, // marks a session-only record (never persisted)
  };
};

// Handle a write while in Preview mode: record its effect in the session
// overlay and return the { data } payload the caller should receive, so the UI
// behaves as if the server accepted it. Recognizes help-request create / edit /
// delete; any other write just gets a generic success (nothing is recorded).
export const handlePreviewWrite = (config) => {
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '');
  let body = config.data;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const store = readStore();
  const isRequestsCollection = /\/api\/requests(\?|$)/.test(url);
  const id = requestIdFromUrl(url);

  // Create: POST /api/requests (single or multi-category).
  if (method === 'post' && isRequestsCollection) {
    const items =
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories
        : [{ category: body.category, urgency: body.urgency }];
    const created = items.map((item, i) => buildPreviewRequest(item, body, i));
    store.creates = [...created, ...store.creates];
    writeStore(store);
    return {
      success: true,
      message: 'Help request submitted (preview)',
      count: created.length,
      data: created.length === 1 ? created[0] : created,
      preview: true,
    };
  }

  // Delete: DELETE /api/requests/:id.
  if (method === 'delete' && id) {
    store.creates = store.creates.filter((r) => r.id !== id);
    delete store.updates[id];
    if (!store.deletes.includes(id)) store.deletes.push(id);
    writeStore(store);
    return { success: true, data: null, preview: true };
  }

  // Edit: PATCH /api/requests/:id (category/description) or
  // PATCH /api/requests/:id/status ({ status }). Merge the changed fields.
  if ((method === 'patch' || method === 'put') && id) {
    const fields = { ...body, updatedAt: new Date().toISOString() };
    store.updates[id] = { ...(store.updates[id] || {}), ...fields };
    writeStore(store);
    return { success: true, data: { id, ...store.updates[id] }, preview: true };
  }

  // Any other write (e.g. resources, volunteer tasks, interest): keep the old
  // behavior — succeed without recording, so nothing is persisted.
  return { success: true, data: null, preview: true };
};

// Layer the session overlay onto a GET response's data, so simulated creates,
// edits, and deletes show through. Only applied while Preview is active.
//   - list endpoints (data.data is an array): drop deletes, apply edits, and
//     prepend session-created requests (newest first).
//   - single request (data.data is one object): apply any edit.
export const applyPreviewOverlay = (url, payload) => {
  if (!isPreviewMode()) return payload;
  if (!payload || payload.data == null) return payload;

  const isRequestList =
    /\/api\/requests(\?|$)/.test(url) ||
    url.includes('/api/requests/prioritized') ||
    url.includes('/api/requests/my-requests');
  const singleId = isRequestList ? null : requestIdFromUrl(url);

  if (!isRequestList && !singleId) return payload;

  const store = readStore();
  const deletes = new Set(store.deletes);
  const withEdits = (r) => (store.updates[r.id] ? { ...r, ...store.updates[r.id] } : r);

  if (isRequestList && Array.isArray(payload.data)) {
    const server = payload.data.filter((r) => !deletes.has(r.id)).map(withEdits);
    const created = store.creates.filter((r) => !deletes.has(r.id)).map(withEdits);
    return { ...payload, data: [...created, ...server] };
  }

  if (singleId && payload.data && typeof payload.data === 'object') {
    return { ...payload, data: withEdits(payload.data) };
  }

  return payload;
};
