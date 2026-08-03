import { test, expect } from './fixtures.js';

// i18n language switch — one test that flips the UI to Español and asserts a
// heading actually changed. This catches missing/broken translation keys, which
// otherwise silently fall back to English and go unnoticed.
//
// Findings that shape this test:
//   - There is NO language switcher on the public landing page. The only one
//     lives behind auth, in the portal Settings view (a native <select id=
//     "language"> labeled "Language"). So we use a signed-in role fixture.
//   - The switch is NOT pure client-side: handleChangeLanguage calls
//     updateLanguage(), which awaits a PATCH to the profile endpoint BEFORE
//     calling i18n.changeLanguage. If that request fails the UI stays English.
//     We run against the real backend (the volunteer fixture is a real account),
//     so the profile update succeeds and the switch takes effect.
//   - The switch is instant (no page reload) and persists to localStorage
//     under the key "language".

test.describe('i18n', () => {
  test('switching to Español translates the Settings view', async ({ volunteerPage: page }) => {
    await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click();

    // English heading first (the section <h2>, not the top-bar page title).
    await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();

    // Native <select> labeled "Language"; select by the ISO value, not the
    // visible option text.
    await page.getByLabel('Language').selectOption('es');

    // The heading re-renders in Spanish: settings.title = "Configuración".
    await expect(page.getByRole('heading', { level: 2, name: 'Configuración' })).toBeVisible();
    // The English heading is gone — proves the key actually flipped.
    await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toHaveCount(0);

    // The choice is persisted on this device.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('language')))
      .toBe('es');

    // Restore English so the shared account is left as we found it.
    await page.getByLabel('Idioma').selectOption('en');
    await expect(page.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible();
  });
});
