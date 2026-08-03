import { test, expect } from '@playwright/test';
import { openLogin, openSignup, signup, uniqueEmail, TEST_PASSWORD } from './helpers/auth.js';

// Auth edge cases — the front door. These exercise the REAL signup/login UI
// (the plain `page` fixture, like smoke.spec.js) rather than the injected-session
// fixtures, because the whole point is the validation and error paths.
//
// All auth errors render INLINE inside the modal as <p role="alert"> (never
// toasts). Wrong-password + duplicate-email messages come straight from the
// backend response; the password-policy messages are enforced on the frontend
// (RoleSelectionModal.handleSubmit returns early) and are byte-identical to the
// backend's. Selectors are the app's visible English text (no data-testid).

test.describe('login errors', () => {
  test('wrong password shows a generic invalid-credentials error', async ({ page }) => {
    // Create a real account, then try to log in with the wrong password.
    const creds = await signup(page, 'volunteer', { email: uniqueEmail('wrongpw') });
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    const m = await openLogin(page, 'volunteer');
    await m.getByPlaceholder('you@example.com').fill(creds.email);
    await m.getByPlaceholder('Enter your password').fill('WrongPass9999');
    await m.getByRole('button', { name: 'Sign in' }).click();

    // Deliberately generic (same for bad email or bad password), returned by
    // the backend 401 and surfaced verbatim in the modal.
    await expect(m.getByRole('alert')).toHaveText('Invalid email or password.');
    // A failed login never reaches the volunteer dashboard.
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe('signup errors', () => {
  test('a duplicate email for the same role is rejected', async ({ page }) => {
    // Register an account, then attempt a second signup with the same
    // (email, role) pair — the unique constraint the backend enforces.
    const email = uniqueEmail('dupe');
    await signup(page, 'help-seeker', { email });
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    const m = await openSignup(page, 'help-seeker');
    await m.getByPlaceholder('Enter your name').fill('Dupe Tester');
    await m.getByPlaceholder('you@example.com').fill(email);
    await m.getByPlaceholder(/chars, with a capital/).fill(TEST_PASSWORD);
    await m.getByPlaceholder('City, State or Zip Code').fill('Austin, TX');
    await m.getByRole('button', { name: 'Continue' }).click();

    await expect(m.getByRole('alert')).toHaveText(
      'An account with this email already exists for this role.',
    );
    await expect(page).not.toHaveURL(/\/requests\/new/);
  });

  test('the same email is allowed for a different role', async ({ page }) => {
    // (email, role) is unique — the SAME email can hold a separate account per
    // role. This guards against an over-broad unique-on-email constraint.
    const email = uniqueEmail('cross-role');
    await signup(page, 'help-seeker', { email });
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // Same email, different role (volunteer) should succeed and land on /dashboard.
    const creds = await signup(page, 'volunteer', { email });
    expect(creds.email).toBe(email);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('a too-short password is rejected by the 12-char policy', async ({ page }) => {
    const m = await openSignup(page, 'help-seeker');
    await m.getByPlaceholder('Enter your name').fill('Shorty');
    await m.getByPlaceholder('you@example.com').fill(uniqueEmail('shortpw'));
    await m.getByPlaceholder(/chars, with a capital/).fill('Short1A');
    await m.getByPlaceholder('City, State or Zip Code').fill('Austin, TX');
    await m.getByRole('button', { name: 'Continue' }).click();

    // Length is checked before complexity, so a short password hits this first.
    await expect(m.getByRole('alert')).toHaveText(
      'Password must be at least 12 characters long.',
    );
  });

  test('a long-enough password missing a character class is rejected', async ({ page }) => {
    const m = await openSignup(page, 'help-seeker');
    await m.getByPlaceholder('Enter your name').fill('NoCaps');
    await m.getByPlaceholder('you@example.com').fill(uniqueEmail('weakpw'));
    // 16 chars, all lowercase, no uppercase/number -> passes length, fails complexity.
    await m.getByPlaceholder(/chars, with a capital/).fill('alllowercaselong');
    await m.getByPlaceholder('City, State or Zip Code').fill('Austin, TX');
    await m.getByRole('button', { name: 'Continue' }).click();

    await expect(m.getByRole('alert')).toHaveText(
      'Password must include an uppercase letter, a lowercase letter, and a number.',
    );
  });
});
