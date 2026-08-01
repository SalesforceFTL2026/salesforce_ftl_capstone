# Reflection #3

Pod Members: **Monika Basnet, Ava Flanigan, & Jennifer Ye**

## Reflection Questions

* Name at least one successful thing this week.

The app crossed from "a pile of features" into something that reads as a real, role-aware product. We shipped complete dashboards for all three roles (help-seeker, organization, and volunteer), added an admin login to the site, and landed a polished landing page. On the coordination side, volunteer availability now surfaces to organizations for scheduling and grounds the volunteer assistant, and help-seekers get email notifications when there's movement on their request. We also hardened the intake path — the Deepgram streaming voice flow stopped clipping speech and tearing down the mic on render — so voice intake is finally reliable end-to-end.

* What were some challenges you and/or your group faced this week?

The biggest challenge was doing real testing under deadline pressure while still landing features. The voice intake in particular took several passes to get right (SDK upgrade, grant-token minting, mic lifecycle, clipped speech), which ate time we'd budgeted elsewhere. The bug bash / spec-audit theme also surfaced our recurring problem: the codebase keeps outrunning the documentation. We carry a committed `Spec Reconciliation — Sprint 2 Midpoint` section in `planning/project_plan.md`, but this sprint added admin login, the three dashboards, volunteer availability/scheduling, and email notifications — none of which are reconciled into the spec yet. Balancing regression risk (touching the voice/mic and prioritization code late in the sprint) against schedule risk was a constant judgment call.

* Did you finish all of your tasks in your sprint plan for this week? If you did not finish all of the planned tasks, how would you prioritize the remaining tasks on your list?

We finished most of the planned feature work — the dashboards, admin login, volunteer availability, email notifications, and the voice-intake fixes all landed and merged. What is **not** finished is the spec-audit close-out: the `Spec Reconciliation — Bug Bash (Sprint 3)` section is still in progress and not yet committed, and the two carryover fixes flagged in Sprint 2 (AI graceful degradation on failure instead of HTTP 500, and aligning `/health` → `/api/health`) are still open. Going into Sprint 4 we'll prioritize: (1) commit the reconciled spec first, since that's the clean slate the final sprint builds against; (2) the AI fallback fix, because it's a user-facing reliability gap; and (3) the low-risk `/api/health` alignment last. Anything high-risk this close to Demo Day we'll defer or document as a known limitation rather than ship broken.

* Did the resources provided to you help prepare you in planning and executing your capstone project sprint this week? Be specific, what resources did you find particularly helpful or which tasks did you need more support on?

The risk-analysis framing (regression vs. design vs. schedule vs. documentation risk) was genuinely useful this week — it gave us a shared vocabulary for the "fix it now vs. leave it" arguments we kept having, especially around the fragile voice/mic code. The two-track bug bash structure (functional testing + a dedicated spec-audit owner) was the most actionable resource: separating "find broken buttons" from "compare the spec to reality" kept the spec drift from getting lost under functional bugs again. Where we needed more support was E2E test coverage — we added Playwright tests but are still unsure how much coverage is "enough" for the demo versus over-investing time we don't have.

* Which features and user stories would you consider "at risk"? How will you change your plan if those items remain "at risk"?

At risk going into Sprint 4:
  - **AI graceful degradation** ("feed still works and shows a safe notice when AI fails") — the prioritized feed still returns HTTP 500 on AI failure instead of falling back to an urgency + recency sort. Top reliability fix; if it slips, we'll document it as a known limitation and demo with the AI path healthy.
  - **Spec accuracy for this sprint's features** — admin login, the three dashboards, volunteer availability/scheduling, and email notifications aren't reconciled into `project_plan.md` yet. If the reconciliation isn't committed before Sprint 4, we risk Claude generating against stale intent, so this is our first task, not a nice-to-have.
  - **Voice intake robustness** — much improved, but it's the most fragile part of the codebase and the one most likely to fail live. Plan: freeze changes to it after the reconciliation commit, keep a typed-intake fallback ready for the demo, and only touch it again if a bug bash issue is blocking.
