import { test, expect } from '@playwright/test';
import { signup, login, uniqueEmail } from './helpers/auth.js';

// Smoke tests: the app loads, and auth works for every role. These are the
// foundation the filter/search/dashboard (#94) and map/profile (#123) specs
// build on — if auth breaks, everything else is noise.

test('landing page renders the role entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'I NEED HELP' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I WANT TO VOLUNTEER' })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'M AN ORGANIZATION" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SIGN IN' })).toBeVisible();
});

test('a help-seeker can sign up and land on their dashboard', async ({ page }) => {
  await signup(page, 'help-seeker');
  await expect(page).toHaveURL(/\/requests\/new/);
});

test('a volunteer can sign up (with a skill) and land on the feed', async ({ page }) => {
  await signup(page, 'volunteer');
  await expect(page).toHaveURL(/\/dashboard/);
});

test('an organization can sign up and land on its dashboard', async ({ page }) => {
  await signup(page, 'organization');
  await expect(page).toHaveURL(/\/organization/);
});

test('a returning user can log back in', async ({ page }) => {
  // Create an account, sign out (clear the session), then log in fresh. The app
  // keeps the login in sessionStorage, so clear that (and localStorage, which
  // holds ancillary flags) to fully simulate a signed-out return visit.
  const creds = await signup(page, 'volunteer', { email: uniqueEmail('return') });
  await page.context().clearCookies();
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  await login(page, creds);
  await expect(page).toHaveURL(/\/dashboard/);
});

// Note: the admin dashboard (/admin) has no UI sign-in path — the header SIGN IN
// menu only offers the three user roles. Admin is reached by seeding the account
// and authenticating directly, so it's out of scope for these user-flow specs.
