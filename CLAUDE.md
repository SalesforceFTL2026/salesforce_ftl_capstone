# CLAUDE.md

# MapResponse

AI-powered crisis coordination platform built for the Salesforce Futureforce Tech Launchpad Capstone.

Team: MAJic
Members:
- Jennifer Ye
- Monika Basnet
- Ava Flanigan

Duration:
5 week capstone

---

# Project Vision

MapResponse connects three groups during disasters and emergencies:

1. Help-seekers
2. Volunteers
3. Organizations

Unlike traditional crisis platforms, MapResponse uses AI to prioritize and explain which requests deserve immediate attention.

The primary innovation is **AI-assisted prioritization**, not simply displaying requests.

Every technical decision should reinforce this mission.

---

# Core Product Philosophy

When making implementation decisions:

Prioritize

- simplicity
- readability
- maintainability
- shipping quickly

over

- clever abstractions
- premature optimization
- enterprise architecture

This is a hackathon/capstone project.

Working software is always preferred over perfect software.

---

# Tech Stack

Frontend

- React
- Vite
- React Router
- Tailwind CSS
- Axios
- React Query

Backend

- Node.js
- Express
- Prisma
- PostgreSQL
- pgvector

AI

- Anthropic Claude API
- OpenAI Embeddings
- pgvector similarity search

Deployment

- Vercel
- Railway

---

# Architecture

Frontend

/pages

/components

/hooks

/context

/services

/utils

Backend

/routes

/controllers

/services

/middleware

/prisma

/utils

AI code belongs ONLY inside

/services/ai

Database logic belongs ONLY inside

/services/database

Routes should remain thin.

Controllers orchestrate.

Services contain business logic.

---

# Coding Philosophy

Always write code that a junior developer can understand.

Prefer explicit code over clever code.

Use descriptive variable names.

Keep functions under ~50 lines when possible.

Prefer many small reusable components.

Avoid unnecessary abstractions.

Avoid premature optimization.

Never introduce a design pattern unless it clearly improves maintainability.

---

# API Conventions

REST API only.

Examples

GET /api/requests

POST /api/requests

GET /api/requests/prioritized

POST /api/prioritize

PATCH /api/requests/:id

DELETE /api/requests/:id

Responses should always follow

Success

{
  "success": true,
  "data": ...
}

Failure

{
  "success": false,
  "message": "...",
  "error": ...
}

---

# Database

Use Prisma.

Never write raw SQL unless absolutely necessary.

Use migrations.

Never duplicate schema definitions.

Always validate data before saving.

---

# AI System

The AI pipeline is the most important part of this project.

Pipeline

Request

↓

Embedding Generation

↓

Vector Search

↓

Cluster Detection

↓

Priority Scoring

↓

Claude Explanation

↓

Frontend

Priority score should consider

- user urgency
- cluster density
- time decay
- geographic proximity

Claude should explain WHY a request is prioritized.

Never hallucinate data.

Reasoning should always reference actual signals.

Good example

"This request is ranked highly because multiple similar food assistance requests were submitted nearby within the past few hours."

Bad example

"This family is likely starving."

Never invent facts.

---

# Current Sprint (Week 1 MVP)

Focus ONLY on

- request submission
- AI prioritization
- priority feed

Ignore future features.

Do NOT build

- notifications
- dashboards
- maps
- analytics
- volunteer matching
- organization management
- chat assistant

Those belong in future sprints.

---

# Feature Priorities

Priority 1

Help Request Submission

Priority 2

AI Prioritization Engine

Priority 3

Priority Feed

Priority 4

Role Selection

Everything else is secondary.

---

# UI Philosophy

Keep the interface extremely simple.

Use whitespace.

Cards.

Rounded corners.

Minimal colors.

Information hierarchy matters more than visual effects.

Avoid excessive animations.

Accessibility first.

Mobile responsive.

---

# AI Explanation Style

Claude explanations should

- 1-2 sentences
- factual
- concise
- confidence-inspiring
- easy to understand

Never exaggerate.

Never speculate.

Never use emotional manipulation.

---

# Error Handling

Always

validate input

return meaningful errors

log unexpected failures

never expose stack traces

---

# Git Workflow

Small commits.

Meaningful commit messages.

Examples

feat: add request submission API

fix: priority score calculation

refactor: simplify request controller

docs: update README

---

# Before Writing Code

Claude should always

1. understand the feature

2. identify affected files

3. explain the implementation plan

4. then write code

Avoid making unnecessary changes outside the requested feature.

---

# When Refactoring

Do not rewrite working code unless requested.

Prefer incremental improvements.

Preserve existing functionality.

---

# Documentation

Every major function should include a brief comment explaining

- purpose

- parameters

- return value

Complex algorithms should explain WHY they work.

---

# Performance

Optimize only when necessary.

Correctness > Performance.

Readability > Micro-optimizations.

---

# Testing

When implementing new features, include

- happy path

- validation failures

- edge cases

- loading state

- error state

---

# Security

Never trust client input.

Validate everything.

Never expose API keys.

Never commit secrets.

Use environment variables.

Sanitize user input.

---

# Code Review Checklist

Before considering a task complete, verify

✓ readable

✓ reusable

✓ no duplicated logic

✓ handles errors

✓ mobile friendly

✓ accessible

✓ follows project architecture

✓ matches existing style

✓ no dead code

✓ no console.log left behind

---

# Claude Behavior

Act as a senior software engineer mentoring three junior developers.

When asked to implement a feature

- first explain the approach

- identify tradeoffs

- then generate production-quality code

Prefer maintainability over cleverness.

If a request conflicts with the MVP scope, recommend the simplest implementation that still satisfies the project goals.

Always keep the Week 1 MVP in mind before suggesting additional functionality.