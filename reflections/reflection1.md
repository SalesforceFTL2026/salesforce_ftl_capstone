# Reflection #1

Pod Members: **Monika Basnet, Ava Flanigan, & Jennifer Ye**

## Reflection Questions

* **Name at least one thing that went well this sprint.**

The core AI prioritization pipeline came together early and end-to-end. Within the first working session we had the full chain running: request submission → embedding generation → cosine similarity / clustering → priority scoring (urgency + clustering + time decay) → Claude-generated explanation → ranked feed. That was the central hypothesis of Sprint 1, and having it validated early gave the rest of the team a stable backend to build against. Parallelizing ownership also let us move on multiple fronts at once without stepping on each other much - we merged a large number of PRs cleanly.

* **What challenges did your team face?**

The biggest challenge was coordination across three parallel workstreams once we branched into multiple dashboards (volunteer, organization, help-seeker) at the same time. This produced a lot of merge/merge-into-main churn and required frequent rebasing to keep everyone in sync. We also hit some AI-integration friction - for example, an invalid gateway model id for the Claude explanations had to be corrected, and the eslint flat config needed repair before lint would pass. Managing embedding cost was a live concern that pushed an early tooling decision (see Decisions Log).

* **Did you finish all of your planned tasks? If not, what contributed to that — over-planning, unclear spec, technical blockers, team coordination issues?**

We finished all of the in-scope Sprint 1 success criteria (submit request, store, embeddings, clustering, priority score, AI explanation, ranked feed) — and then went *past* the plan. We also built the following features: authentication/JWT login-signup, the volunteer/organization/help-seeker dashboards, and a chatbot. So the issue wasn't unfinished work; it was scope expansion. That was driven partly by momentum (the backend was ready sooner than expected) and partly by the plan being conservative relative to what we could actually build. The cost was extra coordination overhead and a spec that no longer matched reality.

* **Did your team update project_plan.md before beginning each feature? If not, what prevented it, and what will you change in Sprint 2?**

Not consistently. project_plan.md was updated at a couple of checkpoints (early July) rather than before each individual feature, and the Decisions Log inside it stayed mostly empty. What prevented it was pace — we tended to open a branch and build, then update docs afterward (or not at all). For Sprint 2 we'll treat the plan as a gate: before starting a feature, add/confirm its entry in project_plan.md and its user story, and log any real decision at the moment we make it rather than reconstructing later.

* **Where did your implementation diverge from the spec? Was the divergence intentional? Did you update the spec to reflect it — and commit the update?**

We diverged significantly: authentication, all three role dashboards, and a chatbot were shipped. The divergence was intentional (we had capacity and these features were needed for a credible demo), but we did update SPRINT.md to reflect it — it still lists those items as out of scope. That's the main documentation gap to fix: we should have moved those items into scope in the sprint doc and committed the change in the same PR that introduced the feature.

* **Where did Claude's output require significant revision? What was missing or misaligned with your spec at the time?**

The AI-generated priority-explanation path needed correction around the model/gateway configuration (an invalid gateway model id had to be swapped for a valid one before explanations would generate). Tooling scaffolding also needed cleanup — the eslint flat config had to be repaired and the resulting lint errors cleared. In both cases the output was structurally close but missing environment-specific correctness (valid IDs, working config) that our spec hadn't pinned down yet.

* **Which features and user stories are "at risk"? How will you adjust your plan?**

At risk going into Sprint 2:
  - **AI reasoning trust/transparency** (User Story: "see the AI's reasoning for prioritization and matching") — the explanations work but need consistency and cost control now that they run across every dashboard.
  - **Embedding/vector cost and performance at scale** — flagged as a known risk; fine for demo data, unproven under load.
  - **The dashboards we built ahead of plan** — functional but ahead of their spec, so they're at risk of drifting from requirements.

Adjustment: freeze net-new scope at the start of Sprint 2, harden and spec the features we already shipped early (write their user stories retroactively and update SPRINT.md/project_plan.md to match), and add lightweight monitoring on embedding usage before scaling.

* **Did the Decisions Log get updated during Sprint 1? What decisions felt most worth recording?**

Partially — it has one substantive entry and is otherwise empty. The decision most worth recording (and the one we did capture) was **switching from OpenAI to Cohere for embeddings**: OpenAI's embeddings API is paid, while Cohere offers a generous free tier, at the cost of learning Cohere's API and living within its free-tier limits. Other decisions we *should* have logged but didn't: moving auth and the three dashboards into scope, and the priority-score weighting (urgency vs. clustering vs. time decay). We'll backfill these and log decisions inline in Sprint 2.
