# SITE Capstone Project

SITE Course Year: **2026**

Cohort: **Salesforce**

Team Member Names: **Monika Basnet, Ava Flanigan, & Jennifer Ye**

Mentors Names: **Dallas Dias, Aditya Suresh Kumar, Tripti Sheth, & Miguel Valdez**

Project Code Repository Link

* [salesforce_ftl_capstone](https://github.com/SalesforceFTL2026/salesforce_ftl_capstone) — monorepo (`backend/` + `frontend/`)

## Project Overview

### MapResponse
An AI-powered crisis coordination platform that connects help-seekers, volunteers, and nonprofit organizations through a shared, real-time request system. Individuals can submit assistance requests, while AI prioritizes and clusters similar needs based on urgency, location, and demand to help organizations allocate resources more effectively and guide volunteers toward the highest-impact opportunities. By centralizing fragmented crisis information into a single platform, MapResponse enables faster, more transparent, and more coordinated disaster response.

Deployment Website: **Add the deployed frontend URL here once it's live**

See [PRODUCT.md](PRODUCT.md) for the product vision and [ARCHITECTURE.md](ARCHITECTURE.md) for the technical design.

---

## Tech Stack

**Frontend** — React 18 + Vite, React Router, Tailwind (utility classes), react-i18next (EN/ES/ZH), Leaflet + react-leaflet (maps), axios.

**Backend** — Node.js + Express, Prisma ORM over PostgreSQL, JWT auth (bcrypt password hashing, Google Sign-In), Helmet, CORS, `express-rate-limit`, Multer (uploads) + AWS S3 (avatars/photos).

**AI** — request embeddings + in-process cosine similarity for clustering, an urgency/cluster/time/location priority score, and LLM-generated explanations and conversational intake. Providers are tried in a free-first fallback chain (OpenRouter → Google Gemini → OpenAI), with Anthropic available for local development only.

---

## Repository Layout

```
backend/     Express API, Prisma schema + migrations, AI services, tests
frontend/    React (Vite) single-page app
planning/    Sprint planning docs
reflections/ Retrospectives
render.yaml  Render Blueprint (backend API, cron ingestion, Postgres, static frontend)
```

---

## Getting Started (Local Development)

### Prerequisites
- Node.js 24
- A PostgreSQL database (local or hosted)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # then fill in the values (see below)
npx prisma migrate dev        # apply the schema to your database
npm run seed:admin            # optional: create the demo admin account
npm run dev                   # starts the API on http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # set VITE_API_URL to your backend, e.g. http://localhost:3000
npm run dev                   # starts Vite on http://localhost:5173
```

---

## Environment Variables

Full templates live in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example). The essentials:

**Backend**
| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | | PostgreSQL connection string |
| `JWT_SECRET_KEY` | | Signs login tokens |
| `GOOGLE_CLIENT_ID` | for Google Sign-In | Verifies Google ID tokens |
| `OPENROUTER_API_KEY` / `GOOGLE_API_KEY` / `OPENAI_API_KEY` / `COHERE_API_KEY` | for AI features | LLM + embedding providers (free-first fallback chain) |
| `AWS_*` | for image upload | S3 bucket for avatars / request photos |
| `NODE_ENV` | in production | Set to `production` on the server |
| `FRONTEND_URL` | in production | Locks CORS to the deployed frontend origin |

The server validates that `DATABASE_URL` and `JWT_SECRET_KEY` are present at startup and refuses to boot without them.

**Frontend**
| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the backend API |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In client id (matches the backend's `GOOGLE_CLIENT_ID`) |

---

## Common Scripts

**Backend** (`cd backend`)
| Script | Description |
| --- | --- |
| `npm run dev` | Start the API with auto-reload (nodemon) |
| `npm start` | Start the API |
| `npm test` | Run the test suite (Vitest) |
| `npm run prisma:migrate` | Create/apply a migration in development |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed:admin` | Seed the demo admin account |
| `npm run ingest:events` | Run the real-event ingestion job once |

**Frontend** (`cd frontend`)
| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

---

## Testing

Backend tests run with [Vitest](https://vitest.dev/):

```bash
cd backend
npm test
```

They cover the pure logic (scoring, filters, distance, dedupe), the AI-boundary
services (extraction, life-safety classification, voice agent — with the model
mocked so they run offline and free), and the authentication/authorization layer
(auth middleware and request-controller access control). See
[backend/TESTING.md](backend/TESTING.md) for what's covered and what's next.

---

## Deployment

Deployment is described as infrastructure-as-code in [`render.yaml`](render.yaml)
(a [Render Blueprint](https://render.com/docs/blueprint-spec)) with four services:

- **`mapresponse-backend`** — the Express API (runs Prisma migrations on deploy)
- **`mapresponse-frontend`** — the built React SPA (static site)
- **`ingest-real-events`** — a daily cron job for real-event ingestion
- **`mapresponse-db`** — managed PostgreSQL

Secrets (API keys, `JWT_SECRET_KEY`, `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`) are
marked `sync: false` and set once in the Render dashboard.

---

## Open-Source Libraries

**Frontend:** React, Vite, React Router, Tailwind CSS, Leaflet & react-leaflet, TopoJSON / us-atlas, i18next & react-i18next, axios.

**Backend:** Express, Prisma, bcrypt, jsonwebtoken, google-auth-library, Helmet, CORS, express-rate-limit, Morgan, Multer, AWS SDK (S3), ml-distance, and the OpenAI / Google Generative AI / Cohere / Anthropic / OpenRouter / Deepgram SDKs.
