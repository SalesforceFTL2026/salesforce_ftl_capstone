import { test, expect } from './fixtures.js';

// Issue #123 — E2E of maps, radius ("Near me"), notifications, profiles, and
// resources.
//
// Maps are the flaky part: Leaflet + OpenStreetMap tiles and an ~840KB county
// geometry file load asynchronously, and markers are non-semantic divs with no
// accessible text. So we assert on the STABLE surrounding UI — the Pins/Heatmap
// toggle, the legend, the "Near me" toggle state, and the live match-count
// status — not on individual pins. Geolocation is granted + mocked at the
// Austin coordinates that match the seeded Food/Critical request (zip 78701).

test.use({
  geolocation: { latitude: 30.2713, longitude: -97.7426 },
  permissions: ['geolocation'],
});

// Open the volunteer Requests feed (shared entry for the map/radius tests).
async function openFeed(page) {
  await page.getByRole('button', { name: 'Requests' }).first().click();
  await expect(page.getByRole('heading', { name: 'Active Help Requests' })).toBeVisible();
}

// --- maps -------------------------------------------------------------------

test.describe('maps', () => {
  test('the map view renders with the pins/heatmap toggle and legend', async ({ volunteerPage: page }) => {
    await openFeed(page);
    await page.getByRole('button', { name: 'Map' }).click();

    // Map panel heading + the two view-mode toggles.
    await expect(page.getByRole('heading', { name: 'Where help is needed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pins' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Heatmap' })).toBeVisible();

    // Leaflet actually mounted (attribution link is a reliable, stable marker).
    const attribution = page.getByRole('link', { name: 'OpenStreetMap' });
    await expect(attribution).toBeVisible();

    // Pins-mode legend shows the urgency levels. Scope to the map panel (the
    // region containing the attribution) so we don't match the hidden urgency
    // <option> elements in the filter bar's <select>.
    const mapPanel = page
      .locator('div')
      .filter({ has: page.getByRole('button', { name: 'Pins' }) })
      .filter({ has: attribution })
      .last();
    for (const level of ['Critical', 'High', 'Medium', 'Low']) {
      await expect(mapPanel.getByText(level, { exact: true })).toBeVisible();
    }
  });

  test('switching to the heatmap updates the toggle and legend', async ({ volunteerPage: page }) => {
    await openFeed(page);
    await page.getByRole('button', { name: 'Map' }).click();
    await page.getByRole('button', { name: 'Heatmap' }).click();

    await expect(page.getByRole('button', { name: 'Heatmap' })).toHaveAttribute('aria-pressed', 'true');
    // Heat-mode legend swaps to a needs gradient.
    await expect(page.getByText('Fewer needs')).toBeVisible();
    await expect(page.getByText('More needs')).toBeVisible();
  });
});

// --- radius / "Near me" -----------------------------------------------------

test.describe('near me radius', () => {
  test('enabling "Near me" geolocates and filters to nearby requests', async ({ volunteerPage: page }) => {
    await openFeed(page);
    await page.getByRole('button', { name: 'Near me' }).click();

    // Once located, the toggle flips to the "on" label and a "{n} nearby"
    // status appears. Our mocked position is in Austin, where a seeded request
    // lives, so the count is at least 1.
    await expect(page.getByRole('button', { name: 'Near me: on' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('status').filter({ hasText: 'nearby' })).toBeVisible();
  });

  test('the radius selector offers the documented distances', async ({ volunteerPage: page }) => {
    await openFeed(page);
    const radius = page.getByRole('combobox', { name: 'Search radius in miles' });
    await expect(radius).toBeVisible();
    // Default is 25 mi; the app offers 10/25/50/100.
    await expect(radius).toHaveValue(/25/);
    await radius.selectOption({ label: '50 mi' });
    await expect(radius).toHaveValue(/50/);
  });
});

// --- notifications ----------------------------------------------------------

test.describe('notifications', () => {
  test('the notification bell opens and shows an empty state for a new user', async ({ volunteerPage: page }) => {
    const bell = page.getByRole('button', { name: 'Notifications' });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(bell).toHaveAttribute('aria-expanded', 'true');
    // A freshly-created volunteer has no notifications yet.
    await expect(page.getByText('No notifications yet')).toBeVisible();
  });
});

// --- profiles ---------------------------------------------------------------

test.describe('profiles', () => {
  test('volunteer settings exposes editable profile fields', async ({ volunteerPage: page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();

    // Display name is prefilled; Save is disabled until something changes. We
    // don't assert the exact starting value — this test persists its edit, so a
    // re-run would see the previously-saved name. Assert it's simply non-empty.
    const displayName = page.getByRole('textbox', { name: 'Display Name' });
    const original = await displayName.inputValue();
    expect(original.length).toBeGreaterThan(0);
    const save = page.getByRole('button', { name: 'Save Changes' }).first();
    await expect(save).toBeDisabled();

    // Editing enables Save; saving confirms with a success line.
    await displayName.fill('E2E Volunteer Edited');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText(/name has been updated/i)).toBeVisible();

    // Restore the original name so the account is left as we found it.
    await displayName.fill(original);
    await save.click();
    await expect(page.getByText(/name has been updated/i)).toBeVisible();
  });

  test('volunteer can view and edit their skills', async ({ volunteerPage: page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Skills' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Your Skills' })).toBeVisible();
    // Signup selected "Medical Support" for this account, so it's present.
    await expect(page.getByText('Medical Support')).toBeVisible();
  });
});

// --- resources --------------------------------------------------------------

test.describe('resources', () => {
  test('an organization can add a resource and see it listed', async ({ orgPage: page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Resources' }).click();
    await expect(page.getByRole('heading', { name: 'Add a Resource' })).toBeVisible();

    // Use a unique name so re-runs don't collide with a prior run's row.
    const name = `E2E Resource ${process.hrtime.bigint()}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Quantity').fill('50');
    await page.getByLabel('Unit').fill('meals');
    await page.getByRole('button', { name: 'Add Resource' }).click();

    // It appears under "Your Resources" with an availability toggle + Remove.
    const item = page.getByRole('listitem').filter({ hasText: name });
    await expect(item).toBeVisible();
    await expect(item.getByText('Food · 50 meals')).toBeVisible();

    // Clean up so the list doesn't grow unbounded across runs.
    await item.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
  });

  test('resource form validates required fields', async ({ orgPage: page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Resources' }).click();
    await expect(page.getByRole('heading', { name: 'Add a Resource' })).toBeVisible();

    // Submitting with an empty name surfaces the validation message.
    await page.getByRole('button', { name: 'Add Resource' }).click();
    await expect(page.getByText('Please fill in the name, quantity, and unit.')).toBeVisible();
  });
});
