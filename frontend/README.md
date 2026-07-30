# MapResponse — Frontend

The React (Vite) single-page app for MapResponse. See the [root README](../README.md)
for the full project overview, tech stack, and deployment details.

## Quick Start

```bash
npm install
cp .env.example .env    # set VITE_API_URL to your running backend
npm run dev             # http://localhost:5173
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the backend API (e.g. `http://localhost:3000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In client id (matches the backend's `GOOGLE_CLIENT_ID`) |

Vite inlines `VITE_*` variables at **build** time, so they must be set before
`npm run build` runs (this matters for the deployed static site).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Structure

```
src/
  pages/        Route-level screens (landing + the four dashboards; lazy-loaded)
  components/   Reusable UI, grouped by feature (portal/, map/, helpseeker/, ...)
  hooks/        Custom hooks (speech recognition/synthesis, polling)
  context/      React context providers
  services/     API-call wrappers
  utils/        API client, auth, request helpers
  i18n/         react-i18next setup + EN/ES/ZH translations
  assets/       Images and logos
```

## Notes

- **Routing & code-splitting:** the landing page loads eagerly; each dashboard is
  a lazy-loaded route chunk (see `src/App.jsx`), and heavy vendor libraries (React,
  the Leaflet map stack, i18next) are split into separate cacheable chunks (see
  `vite.config.js`).
- **API client:** `src/utils/api.js` attaches the auth token, uses a longer
  timeout for AI/speech endpoints, and signs the user out on a `401` from an
  expired session.
