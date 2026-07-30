import { test, expect } from './fixtures.js';

// Issue #94 — E2E of filters, search, and dashboards.
//
// Global setup seeds a known catalog of requests (Food/Critical, Medical/High,
// Shelter/Medium, Transport/Low) and a signed-in session per role. These tests
// use the role-scoped page fixtures (volunteerPage / orgPage) so they start
// already authenticated and drive the real feed UI against the seeded data.
//
// Selectors are the app's visible English text (the app has no data-testid).

// Open the volunteer Requests feed in "Cards" view (RequestCard renders as an
// <article>). Returns the filter-bar locators.
async function openVolunteerFeed(page) {
  await page.getByRole('button', { name: 'Requests' }).first().click();
  await expect(page.getByRole('heading', { name: 'Active Help Requests' })).toBeVisible();
  // The default "List" view is a table; switch to "Cards" so we get <article>s.
  await page.getByRole('button', { name: 'Cards' }).click();
  return {
    search: page.getByRole('searchbox', { name: 'Search requests by keyword' }),
    category: page.getByRole('combobox', { name: 'Filter by category' }),
    urgency: page.getByRole('combobox', { name: 'Filter by urgency' }),
    cards: page.getByRole('article'),
  };
}

// --- dashboards -------------------------------------------------------------

test.describe('dashboards', () => {
  test('volunteer dashboard shows the expected sidebar navigation', async ({ volunteerPage: page }) => {
    const nav = page.getByRole('navigation');
    for (const item of ['Dashboard', 'Requests', 'Tasks', 'Skills', 'Settings']) {
      await expect(nav.getByRole('button', { name: item })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: /Hello, / })).toBeVisible();
  });

  test('organization dashboard shows its sidebar navigation', async ({ orgPage: page }) => {
    const nav = page.getByRole('navigation');
    for (const item of ['Dashboard', 'Requests', 'Tasks', 'Metrics', 'Resources', 'Settings']) {
      await expect(nav.getByRole('button', { name: item })).toBeVisible();
    }
  });

  test('volunteer can navigate between dashboard sections', async ({ volunteerPage: page }) => {
    const nav = page.getByRole('navigation');

    await nav.getByRole('button', { name: 'Requests' }).click();
    await expect(page.getByRole('heading', { name: 'Active Help Requests' })).toBeVisible();

    await nav.getByRole('button', { name: 'Skills' }).click();
    await expect(page.getByRole('heading', { name: 'My Skills' })).toBeVisible();

    await nav.getByRole('button', { name: 'Settings' }).click();
    // "Settings" appears as both the top-bar page title (h1) and the section
    // heading (h2); assert on the section heading specifically.
    await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();
  });
});

// --- filters ----------------------------------------------------------------

test.describe('filters', () => {
  test('category filter narrows the feed to the chosen category', async ({ volunteerPage: page }) => {
    const { category, cards } = await openVolunteerFeed(page);
    await expect(cards.first()).toBeVisible();

    await category.selectOption('Food');
    await expect(page.getByRole('heading', { level: 3, name: 'Food' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Medical' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 3, name: 'Shelter' })).toHaveCount(0);
  });

  test('urgency filter narrows the feed to the chosen urgency', async ({ volunteerPage: page }) => {
    const { urgency, cards } = await openVolunteerFeed(page);
    await expect(cards.first()).toBeVisible();

    await urgency.selectOption('Critical');
    await expect(page.getByRole('heading', { level: 3, name: 'Food' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Transport' })).toHaveCount(0);
  });

  test('category and urgency filters combine', async ({ volunteerPage: page }) => {
    const { category, urgency } = await openVolunteerFeed(page);
    await category.selectOption('Medical');
    await urgency.selectOption('High');
    await expect(page.getByRole('heading', { level: 3, name: 'Medical' }).first()).toBeVisible();

    // A combination with no matching seeded request yields an empty feed.
    await urgency.selectOption('Low');
    await expect(page.getByRole('heading', { level: 3, name: 'Medical' })).toHaveCount(0);
  });

  test('clearing filters restores the full feed', async ({ volunteerPage: page }) => {
    const { category, cards } = await openVolunteerFeed(page);
    const initial = await cards.count();

    await category.selectOption('Food');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('combobox', { name: 'Filter by category' })).toHaveValue('');
    await expect(cards).toHaveCount(initial);
  });
});

// --- search -----------------------------------------------------------------

test.describe('search', () => {
  test('keyword search matches request descriptions (debounced)', async ({ volunteerPage: page }) => {
    const { search } = await openVolunteerFeed(page);

    // "insulin" only appears in the seeded Medical request's description.
    await search.fill('insulin');
    await expect(page.getByRole('heading', { level: 3, name: 'Medical' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Food' })).toHaveCount(0);
  });

  test('a search with no matches shows an empty feed', async ({ volunteerPage: page }) => {
    const { search, cards } = await openVolunteerFeed(page);
    await search.fill('zzz-nonexistent-keyword-zzz');
    await expect(cards).toHaveCount(0);
  });

  test('the result count reflects the active search', async ({ volunteerPage: page }) => {
    const { search } = await openVolunteerFeed(page);
    await search.fill('insulin');
    await expect(page.getByRole('status')).toContainText('matching');
  });
});
