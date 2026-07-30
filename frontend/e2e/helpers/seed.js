// Deterministic request seeding for E2E, done through the real backend API.
//
// The filter / search / map specs need known data to assert against (a Food
// Critical request in Austin, a Medical High in Miami, etc.). Rather than click
// through the help-seeker request form N times, we create a dedicated seed
// help-seeker and POST requests straight to the API. The tests then log in as a
// volunteer/org and verify the UI filters/searches/maps that same data.
//
// Every seeded request's description is tagged with a unique run marker so a
// test can scope its assertions to just this run's data and ignore anything
// left over in a shared dev database.

const API = process.env.E2E_API_URL || 'http://localhost:3000';
const SEED_PASSWORD = 'SeedPass1234';

// A stable marker for this run's seeded rows. Must be a constant (not tied to
// process.pid), because global setup and the worker processes are different
// processes and both need the same marker to seed vs. assert on the same data.
export const SEED_MARKER = '[e2e-seed]';

// The catalog of requests every run seeds. Locations are US zip codes so the
// backend geocodes them offline-ish (keyless Zippopotam) and they plot on the
// map. Kept small and varied so filter/search assertions are unambiguous.
export const SEED_REQUESTS = [
  { category: 'Food', urgency: 'Critical', location: '78701', description: 'water and canned food for a family', householdSize: 4 },
  { category: 'Medical', urgency: 'High', location: '33101', description: 'insulin and first aid supplies', householdSize: 2 },
  { category: 'Shelter', urgency: 'Medium', location: '94103', description: 'temporary shelter after flooding', householdSize: 3 },
  { category: 'Transport', urgency: 'Low', location: '10001', description: 'ride to a relief distribution center', householdSize: 1 },
];

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// Create (idempotently) a help-seeker and return a bearer token for it.
async function getSeedSeekerToken() {
  const email = 'e2e-seed-seeker@example.com';
  // Signup may 409 if the account already exists from a prior run in this
  // process — that's fine, we just log in afterward.
  await post('/api/auth/signup', {
    name: 'E2E Seed Seeker',
    email,
    password: SEED_PASSWORD,
    role: 'help-seeker',
    location: 'Austin, TX',
  });
  const { json } = await post('/api/auth/login', {
    email,
    password: SEED_PASSWORD,
    role: 'help-seeker',
  });
  const token = json?.data?.token;
  if (!token) throw new Error('E2E seed: could not obtain help-seeker token');
  return token;
}

// Seed the catalog of requests. Idempotent: if this run's marked requests are
// already present (from a prior run in the same database), it skips creating
// them again. Returns the list of this run's seeded request objects.
export async function seedRequests() {
  const token = await getSeedSeekerToken();

  // Already seeded? The seeker's own requests carry our marker.
  const existing = await get('/api/requests/my-requests', token);
  const already = (existing.json?.data || []).filter((r) =>
    String(r.description || '').includes(SEED_MARKER),
  );
  if (already.length >= SEED_REQUESTS.length) {
    return already;
  }

  const created = [];
  for (const r of SEED_REQUESTS) {
    const { status, json } = await post(
      '/api/requests',
      { ...r, description: `${SEED_MARKER} ${r.description}` },
      token,
    );
    if (!json?.success) {
      throw new Error(`E2E seed: request create failed (${status}): ${JSON.stringify(json)}`);
    }
    created.push(json.data);
  }
  return created;
}

// A persistent account per role, created once and reused across the whole run.
// Kept stable so re-runs log into the same rows instead of creating new ones.
const ROLE_ACCOUNTS = {
  'help-seeker': { email: 'e2e-helpseeker@example.com', name: 'E2E Help Seeker', location: 'Austin, TX', skills: [] },
  volunteer: { email: 'e2e-volunteer@example.com', name: 'E2E Volunteer', location: 'Austin, TX', skills: ['Medical Support'] },
  organization: { email: 'e2e-org@example.com', name: 'E2E Org', location: 'Austin, TX', skills: [] },
};

// Sign up (idempotent) and log in a role account, returning { token, user }.
// This authenticates via the API, NOT the UI, so it costs one login call per
// role per run — well under the backend's auth rate limit (20 / 15 min / IP).
export async function authRole(role) {
  const acct = ROLE_ACCOUNTS[role];
  if (!acct) throw new Error(`E2E: unknown role "${role}"`);
  await post('/api/auth/signup', {
    name: acct.name,
    email: acct.email,
    password: SEED_PASSWORD,
    role,
    location: acct.location,
    skills: acct.skills,
  });
  const { json } = await post('/api/auth/login', {
    email: acct.email,
    password: SEED_PASSWORD,
    role,
  });
  const token = json?.data?.token;
  const user = json?.data?.user;
  if (!token || !user) {
    throw new Error(`E2E: could not authenticate ${role}: ${JSON.stringify(json)}`);
  }
  return { token, user };
}

// The app persists a login in **sessionStorage** (per-tab; see
// utils/auth.persistSession), which Playwright's storageState does NOT restore.
// So instead of a storageState blob, we save the raw { token, user } and let the
// fixture inject it into sessionStorage via an init script (see fixtures.js). A
// page opened this way is already signed in — no UI login, no rate-limit hit.
export function sessionFor({ token, user }) {
  return { token, user };
}
