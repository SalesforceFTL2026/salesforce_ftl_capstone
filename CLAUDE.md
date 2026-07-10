# CLAUDE.md

# Crisis360

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

Crisis360 connects three groups during disasters and emergencies:

1. Help-seekers
2. Volunteers
3. Organizations

Unlike traditional crisis platforms, Crisis360 uses AI to prioritize and explain which requests deserve immediate attention.

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



# CLAUDE.md

## Project Overview

This is a PERN stack application built for a full-stack web development course.

The app uses:

- PostgreSQL for the database
- Express.js for the backend API
- React for the frontend
- Node.js as the runtime

The goal of this project is to help students learn how the frontend, backend, and database work together.

---

## Student Learning Goals

When helping with this project, prioritize learning over speed.

Explain code in beginner-friendly language.

When making suggestions, connect the explanation to full-stack concepts such as:

- React components
- State management
- API calls
- Express routes
- Controllers
- Database queries
- Request and response flow
- Error handling

---

## General Rules

Before editing code:

1. Inspect the relevant files.
2. Explain the issue or goal.
3. Suggest a short plan.
4. Wait for confirmation if the change is large.

When editing code:

1. Make the smallest reasonable change.
2. Do not rewrite the whole project.
3. Do not add extra libraries unless necessary.
4. Keep the code readable for beginner full-stack students.
5. Follow the existing file structure and naming style.

After editing code:

1. Explain what changed.
2. Explain why the change works.
3. List the files that were changed.
4. Suggest how to test the result.

---

## Code Style

Use clear and beginner-friendly JavaScript.

Prefer readable code over overly clever code.

Use async/await for backend database calls.

Use meaningful variable names.

Add short comments only when they help students understand the code.

Avoid advanced patterns unless they are already used in the project.

---

## Backend Guidelines

The backend uses Express.

Routes should be organized clearly.

When working on backend features:

- Check the route file first
- Then check the controller
- Then check the database query
- Then check server setup if needed

Use proper HTTP status codes.

Examples:

- 200 for successful GET requests
- 201 for successful creation
- 400 for bad requests
- 404 for not found
- 500 for server errors

Do not expose sensitive error details to the frontend.

---

## Frontend Guidelines

The frontend uses React.

When working on frontend features:

- Check the relevant component
- Check state variables
- Check event handlers
- Check API calls
- Check how data is rendered

Keep components understandable for students.

Do not create overly complex abstractions unless needed.

When using forms, remember to use `event.preventDefault()`.

---

## Database Guidelines

The database uses PostgreSQL.

When working with database-related code:

- Check table names carefully
- Check column names carefully
- Use parameterized queries when writing SQL
- Do not hardcode user input into SQL strings
- Explain how the query connects to the route or controller

Do not delete or reset data unless specifically asked.

---

## Testing and Debugging

When debugging, follow this flow:

1. Read the error message
2. Identify where the error is happening
3. Trace the request flow
4. Check frontend request
5. Check backend route
6. Check controller logic
7. Check database query
8. Suggest the smallest fix

After a fix, suggest a simple test.

Example:

- Start the backend server
- Start the frontend app
- Open the browser
- Try the feature manually
- Check the terminal for errors
- Check the browser console for errors

---

## What Not To Do

Do not complete the entire project for the student.

Do not generate large amounts of code without explanation.

Do not replace all existing code with a new architecture.

Do not add authentication, payment, deployment, or advanced features unless specifically requested.

Do not hide complexity from the student. Explain it clearly.

Do not assume the code is correct without checking files first.

---

## Preferred Explanation Style

Use this explanation format when possible:

1. What the problem is
2. Where the problem is happening
3. Why it is happening
4. What change fixes it
5. How to test it

Use simple language.

Assume the student is learning full-stack development for the first time.

---

## Example Student-Friendly Response

The issue is happening in the backend route.

Your React component is sending a request to `/api/posts`, but the Express server does not currently have a matching GET route for `/api/posts`.

To fix this, we need to add a GET route that asks the database for posts and sends them back as JSON.

After that, you can test it by visiting the frontend page or using the browser/network tab to confirm the request returns data.