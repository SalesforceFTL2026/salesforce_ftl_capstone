// Preview mode for the admin dashboard.
//
// When ON, mutating API calls (POST/PUT/PATCH/DELETE) are short-circuited before
// they reach the network: the caller gets a synthetic success response so the UI
// still updates for a demo, but nothing is persisted to the database. When OFF
// ("Permanent"), writes go through normally.
//
// Beyond swallowing writes, Preview mode REMEMBERS them for the rest of the
// session in a small overlay (sessionStorage), and layers that overlay back onto
// every GET response. That is what lets a presenter make a change while viewing
// one persona and immediately see it reflected in the others — a help-seeker
// submits a request, an org assigns it and allocates resources, a volunteer
// signs up for the task — all without touching the database. The overlay is
// wiped on sign-out (see clearPreviewStore) and dies when the tab closes.
//
// The on/off flag lives in localStorage so it survives the page reloads that
// happen when the admin switches persona views, and so api.js (a plain module,
// not a React component) can read it synchronously on every request.

const KEY = 'adminPreviewMode';

// True only when the signed-in account is the demo admin. Preview mode must
// never affect real help-seeker/volunteer/organization users — their writes
// always go through. We read the stored user directly (not utils/auth, to avoid
// a circular import via api.js) and treat a corrupt/absent value as "not admin".
export const isAdminSession = () => {
  try {
    const stored = sessionStorage.getItem('user');
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

// --- Session-only preview overlay -------------------------------------------
//
// The overlay lives in sessionStorage, so it survives page reloads and persona
// switches but is cleared when the tab closes or the admin signs out (see
// clearPreviewStore, called from utils/auth logout). Switching to Permanent
// simply stops the overlay from being applied (isPreviewMode is false), so real
// database data shows through again.
//
// Shape (one section per entity we simulate):
//   requests    { creates, updates, deletes } — help requests
//   tasks       { creates, updates, deletes } — org volunteer tasks
//   taskSignups { [taskId]: true }            — tasks THIS admin has joined
//   resources   { creates, updates, deletes } — org resource inventory
//   allocations { creates, deletes }          — resources assigned to requests
//   assignments { [requestId]: true }         — requests the org has claimed
//   interests   { [requestId]: 'offered' | 'completed' } — volunteer interest
//   requestCache/resourceCache — full objects seen in list GETs, so lists that
//     only receive an id (assign / interest / allocate) can still render cards.

const STORE_KEY = 'adminPreviewStore';

const emptyStore = () => ({
  requests: { creates: [], updates: {}, deletes: [] },
  tasks: { creates: [], updates: {}, deletes: [] },
  taskSignups: {},
  resources: { creates: [], updates: {}, deletes: [] },
  allocations: { creates: [], deletes: [] },
  assignments: {},
  interests: {},
  requestCache: {},
  resourceCache: {},
});

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

// Read the signed-in user (used to stamp a simulated record's owner).
const storedUser = () => {
  try {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const nowIso = () => new Date().toISOString();

// --- URL parsing ------------------------------------------------------------
//
// Small matchers that pull ids / sub-actions out of the REST paths. Each guards
// against the named collection segments that aren't record ids.

// { id, action } for /api/requests/:id[/status|assign|interact|complete].
// Returns {} for the named collection endpoints (prioritized, etc.).
const parseRequestUrl = (url) => {
  const match = String(url || '').match(/\/api\/requests\/([^/?]+)(?:\/([^/?]+))?/);
  if (!match) return {};
  const id = match[1];
  if (['prioritized', 'my-requests', 'distances', 'voice'].includes(id)) return {};
  return { id, action: match[2] || null };
};

const isRequestListUrl = (url) =>
  /\/api\/requests(\?|$)/.test(url) ||
  url.includes('/api/requests/prioritized') ||
  url.includes('/api/requests/my-requests');

const isOrgDashboardUrl = (url) => /\/api\/dashboard\/organization(\?|$)/.test(url);
const isVolunteerDashboardUrl = (url) => /\/api\/dashboard\/volunteer(\?|$)/.test(url);

// Volunteer tasks. Signup is checked before the plain item so the ":id/signup"
// path isn't mistaken for an edit.
const taskSignupId = (url) => String(url).match(/\/api\/volunteer-tasks\/([^/?]+)\/signup/)?.[1] || null;
const taskItemId = (url) => {
  const id = String(url).match(/\/api\/volunteer-tasks\/([^/?]+)(?:\/|\?|$)/)?.[1] || null;
  return id && !['available', 'suggestions'].includes(id) ? id : null;
};
const isTaskCollection = (url) => /\/api\/volunteer-tasks(\?|$)/.test(url);
const isAvailableTasks = (url) => url.includes('/api/volunteer-tasks/available');

// Resources + allocations.
const allocCreateRequestId = (url) =>
  String(url).match(/\/api\/resources\/requests\/([^/?]+)\/allocations/)?.[1] || null;
const allocDeleteId = (url) =>
  String(url).match(/\/api\/resources\/allocations\/([^/?]+)/)?.[1] || null;
const resourceItemId = (url) => {
  const id = String(url).match(/\/api\/resources\/([^/?]+)(?:\/|\?|$)/)?.[1] || null;
  return id && !['requests', 'allocations'].includes(id) ? id : null;
};
const isResourceCollection = (url) => /\/api\/resources(\?|$)/.test(url);

// --- Synthetic record builders ----------------------------------------------
//
// Each builds one record matching the shape the dashboards expect, so it renders
// like a real one. Records are tagged __preview so they're recognizable.

// Build one simulated help request (mirrors backend/models createRequest + the
// interaction counts the prioritized feed adds).
const buildPreviewRequest = (item, body, index) => {
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
    volunteerInterestCount: 0,
    organizationRespondingCount: 0,
    __preview: true,
  };
};

// Build one simulated volunteer task (mirrors the VolunteerTask row + the
// embedded request summary the lists include).
const buildPreviewTask = (body, store, index) => {
  const user = storedUser();
  const cached = body.requestId ? store.requestCache[body.requestId] : null;
  const request = cached
    ? {
        id: cached.id,
        category: cached.category,
        urgency: cached.urgency,
        location: cached.location,
        description: cached.description,
        status: cached.status,
      }
    : {
        id: body.requestId ?? null,
        category: body.category ?? null,
        urgency: body.urgency ?? 'Medium',
        location: null,
        description: null,
        status: 'pending',
      };
  return {
    id: `preview-task-${Date.now()}-${index}`,
    organizationId: user?.id ?? null,
    requestId: body.requestId ?? null,
    title: body.title ?? '',
    description: body.description ?? '',
    category: body.category ?? null,
    urgency: body.urgency ?? 'Medium',
    skillsNeeded: Array.isArray(body.skillsNeeded)
      ? JSON.stringify(body.skillsNeeded)
      : body.skillsNeeded ?? null,
    minVolunteers: body.minVolunteers != null ? Number(body.minVolunteers) : 1,
    maxVolunteers:
      body.maxVolunteers != null && body.maxVolunteers !== '' ? Number(body.maxVolunteers) : null,
    volunteersConfirmed: body.volunteersConfirmed != null ? Number(body.volunteersConfirmed) : 0,
    resourcesReady: body.resourcesReady ?? false,
    volunteerDate: body.volunteerDate ?? null,
    readySince: null,
    status: body.status ?? 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    request,
    __preview: true,
  };
};

// Build one simulated resource (mirrors the Resource row).
const buildPreviewResource = (body, index) => {
  const user = storedUser();
  const qty = body.quantity;
  return {
    id: `preview-resource-${Date.now()}-${index}`,
    organizationId: user?.id ?? null,
    resourceType: body.resourceType ?? null,
    name: body.name ?? '',
    quantity: qty == null || qty === '' ? 0 : Number(qty),
    unit: body.unit ?? '',
    available: true,
    location: body.location ?? null,
    description: body.description ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    __preview: true,
  };
};

// Build one simulated allocation (mirrors ResourceAllocation + embedded
// resource). Looks up the resource from the cache/session so the row renders
// with a real name and unit.
const buildPreviewAllocation = (requestId, body, store, index) => {
  const resource =
    store.resourceCache[body.resourceId] ||
    store.resources.creates.find((r) => r.id === body.resourceId) ||
    { id: body.resourceId, name: 'Resource', resourceType: null, unit: '', quantity: 0, available: true };
  return {
    id: `preview-alloc-${Date.now()}-${index}`,
    resourceId: body.resourceId,
    requestId,
    quantity: body.quantity == null || body.quantity === '' ? 0 : Number(body.quantity),
    note: body.note ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    resource,
    __preview: true,
  };
};

// --- Write handling ---------------------------------------------------------

// Handle a write while in Preview mode: record its effect in the session
// overlay and return the { data } payload the caller should receive, so the UI
// behaves as if the server accepted it. Any write we don't recognize just gets a
// generic success (nothing is recorded), matching the old behavior.
export const handlePreviewWrite = (config) => {
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '');
  let body = config.data;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const store = readStore();

  // ----- Profile edits (PATCH /api/auth/me) -----
  // Echo the submitted fields back so the session user updates locally, matching
  // the backend's normalization (empty phone/household clears to null). Without
  // this the write would fall through to the generic success below with
  // data: null, and the edit would silently not apply.
  if ((method === 'patch' || method === 'put') && /\/api\/auth\/me(\?|$)/.test(url)) {
    const data = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.location !== undefined) data.location = String(body.location).trim();
    if (body.languagePreference !== undefined) data.languagePreference = body.languagePreference;
    if (body.phoneNumber !== undefined) {
      const trimmed = String(body.phoneNumber).trim();
      data.phoneNumber = trimmed === '' ? null : trimmed;
    }
    if (body.householdSize !== undefined) {
      data.householdSize =
        body.householdSize === '' || body.householdSize == null ? null : Number(body.householdSize);
    }
    return { success: true, message: 'Profile updated (preview)', data, preview: true };
  }

  // ----- Help requests -----
  const isRequestsCollection = /\/api\/requests(\?|$)/.test(url);
  const req = parseRequestUrl(url);

  // Create: POST /api/requests (single or multi-category).
  if (method === 'post' && isRequestsCollection) {
    const items =
      Array.isArray(body.categories) && body.categories.length > 0
        ? body.categories
        : [{ category: body.category, urgency: body.urgency }];
    const created = items.map((item, i) => buildPreviewRequest(item, body, i));
    store.requests.creates = [...created, ...store.requests.creates];
    writeStore(store);
    return {
      success: true,
      message: 'Help request submitted (preview)',
      count: created.length,
      data: created.length === 1 ? created[0] : created,
      preview: true,
    };
  }

  if (req.id) {
    // Delete a request: DELETE /api/requests/:id.
    if (method === 'delete' && !req.action) {
      store.requests.creates = store.requests.creates.filter((r) => r.id !== req.id);
      delete store.requests.updates[req.id];
      if (!store.requests.deletes.includes(req.id)) store.requests.deletes.push(req.id);
      writeStore(store);
      return { success: true, data: null, preview: true };
    }

    // Edit a request: PATCH /api/requests/:id (fields) or .../status ({ status }).
    if ((method === 'patch' || method === 'put') && (!req.action || req.action === 'status')) {
      const fields = { ...body, updatedAt: nowIso() };
      store.requests.updates[req.id] = { ...(store.requests.updates[req.id] || {}), ...fields };
      writeStore(store);
      return { success: true, data: { id: req.id, ...store.requests.updates[req.id] }, preview: true };
    }

    // Org assigns / unassigns itself: POST|DELETE /api/requests/:id/assign.
    if (req.action === 'assign') {
      if (method === 'post') {
        store.assignments[req.id] = true;
        writeStore(store);
        return {
          success: true,
          message: 'Assigned (preview)',
          data: { id: `preview-resp-${req.id}`, requestId: req.id, responderType: 'organization', status: 'accepted' },
          preview: true,
        };
      }
      if (method === 'delete') {
        delete store.assignments[req.id];
        writeStore(store);
        return { success: true, message: 'Unassigned (preview)', data: null, preview: true };
      }
    }

    // Volunteer interest: POST|DELETE /api/requests/:id/interact.
    if (req.action === 'interact') {
      if (method === 'post') {
        store.interests[req.id] = store.interests[req.id] === 'completed' ? 'completed' : 'offered';
        writeStore(store);
        return {
          success: true,
          message: 'Interest recorded (preview)',
          data: { id: `preview-resp-${req.id}`, requestId: req.id, responderType: 'volunteer', status: 'offered' },
          preview: true,
        };
      }
      if (method === 'delete') {
        delete store.interests[req.id];
        writeStore(store);
        return { success: true, message: 'Interest withdrawn (preview)', data: null, preview: true };
      }
    }

    // Volunteer marks a request helped: POST /api/requests/:id/complete.
    if (req.action === 'complete' && method === 'post') {
      store.interests[req.id] = 'completed';
      store.requests.updates[req.id] = {
        ...(store.requests.updates[req.id] || {}),
        status: 'completed',
        updatedAt: nowIso(),
      };
      writeStore(store);
      const base = store.requestCache[req.id] || { id: req.id };
      return { success: true, data: { ...base, ...store.requests.updates[req.id] }, preview: true };
    }
  }

  // ----- Volunteer tasks -----
  if (method === 'post' && isTaskCollection(url) && !isAvailableTasks(url) && !taskSignupId(url) && !taskItemId(url)) {
    const task = buildPreviewTask(body, store, 0);
    store.tasks.creates = [task, ...store.tasks.creates];
    writeStore(store);
    return { success: true, data: task, preview: true };
  }

  const signupTaskId = taskSignupId(url);
  if (signupTaskId) {
    if (method === 'post') {
      store.taskSignups[signupTaskId] = true;
      writeStore(store);
      return { success: true, data: { id: signupTaskId, signedUp: true }, preview: true };
    }
    if (method === 'delete') {
      delete store.taskSignups[signupTaskId];
      writeStore(store);
      return { success: true, data: null, preview: true };
    }
  }

  const taskId = taskItemId(url);
  if (taskId) {
    if (method === 'delete') {
      store.tasks.creates = store.tasks.creates.filter((t) => t.id !== taskId);
      delete store.tasks.updates[taskId];
      if (!store.tasks.deletes.includes(taskId)) store.tasks.deletes.push(taskId);
      writeStore(store);
      return { success: true, data: null, preview: true };
    }
    if (method === 'patch' || method === 'put') {
      const fields = { ...body, updatedAt: nowIso() };
      if (Array.isArray(fields.skillsNeeded)) fields.skillsNeeded = JSON.stringify(fields.skillsNeeded);
      store.tasks.updates[taskId] = { ...(store.tasks.updates[taskId] || {}), ...fields };
      writeStore(store);
      return { success: true, data: { id: taskId, ...store.tasks.updates[taskId] }, preview: true };
    }
  }

  // ----- Resources & allocations -----
  const allocRequestId = allocCreateRequestId(url);
  if (allocRequestId && method === 'post') {
    const alloc = buildPreviewAllocation(allocRequestId, body, store, 0);
    store.allocations.creates = [alloc, ...store.allocations.creates];
    writeStore(store);
    return { success: true, data: alloc, preview: true };
  }

  const deallocId = allocDeleteId(url);
  if (deallocId && method === 'delete') {
    store.allocations.creates = store.allocations.creates.filter((a) => a.id !== deallocId);
    if (!store.allocations.deletes.includes(deallocId)) store.allocations.deletes.push(deallocId);
    writeStore(store);
    return { success: true, data: null, preview: true };
  }

  if (method === 'post' && isResourceCollection(url)) {
    const resource = buildPreviewResource(body, 0);
    store.resources.creates = [resource, ...store.resources.creates];
    writeStore(store);
    return { success: true, data: resource, preview: true };
  }

  const resourceId = resourceItemId(url);
  if (resourceId) {
    if (method === 'delete') {
      store.resources.creates = store.resources.creates.filter((r) => r.id !== resourceId);
      delete store.resources.updates[resourceId];
      if (!store.resources.deletes.includes(resourceId)) store.resources.deletes.push(resourceId);
      writeStore(store);
      return { success: true, data: null, preview: true };
    }
    if (method === 'patch' || method === 'put') {
      const fields = { ...body, updatedAt: nowIso() };
      store.resources.updates[resourceId] = { ...(store.resources.updates[resourceId] || {}), ...fields };
      writeStore(store);
      return { success: true, data: { id: resourceId, ...store.resources.updates[resourceId] }, preview: true };
    }
  }

  // Anything else: succeed without recording, so nothing is persisted.
  return { success: true, data: null, preview: true };
};

// --- Read overlay -----------------------------------------------------------

// Apply a section's creates/updates/deletes to a server list. Shared by the
// requests / tasks / resources lists (each stores the same shape).
const overlayCollection = (serverList, section) => {
  const deletes = new Set(section.deletes || []);
  const withEdits = (r) => (section.updates?.[r.id] ? { ...r, ...section.updates[r.id] } : r);
  const server = (serverList || []).filter((r) => !deletes.has(r.id)).map(withEdits);
  const created = (section.creates || []).filter((r) => !deletes.has(r.id)).map(withEdits);
  return [...created, ...server];
};

// Layer request creates/edits/deletes, plus simulated interest/assignment
// counts, onto a request list.
const overlayRequestList = (payload, store) => {
  const s = store.requests;
  const deletes = new Set(s.deletes);
  const withEdits = (r) => (s.updates[r.id] ? { ...r, ...s.updates[r.id] } : r);
  const bumpCounts = (r) => {
    const out = { ...r };
    if ('volunteerInterestCount' in out && store.interests[r.id]) {
      out.volunteerInterestCount = (out.volunteerInterestCount || 0) + 1;
    }
    if ('organizationRespondingCount' in out && store.assignments[r.id]) {
      out.organizationRespondingCount = (out.organizationRespondingCount || 0) + 1;
    }
    return out;
  };
  const server = payload.data.filter((r) => !deletes.has(r.id)).map(withEdits).map(bumpCounts);
  const created = s.creates.filter((r) => !deletes.has(r.id)).map(withEdits).map(bumpCounts);
  return { ...payload, data: [...created, ...server] };
};

// Add this admin's simulated signup to a task (bumps the confirmed count) and,
// for the volunteer-facing list, decorate it with signedUp / hasRoom / org.
const decorateTask = (task, store, availableView) => {
  const signedUp = !!store.taskSignups[task.id];
  const volunteersConfirmed = (task.volunteersConfirmed || 0) + (signedUp && !task.signedUp ? 1 : 0);
  const out = { ...task, volunteersConfirmed };
  if (availableView) {
    const max = task.maxVolunteers;
    out.signedUp = signedUp || task.signedUp || false;
    out.hasRoom = max == null || volunteersConfirmed < max;
    if (!out.organization) {
      const user = storedUser();
      out.organization = { id: user?.id ?? null, organizationName: user?.organizationName || user?.name || null };
    }
  }
  return out;
};

// Subtract simulated allocations from each resource's on-hand quantity so the
// inventory (and the "Resources Available" pill) reflect what's been committed.
const overlayResources = (payload, store) => {
  const list = overlayCollection(payload.data, store.resources);
  const deletedAlloc = new Set(store.allocations.deletes);
  const usedByResource = {};
  store.allocations.creates
    .filter((a) => !deletedAlloc.has(a.id))
    .forEach((a) => {
      usedByResource[a.resourceId] = (usedByResource[a.resourceId] || 0) + (Number(a.quantity) || 0);
    });
  const adjusted = list.map((r) => {
    const used = usedByResource[r.id] || 0;
    if (!used) return r;
    const remaining = Math.max(0, (Number(r.quantity) || 0) - used);
    const explicitlyOff = store.resources.updates[r.id]?.available === false;
    return { ...r, quantity: remaining, available: explicitlyOff ? false : remaining > 0 };
  });
  return { ...payload, data: adjusted };
};

// Merge simulated allocations for one request into its allocation list.
const overlayAllocations = (url, payload, store) => {
  const requestId = allocCreateRequestId(url);
  const deleted = new Set(store.allocations.deletes);
  const server = payload.data.filter((a) => !deleted.has(a.id));
  const preview = store.allocations.creates.filter((a) => a.requestId === requestId && !deleted.has(a.id));
  return { ...payload, data: [...preview, ...server] };
};

// Build the extra rows a dashboard "your assigned requests" / "my interests"
// list needs from simulated assignments/interests, hydrated from the request
// cache and annotated the way the backend dashboards annotate a Response.
const overlayResponseList = (payload, store, sourceMap, statusFor) => {
  const s = store.requests;
  const deletes = new Set(s.deletes);
  const withEdits = (r) => (s.updates[r.id] ? { ...r, ...s.updates[r.id] } : r);
  const serverIds = new Set(payload.data.map((r) => r.id));
  const kept = payload.data.filter((r) => !deletes.has(r.id)).map(withEdits);
  // Hydrate added rows from the request cache OR from preview-created requests
  // (which live in requests.creates, not the cache).
  const lookup = (id) =>
    store.requestCache[id] || store.requests.creates.find((r) => r.id === id) || null;
  const added = Object.keys(sourceMap)
    .filter((id) => sourceMap[id] && !serverIds.has(id) && !deletes.has(id))
    .map(lookup)
    .filter(Boolean)
    .map((r) => ({
      ...withEdits(r),
      responseId: `preview-resp-${r.id}`,
      responseStatus: statusFor(r.id),
      respondedAt: nowIso(),
      notes: null,
    }));
  return { ...payload, data: [...added, ...kept] };
};

// Layer the session overlay onto a GET response's data. Only applied while
// Preview is active. Also caches request/resource objects it sees, so lists that
// receive only an id can still render full cards.
export const applyPreviewOverlay = (url, payload) => {
  if (!isPreviewMode()) return payload;
  if (!payload || payload.data == null) return payload;

  const u = String(url);
  const store = readStore();

  // Cache full objects from list responses for later hydration.
  if (Array.isArray(payload.data)) {
    let dirty = false;
    if (isRequestListUrl(u) || isOrgDashboardUrl(u) || isVolunteerDashboardUrl(u)) {
      payload.data.forEach((r) => {
        if (r && r.id) { store.requestCache[r.id] = { ...r }; dirty = true; }
      });
    } else if (isResourceCollection(u) && !u.includes('/requests/')) {
      payload.data.forEach((r) => {
        if (r && r.id) { store.resourceCache[r.id] = { ...r }; dirty = true; }
      });
    }
    if (dirty) writeStore(store);
  }

  // Requests (list + single).
  if (isRequestListUrl(u) && Array.isArray(payload.data)) {
    return overlayRequestList(payload, store);
  }

  // Org's assigned requests / volunteer's interests.
  if (isOrgDashboardUrl(u) && Array.isArray(payload.data)) {
    return overlayResponseList(payload, store, store.assignments, () => 'accepted');
  }
  if (isVolunteerDashboardUrl(u) && Array.isArray(payload.data)) {
    return overlayResponseList(payload, store, store.interests, (id) => store.interests[id]);
  }

  // Volunteer tasks.
  if (isAvailableTasks(u) && Array.isArray(payload.data)) {
    const list = overlayCollection(payload.data, store.tasks).map((t) => decorateTask(t, store, true));
    const visible = list.filter((t) => t.status === 'open' && (t.hasRoom || t.signedUp));
    return { ...payload, data: visible };
  }
  if (isTaskCollection(u) && Array.isArray(payload.data)) {
    const list = overlayCollection(payload.data, store.tasks).map((t) => decorateTask(t, store, false));
    return { ...payload, data: list };
  }

  // Resource allocations (checked before the resource collection).
  if (allocCreateRequestId(u) && Array.isArray(payload.data)) {
    return overlayAllocations(u, payload, store);
  }
  if (isResourceCollection(u) && !u.includes('/requests/') && Array.isArray(payload.data)) {
    return overlayResources(payload, store);
  }

  // Single request object.
  const req = parseRequestUrl(u);
  if (req.id && !req.action && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const edit = store.requests.updates[req.id];
    return edit ? { ...payload, data: { ...payload.data, ...edit } } : payload;
  }

  return payload;
};
