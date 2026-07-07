# SPRINT.md

# Sprint 1

Duration

Week 1

Goal

Validate the core hypothesis that AI prioritization improves crisis coordination.

---

# Sprint Goal

A help request can be submitted.

↓

AI prioritizes it.

↓

Users view ranked requests.

---

# Success Criteria

- Submit request
- Store in database
- Generate embeddings
- Cluster requests
- Calculate priority
- Generate AI explanation
- Display ranked feed

---

# In Scope

Frontend

- Landing Page
- Role Selection
- Request Form
- Priority Feed

Backend

- POST /api/requests
- GET /api/requests/prioritized
- AI Prioritization
- Database

AI

- Embeddings
- Cosine Similarity
- Priority Score
- Claude Explanation

---

# Out of Scope

Authentication

Profiles

Notifications

Messaging

Maps

Organization Dashboard

Volunteer Dashboard

Analytics

Anything not listed above.

---

# Definition of Done

✓ API works

✓ Frontend connected

✓ Database stores requests

✓ AI explanations generated

✓ Feed sorted correctly

✓ README updated

✓ Code reviewed

---

# Team Ownership

Jennifer

Backend

AI

Database

Monika

Frontend

Forms

Pages

Routing

Ava

UI

Components

Styling

Integration

---

# Current Backlog

High

- Request submission
- Priority endpoint
- Feed UI

Medium

- Loading states
- Error handling

Low

- Styling improvements

---

# Known Risks

OpenAI embedding costs

Vector similarity performance

Prompt quality

Scope creep

---

# Stretch Goals

Basic filters

Better priority explanation

Mobile responsiveness

Health monitoring

---

# Sprint Retrospective

What worked

...

What didn't

...

Next sprint goals

...