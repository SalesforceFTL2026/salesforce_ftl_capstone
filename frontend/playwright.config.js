import { defineConfig, devices } from '@playwright/test';

// E2E config for the MapResponse frontend.
//
// These tests drive the real React app against a real backend + Postgres, so
// before running them you need the full local stack up:
//
//   backend/   npm run dev        (API on http://localhost:3000)
//   frontend/  npm run dev        (Vite on http://localhost:5173)
//   Postgres   migrated + `node prisma/seedAdmin.js`  (admin/admin account)
//
// The `webServer` block below will auto-start Vite if it isn't already running
// (reuseExistingServer), but it does NOT start the backend or database — those
// must be up first, or the flows that hit the API will fail. See e2e/README.md.

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  // Seed a known catalog of help requests (via the backend API) before the
  // suite so filter/search/map specs assert against deterministic data.
  globalSetup: './e2e/global-setup.js',
  // Requests hit a real API + LLM fallbacks, so give actions room; still fail
  // fast enough that a hung dev server doesn't stall CI forever.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // Local dev iterates fastest serially; CI can parallelize but data-mutating
  // flows (signup, request creation) share one DB, so keep workers modest.
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // NOTE: these specs (issues #94 / #123) cover functional flows on a desktop
    // viewport. A mobile project is intentionally omitted: below the `lg`
    // breakpoint the portal sidebar collapses to icon-only buttons with no
    // accessible name, so nav-by-label doesn't work on small screens. That's a
    // real responsiveness gap tracked by the mobile issues (#129–#131) — the
    // place to add mobile-viewport E2E once those land, not here.
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
