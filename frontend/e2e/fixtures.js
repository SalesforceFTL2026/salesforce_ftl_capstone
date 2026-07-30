import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statePath = (role) => path.join(__dirname, '.auth', `${role}.json`);

// Role-scoped page fixtures. Each opens a fresh browser context and injects the
// role's saved session (written by global-setup.js) so the test starts already
// signed in — no UI login, no auth-rate-limit pressure.
//
// The app persists a login in sessionStorage (per-tab), which Playwright's
// storageState can't restore, so we inject { token, user } via an init script
// that runs before any app code on every navigation in the context.
//
// Usage:
//   test('...', async ({ volunteerPage }) => { ... });
//
// Fall back to the plain `page` fixture for tests that must exercise the real
// signup/login UI (see smoke.spec.js).

async function pageForRole(browser, role, home, use) {
  const { token, user } = JSON.parse(readFileSync(statePath(role), 'utf-8'));
  const context = await browser.newContext();
  await context.addInitScript(
    ([t, u]) => {
      sessionStorage.setItem('token', t);
      sessionStorage.setItem('user', u);
    },
    [token, JSON.stringify(user)],
  );
  const page = await context.newPage();
  await page.goto(home);
  await use(page);
  await context.close();
}

export const test = base.extend({
  volunteerPage: async ({ browser }, use) => {
    await pageForRole(browser, 'volunteer', '/dashboard', use);
  },
  orgPage: async ({ browser }, use) => {
    await pageForRole(browser, 'organization', '/organization', use);
  },
  helpSeekerPage: async ({ browser }, use) => {
    await pageForRole(browser, 'help-seeker', '/requests/new', use);
  },
});

export { expect };
