# ARCHITECTURE.md

# Crisis360 Technical Architecture

## Overview

Crisis360 is a full-stack AI-powered crisis coordination platform built with:

- React + Vite
- Node.js + Express
- Prisma ORM
- PostgreSQL
- pgvector
- Claude API
- OpenAI Embeddings

The system follows a layered architecture:

Client
↓

REST API

↓

Controllers

↓

Services

↓

Prisma

↓

PostgreSQL

↓

AI Services

↓

Claude + Embeddings

---

# Guiding Principles

- Thin controllers
- Business logic lives in services
- Database access only through Prisma
- AI isolated inside `/services/ai`
- Never call AI directly from routes
- Every endpoint validates input
- Authentication middleware protects private endpoints

---

# Folder Structure

backend/

routes/

controllers/

services/

ai/

database/

middleware/

utils/

prisma/

frontend/

pages/

components/

hooks/

contexts/

services/

utils/

---

# Database Architecture

## Implementation Timeline

### Week 1

Request

### Week 2

User

Volunteer

Organization

Response

Update

Notification

### Week 3

Resource

Match

Message

### Week 4

CrisisEvent

RequestEvent

Vote

### Week 5

Analytics

Admin

---

# Database Schema

## Request

Purpose

Stores every crisis assistance request.

Fields

- id
- submitterName
- submitterRole
- userId
- category
- urgency
- location
- description
- embeddingJson
- priorityScore
- reasoning
- status
- createdAt
- updatedAt

Relationships

User → Request

Request → Response

Request → Match

Request → Vote

Request → Update

Indexes

priorityScore

urgency

category

status

createdAt

...

(repeat this format for every table)

---

# AI Pipeline

Help Request

↓

Validation

↓

Embedding Generation

↓

Vector Search

↓

Cluster Detection

↓

Priority Score

↓

Claude Explanation

↓

Database Update

↓

Frontend Feed

Priority Formula

priorityScore =
urgencyWeight +
clusterDensity +
timeWeight +
locationWeight

---

# Authentication Flow

Register

↓

Hash Password

↓

Store User

↓

JWT

↓

Protected Routes

↓

Role Authorization

Roles

- help-seeker
- volunteer
- organization
- admin

---

# API Design

## Week 1

POST /api/requests

GET /api/requests/prioritized

GET /api/health

## Week 2

Authentication

Requests

Responses

Updates

...

(list endpoints grouped by sprint rather than dumping all 60)

---

# Error Handling

400 Validation

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Invalid Data

500 Server Error

---

# AI Services

embeddingService.js

- generateEmbedding()

priorityService.js

- calculatePriority()

clusterService.js

- findClusters()

explanationService.js

- generateExplanation()

---

# Security

- bcrypt
- JWT
- Prisma parameterization
- Helmet
- CORS
- Environment variables
- Input validation

---

# Deployment

Frontend

Vercel

Backend

Railway

Database

Railway PostgreSQL + pgvector

AI

Claude API

OpenAI Embeddings

---

# Future Architecture

Week 4

- Crisis Events
- AI Matching

Week 5

- Notifications
- Messaging
- Analytics

Future

- WebSockets
- Background jobs
- Redis cache
- Vector database
- Event queue