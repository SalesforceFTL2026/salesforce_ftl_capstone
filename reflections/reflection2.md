# Reflection #2

Pod Members: **Monika Basnet, Ava Flanigan, & Jennifer Ye**

## Reflection Questions

* Name at least one thing that went well this sprint.

The features we built ahead of plan in Sprint 1 hardened into a coherent product this sprint. The org/volunteer workflow now hangs together end-to-end: organizations post volunteer tasks tied to a real help request, volunteers express interest and sign up, resources get allocated against requests, and readiness gates keep a task or request from being marked in-progress/fulfilled before the volunteers and resources are actually there. We also shipped genuinely useful additions — multilingual UI (i18next, 11 languages) synced to a per-user language preference, geocoding + a request map, external crisis-event ingestion (USGS/NWS/EONET/GDACS/FEMA), and a life-safety classifier that keeps safety-critical requests from being out-ranked by the clustering/recency math.

* What challenges did your team face?

The central challenge was spec drift, which is what this mid-sprint audit surfaced. Because Sprint 1 outran its plan, we started Sprint 2 building against a `project_plan.md` that no longer described the system — and we kept building faster than we documented. Concretely: the plan still specified React Query + an AuthContext (we use neither), a flat REST response shape (everything is wrapped in a `{ success, message, data }` envelope), pgvector (we kept `embeddingJson` as TEXT and do cosine similarity in JS), and a `/responses` + AI `/matches` flow (we shipped an interest/assignment model instead). None of these were mistakes — they were reasonable calls made under time pressure — but the accumulating gap between doc and code is exactly the technical debt the audit warns about.

* Did you finish all of your planned tasks? If not, what contributed to that?

We finished the org/volunteer tasking and resource-allocation work, i18n, and crisis-event ingestion. What we did *not* finish are large swaths of the originally documented API surface: responses/updates endpoints, community voting, direct messaging, the AI matching endpoints, dedicated analytics endpoints, and the admin router. Some of that is deferred-by-decision (AI matching, messaging), and some is genuinely cut for MVP. The main contributor, again, was scope momentum — we prioritized the features that made the demo credible over completing the full documented contract.

* Did your team perform a spec audit this sprint? What did you find — were there gaps between the documented and actual behavior? Is the Spec Reconciliation — Sprint 2 Midpoint section committed to your repo?

Yes. Each of the four spec sections drifted:
  - **Data model:** migrated to Postgres as planned, but pgvector was never adopted; added three tables (`VolunteerTask`, `TaskSignup`, `ResourceAllocation`) and several fields (`latitude/longitude`, `householdSize`, `languagePreference`, crisis-event ingestion fields).
  - **API contracts:** many documented endpoints unbuilt (responses, updates, votes, messages, matches, analytics, admin); many built endpoints undocumented (voice intake, interact/assign/complete, dashboards, volunteer-tasks, allocations, chat, emergency). `register`→`signup`, `/api/health`→`/health`, flat shapes→`{success, message, data}` envelope, `POST /api/requests` returns 201 and supports multi-category submission.
  - **State architecture:** React Query is not used at all; no AuthContext; the only context is `ThemeContext`; i18n, admin preview-mode, notification polling, and map state are all undocumented.
  - **AI feature:** Cohere embeddings and `explainer.js` match the spec, but text generation runs on an undocumented OpenRouter→Gemini→OpenAI fallback chain, there's no real clustering (`clusterId`/`signals` never emitted), resource-coverage isn't a scoring signal, and the failure path returns 500 rather than degrading gracefully.

The `## Spec Reconciliation — Sprint 2 Midpoint` section is written into `planning/project_plan.md` (with Gaps resolved, Intentional divergences, and Decisions recorded) and committed to the repo.

* Which spec sections were most useful during development? Which were too vague to be actionable, and how did you address that?

The **Data Model** and **API Contracts** were the most useful — concrete tables, field types, and endpoint shapes gave us something to build against even as specifics changed. The **AI Feature spec** was useful for intent (signals, validation criteria, fallback) but under-specified the operational details — exact provider chain, whether clustering was real, the precise fallback string — which is where the AI drift concentrated. The **State Architecture** section was the least actionable in hindsight: it prescribed a React Query + context design the team never adopted, so it described an intended architecture rather than the one we built. We addressed all of this by updating the spec to match reality in the reconciliation section and recording the deliberate choices in the Decisions Log.

* Were there features you cut for MVP? Did you update the spec to reflect those decisions — and record them in the Decisions Log?

Yes. AI-powered matching (the `Match` table exists but is unused) and its `/api/matches` accept/decline endpoints are deferred; direct messaging, community voting, and the dedicated analytics/admin routers are cut or deferred for the MVP. These are now noted in the Intentional divergences / Gaps sections of the reconciliation, and the substantive choices (interest/assignment over matches, no React Query/AuthContext, TEXT embeddings over pgvector, response envelope, multi-category submission, i18n, the LLM fallback chain) are recorded in the Decisions Log and AI Feature Decisions Log.

* Which features and user stories are "at risk"? How will you adjust your plan for Sprint 3?

At risk going into Sprint 3:
  - **AI graceful degradation** ("see AI reasoning; feed still works when AI fails") — currently the prioritized feed returns HTTP 500 on AI failure instead of falling back to an urgency+createdAt sort with a non-blocking notice, as the spec promises. This is the top Sprint 3 fix.
  - **The full documented collaboration surface** (responses/updates, voting, messaging, analytics, admin) — still largely unbuilt; we need to decide per-feature whether to build or formally cut.
  - **Embedding/vector performance at scale** — the in-process cosine scan is fine for demo data but unproven under load, and we chose not to adopt pgvector.

Adjustment for Sprint 3: (1) implement the AI fallback path so the feed degrades instead of erroring; (2) make an explicit build-vs-cut decision on each unbuilt documented endpoint and update the API Contracts section accordingly; (3) treat the reconciliation section as the new source of truth and keep the Decisions Log updated inline as we go, so we don't re-accumulate drift in Sprint 3.
