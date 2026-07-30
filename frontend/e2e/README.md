# End-to-end tests (Playwright)

Browser-driven E2E coverage for MapResponse, tracking the two testing issues:

- **#94** — `filters-search-dashboards.spec.js`: role dashboards + navigation,
  category/urgency filters, keyword search, result counts.
- **#123** — `maps-radius-profiles-resources.spec.js`: map view (pins/heatmap),
  "Near me" radius, notification bell, profile/settings edits, org resources.
- `smoke.spec.js` — the app loads and signup/login works for every role.

These drive the **real** app against a **real** backend + Postgres — there is no
network mocking. The suite seeds its own data (see below), so it needs the full
local stack running.

## Prerequisites (the local stack)

1. **Postgres** running and migrated, with the demo admin seeded:
   ```bash
   cd backend
   npx prisma migrate deploy
   node prisma/seedAdmin.js
   ```
2. **Backend** on `http://localhost:3000`, with rate limiting disabled so a full
   suite of signups/logins doesn't trip the auth limiter (20 attempts / 15 min):
   ```bash
   cd backend
   npm run dev:e2e          # = DISABLE_RATE_LIMIT=1 nodemon server.js
   ```
   `DISABLE_RATE_LIMIT` is an explicit, off-by-default opt-out — production and
   normal `npm run dev` keep full rate limiting. Never set it in production.
3. **Frontend** on `http://localhost:5173` (Playwright will auto-start Vite via
   its `webServer` block if it isn't already up, but the backend + DB it must be
   started manually).

## Running

```bash
cd frontend
npm run test:e2e                       # all specs, chromium (desktop viewport)
npm run test:e2e -- smoke.spec.js      # one file
npm run test:e2e:ui                    # interactive UI mode
npm run test:e2e:report                # open the last HTML report
```

These specs run on a **desktop** viewport. A mobile project is intentionally
omitted: below the `lg` breakpoint the portal sidebar collapses to icon-only
buttons with no accessible name, so nav-by-label doesn't work on small screens —
a real responsiveness gap tracked by the mobile issues (#129–#131). Add
mobile-viewport E2E there, once the responsive nav lands.

## How it works

- **`global-setup.js`** runs once before the suite. It (a) seeds a known catalog
  of help requests via the backend API — Food/Critical, Medical/High,
  Shelter/Medium, Transport/Low, each tagged `[e2e-seed]` — and (b) creates one
  account per role, logs in via the API, and writes a Playwright `storageState`
  per role to `e2e/.auth/` (gitignored).
- **`fixtures.js`** exposes `volunteerPage` / `orgPage` / `helpSeekerPage`
  fixtures: a page that starts already signed in for that role (loaded from the
  saved `storageState`). This avoids clicking through the UI login in every test
  — faster, and it keeps auth calls well under the rate limit. Tests that must
  exercise the real signup/login UI use the plain `page` fixture (see
  `smoke.spec.js`).
- **Selectors** are the app's visible (English) text — the app has no
  `data-testid` attributes. All UI strings come from `src/i18n/en.json`.
- **Maps** load Leaflet + OSM tiles + a large county-geometry file async, and
  markers are non-semantic divs, so the map tests assert on the stable
  surrounding UI (Pins/Heatmap toggle, legend, "Near me" state, match counts),
  not on individual pins. Geolocation is granted and mocked to Austin, TX.

## Idempotency

Safe to run repeatedly against the same database: request seeding is skipped
when this run's marked rows already exist, role accounts are reused, and the
resource test removes the row it creates. The one profile test restores the
display name it edits.
