import { request as playwrightRequest } from '@playwright/test';
import { test as base, expect } from './fixtures.js';
import { signup, uniqueEmail } from './helpers/auth.js';

const API = process.env.E2E_API_URL || 'http://localhost:3000';

// Delete every request this suite creates (marked descriptions), out-of-band via
// the seeded admin, so re-runs don't accumulate rows in the shared dev DB and
// leave the seed volunteer signed up — which pollutes the feed-count assertions
// in the other specs. Mirrors the suite's idempotency discipline (the resource
// test removes its row; the profile test restores its edit).
async function cleanupLifecycleRequests() {
  const api = await playwrightRequest.newContext();
  try {
    const loginRes = await api.post(`${API}/api/auth/login`, {
      data: { email: 'admin', password: 'admin', role: 'admin' },
    });
    const token = (await loginRes.json())?.data?.token;
    if (!token) return; // No admin seeded — nothing we can clean up.

    const listRes = await api.get(`${API}/api/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rows = (await listRes.json())?.data || [];
    const mine = rows.filter((r) => String(r.description || '').includes('e2e-lifecycle-'));
    for (const r of mine) {
      await api.delete(`${API}/api/requests/${r.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } finally {
    await api.dispose();
  }
}

// The request lifecycle — the app's core demo loop, end-to-end across three
// roles:
//   help-seeker submits a request
//     -> it appears in the volunteer feed
//     -> volunteer clicks "I can help with this" (request -> assigned)
//     -> org assigns it and advances its status
//     -> volunteer "Mark as helped" (request -> completed)
//
// This drives the REAL app against the real backend, so each step's write is
// visible to the next role. Selectors are the app's visible English text.
//
// Finding OUR request among shared dev data:
//   - The volunteer feed + Tasks view are searchable / show the description, so
//     we tag the description with a unique run marker and search for it.
//   - The org requests table has no search and shows only the submitter's NAME,
//     so we register a fresh help-seeker with a unique display name and locate
//     the row by that name.

// We need the plain `page` (fresh help-seeker signup UI) plus the signed-in
// volunteer/org fixtures in one test, so extend the fixture-aware `test`.
const test = base;

test.describe('request lifecycle', () => {
  // Long, multi-role flow with real API round-trips; give it room beyond the
  // 45s per-test default.
  test.setTimeout(120_000);

  // Remove this run's request(s) afterward so the shared dev DB doesn't grow and
  // the seed volunteer isn't left signed up across runs.
  test.afterEach(cleanupLifecycleRequests);

  test('a request flows from help-seeker submission to volunteer "helped"', async ({
    page,
    volunteerPage,
    orgPage,
  }) => {
    const stamp = process.hrtime.bigint().toString();
    const seekerName = `Lifecycle Seeker ${stamp}`;
    const marker = `e2e-lifecycle-${stamp}`;
    const description = `${marker} water and canned food for a family`;

    // --- 1. Help-seeker submits a request ----------------------------------
    await signup(page, 'help-seeker', {
      email: uniqueEmail('lifecycle'),
      name: seekerName,
    });
    await expect(page).toHaveURL(/\/requests\/new/);

    await page.getByRole('button', { name: 'Make New Request' }).click();
    await expect(page.getByRole('heading', { name: 'Request Help' })).toBeVisible();

    // Category is a checkbox per category; checking one reveals a per-category
    // urgency <select> (aria-label "<Category> Urgency").
    await page.getByLabel('Food', { exact: true }).check();
    await page.getByRole('combobox', { name: 'Food Urgency' }).selectOption('Critical');
    await page.getByLabel('Location').fill('Austin, TX');
    await page.getByLabel('People in Household').fill('4');
    await page.getByLabel('Description').fill(description);

    await page.getByRole('button', { name: 'Submit Request' }).click();
    // The success banner is transient (the modal auto-closes on create), so
    // assert on the stable result: the form modal closed and the new request
    // now shows in the help-seeker's "Active Requests" list.
    await expect(page.getByRole('heading', { name: 'Request Help' })).toHaveCount(0);
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Food' }).filter({ hasText: 'Critical' }),
    ).toBeVisible();

    // --- 2. It appears in the volunteer feed; volunteer offers to help ------
    await volunteerPage.getByRole('button', { name: 'Requests' }).first().click();
    await expect(
      volunteerPage.getByRole('heading', { name: 'Active Help Requests' }),
    ).toBeVisible();
    // Cards view exposes the full "I can help with this" button per card.
    await volunteerPage.getByRole('button', { name: 'Cards' }).click();

    // Search narrows the feed to just our marked request.
    await volunteerPage
      .getByRole('searchbox', { name: 'Search requests by keyword' })
      .fill(marker);
    const card = volunteerPage.getByRole('article').filter({ hasText: marker });
    await expect(card).toHaveCount(1);

    await card.getByRole('button', { name: 'I can help with this' }).click();
    // The card flips to the signed-up state (no confirmation dialog).
    await expect(card.getByText('✓ Signed up')).toBeVisible();

    // --- 3. Org assigns the request and advances its status ----------------
    // Playwright instantiates all fixtures up front, so orgPage fetched its
    // request list before this run's request existed. Reload for fresh data.
    await orgPage.reload();
    await orgPage.getByRole('button', { name: 'Requests' }).first().click();
    await expect(
      orgPage.getByRole('heading', { name: 'Help Request Details' }).or(
        orgPage.getByText('Select a request to see its details.'),
      ),
    ).toBeVisible();

    // The row is a <button> labeled with the submitter's (unique) name. After
    // the volunteer expressed interest the request is "assigned" (not yet to any
    // org), so it lives in the "Unfiltered Requests" table.
    const orgRow = orgPage.getByRole('button').filter({ hasText: seekerName });
    await expect(orgRow.first()).toBeVisible();
    await orgRow.first().click();

    // Assign it to this org, then move status forward via the detail dropdown.
    await orgPage.getByRole('button', { name: 'Assign to us' }).click();
    await expect(orgPage.getByText('Assigned to your organization')).toBeVisible();

    await orgPage.getByLabel('Status').selectOption('in-progress');
    // The assign/unassign button confirms the request is now the org's.
    await expect(orgPage.getByRole('button', { name: 'Unassign from us' })).toBeVisible();

    // --- 4. Volunteer marks the request as helped --------------------------
    await volunteerPage.getByRole('button', { name: 'Tasks' }).first().click();
    await expect(volunteerPage.getByRole('heading', { name: 'Your requests' })).toBeVisible();

    // The Tasks view shows requests this volunteer offered to help with; scope
    // to ours by the description marker. Note the "Mark as helped" button is a
    // SIBLING of the RequestCard <article> (both inside a wrapper div), so scope
    // to the wrapper (the article's parent), not the article itself.
    const taskCard = volunteerPage
      .getByRole('article')
      .filter({ hasText: marker })
      .locator('..');
    await expect(taskCard).toHaveCount(1);
    await taskCard.getByRole('button', { name: 'Mark as helped' }).click();
    await expect(taskCard.getByText('✓ Helped')).toBeVisible();
  });
});
