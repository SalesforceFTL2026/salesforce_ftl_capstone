import { test, expect, request as playwrightRequest } from '@playwright/test';

// Admin preview mode (/admin) — verify that "preview" writes don't persist.
//
// Preview mode is a purely CLIENT-SIDE demo safety net: the axios request
// interceptor short-circuits write methods (POST/PUT/PATCH/DELETE) so they never
// reach the backend, and layers a session-only overlay onto subsequent GETs so
// the UI still reflects the change. The backend has zero awareness of it.
//
// The admin dashboard has no UI sign-in path — it's reached by seeding the
// demo admin (admin/admin), logging in via the API, and injecting the session
// into sessionStorage (per-tab) before navigating to /admin. The preview flag
// lives separately in localStorage under "adminPreviewMode" (on unless "off").
//
// Verifying "no persist" is subtle: re-fetching THROUGH the app tab re-injects
// the overlay and looks persisted. So we verify against the real database
// out-of-band, with a raw API client (not the app's axios), using a fresh admin
// token.

const API = process.env.E2E_API_URL || 'http://localhost:3000';
const ADMIN = { email: 'admin', password: 'admin', role: 'admin' };

// Log in the seeded admin via the API and return { token, user }.
async function adminSession(api) {
  const res = await api.post(`${API}/api/auth/login`, { data: ADMIN });
  const body = await res.json();
  const token = body?.data?.token;
  const user = body?.data?.user;
  if (!token || !user) {
    throw new Error(
      `admin login failed — is the demo admin seeded (node prisma/seedAdmin.js)? ${JSON.stringify(body)}`,
    );
  }
  return { token, user };
}

// Count requests in the real DB, out-of-band, with a raw token (bypasses the
// app's preview overlay entirely).
async function dbRequestCount(api, token) {
  const res = await api.get(`${API}/api/requests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return (body?.data || []).length;
}

test.describe('admin preview mode', () => {
  test('a preview-mode create does not persist to the database', async ({ browser }) => {
    // Raw API client for setup + out-of-band verification.
    const api = await playwrightRequest.newContext();
    const { token, user } = await adminSession(api);

    // Baseline: how many requests exist in the real DB right now.
    const before = await dbRequestCount(api, token);

    // Open /admin already authenticated as admin, with preview mode ON.
    const context = await browser.newContext();
    await context.addInitScript(
      ([t, u]) => {
        sessionStorage.setItem('token', t);
        sessionStorage.setItem('user', u);
        // On by default anyway, but be explicit so the test is self-describing.
        localStorage.setItem('adminPreviewMode', 'on');
      },
      [token, JSON.stringify(user)],
    );
    const page = await context.newPage();
    await page.goto('/admin');

    // The preview banner confirms we're in the non-persisting mode.
    await expect(
      page.getByText('Preview only — changes you make here are NOT saved to the database.'),
    ).toBeVisible();

    // Switch to the Help Seeker persona and create a request through the real
    // form — the write is what preview mode must intercept.
    await page.getByRole('button', { name: 'Help Seeker' }).click();
    await page.getByRole('button', { name: 'Make New Request' }).click();
    await expect(page.getByRole('heading', { name: 'Request Help' })).toBeVisible();

    const marker = `e2e-preview-${process.hrtime.bigint()}`;
    await page.getByLabel('Food', { exact: true }).check();
    await page.getByRole('combobox', { name: 'Food Urgency' }).selectOption('High');
    await page.getByLabel('Location').fill('Austin, TX');
    await page.getByLabel('People in Household').fill('2');
    await page.getByLabel('Description').fill(`${marker} preview should not persist`);
    await page.getByRole('button', { name: 'Submit Request' }).click();

    // Preview returns a synthetic success, so the create "succeeds" client-side:
    // the form modal closes (a validation/real failure would keep it open with an
    // error). The success banner itself is too transient to assert on — the modal
    // auto-closes the moment onCreated fires.
    await expect(page.getByRole('heading', { name: 'Request Help' })).toHaveCount(0);

    await context.close();

    // The real DB is unchanged: same count, and no row carrying our marker.
    const after = await dbRequestCount(api, token);
    expect(after).toBe(before);

    const listRes = await api.get(`${API}/api/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = (await listRes.json())?.data || [];
    const leaked = list.filter((r) => String(r.description || '').includes(marker));
    expect(leaked).toHaveLength(0);

    await api.dispose();
  });
});
