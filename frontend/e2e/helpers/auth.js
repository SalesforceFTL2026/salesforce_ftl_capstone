// Auth helpers for E2E specs.
//
// The app has no data-testid attributes, so we drive the real UI by its
// visible (English) text — the same strings live in src/i18n/en.json. Every
// account is scoped to a role: one email can hold a separate account per role,
// so signup/login always pick a role first.
//
// Signup path (landing role card -> AuthModal "Sign Up" tab):
//   - "I NEED HELP" / "I WANT TO VOLUNTEER" / "I'M AN ORGANIZATION"
//   - fields: Name, Email, Password (+ Location, Skills depending on role)
//   - submit: "Continue"  (password policy: 12+ chars, upper, lower, number)
// Login path (header "SIGN IN" menu -> role -> AuthModal "Log In" tab):
//   - fields: Email ("you@example.com"), Password ("Enter your password")
//   - submit: "Sign in"

import { expect } from '@playwright/test';

// Password that satisfies the signup policy (12+ chars, upper, lower, number).
export const TEST_PASSWORD = 'TestPass1234';

// The seeded demo admin (see backend/prisma/seedAdmin.js). admin/admin.
export const ADMIN = { email: 'admin', password: 'admin', role: 'admin' };

const ROLE_CARD = {
  'help-seeker': 'I NEED HELP',
  volunteer: 'I WANT TO VOLUNTEER',
  organization: "I'M AN ORGANIZATION",
};

const ROLE_MENU_ITEM = {
  'help-seeker': 'Help Seeker',
  volunteer: 'Volunteer',
  organization: 'Organization',
};

// Where each role lands after auth (see src/utils/roleRedirect.js).
export const ROLE_HOME = {
  'help-seeker': '/requests/new',
  volunteer: '/dashboard',
  organization: '/organization',
  admin: '/admin',
};

// Generate a unique email so re-runs never collide on the unique (email, role)
// constraint. Playwright forbids Date.now()/Math.random() in workflow scripts,
// but this is a normal test file — process.hrtime + pid is plenty unique.
export function uniqueEmail(prefix = 'e2e') {
  const stamp = `${process.pid}${process.hrtime.bigint()}`;
  return `${prefix}+${stamp}@example.com`;
}

// The auth modal is a dialog rendered over the landing page. Scope form
// interactions to it so we don't accidentally match landing-page text.
function modal(page) {
  // The modal has no role="dialog", so anchor on its tab buttons' container by
  // finding the closest positioned overlay. We locate by the Sign Up / Log In
  // tab pair which only exists inside the modal.
  return page.locator('div.fixed.inset-0.z-50').last();
}

// Open the signup modal for a role from a landing-page role card.
export async function openSignup(page, role) {
  await page.goto('/');
  await page.getByRole('button', { name: ROLE_CARD[role], exact: true }).click();
  const m = modal(page);
  await expect(m.getByRole('button', { name: 'Sign Up' })).toBeVisible();
  return m;
}

// Open the login modal for a role from the header SIGN IN menu.
export async function openLogin(page, role) {
  await page.goto('/');
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await page.getByRole('menuitem', { name: ROLE_MENU_ITEM[role] }).click();
  const m = modal(page);
  await m.getByRole('button', { name: 'Log In' }).click();
  return m;
}

// Register a brand-new account for `role` and wait until we land on their home.
// Returns the credentials so the test can log back in later if needed.
export async function signup(page, role, overrides = {}) {
  const email = overrides.email || uniqueEmail(role);
  const password = overrides.password || TEST_PASSWORD;
  const name = overrides.name || `E2E ${role}`;
  const location = overrides.location || 'Austin, TX';

  const m = await openSignup(page, role);
  // Labels carry a trailing " *", so target inputs by their (unique) placeholders.
  await m.getByPlaceholder('Enter your name').fill(name);
  await m.getByPlaceholder('you@example.com').fill(email);
  await m.getByPlaceholder(/chars, with a capital/).fill(password);

  // Location is required for every signup role.
  const locationField = m.getByPlaceholder('City, State or Zip Code');
  if (await locationField.count()) {
    await locationField.fill(location);
  }

  // Volunteers must pick at least one skill. The skills live in a collapsible
  // section; expand it (button labeled with "Skills") then click a known chip.
  if (role === 'volunteer') {
    const skillsToggle = m.getByRole('button', { name: /Skills/ }).first();
    if (await skillsToggle.count()) {
      await skillsToggle.click();
      await m.getByRole('button', { name: 'Medical Support' }).click();
    }
  }

  await m.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(new RegExp(ROLE_HOME[role].replace('/', '\\/')), { timeout: 20_000 });
  return { email, password, role, name };
}

// Log in an existing account and wait for their home route.
export async function login(page, { email, password, role }) {
  const m = await openLogin(page, role);
  await m.getByPlaceholder('you@example.com').fill(email);
  await m.getByPlaceholder('Enter your password').fill(password);
  await m.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(ROLE_HOME[role].replace('/', '\\/')), { timeout: 20_000 });
}

// Log in as the seeded demo admin.
export async function loginAsAdmin(page) {
  await login(page, ADMIN);
}
