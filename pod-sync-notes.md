# MapResponse Pod Sync - Week 1 Setup
**Team MAJic:** Jennifer Ye, Monika Basnet, Ava Flanigan  
**Date:** July 7, 2026  
**Duration:** 1 hour

---

## 1. PROJECT OVERVIEW (5 min)

### What is MapResponse?
AI-powered crisis coordination platform that connects three groups during disasters:
- **Help-seekers** - people who need assistance
- **Volunteers** - people who can help
- **Organizations** - NGOs, shelters, food banks, etc.

### What Makes Us Different?
Most crisis platforms just show a list of requests. We use **AI to prioritize and explain** which requests need attention first and why.

### Week 1 MVP Goals
Focus on three things only:
1. Request submission form
2. AI prioritization engine  
3. Priority feed display

Everything else (notifications, maps, messaging, etc.) comes later.

---

## 2. TECH STACK (5 min)

### Frontend
- React - main UI framework
- Vite - fast development server
- Tailwind CSS - for styling
- Axios - talks to backend
- React Router - page navigation

### Backend
- Node.js + Express - API server
- Prisma - talks to database (like a translator)
- PostgreSQL - actual database
- pgvector - special extension for AI vectors

### AI
- Anthropic Claude API - generates explanations
- OpenAI - creates embeddings (converts text to numbers for comparison)
- pgvector - searches for similar requests

### Deployment Plan
- Frontend → Vercel (free)
- Backend → Railway (free tier with database included)

---

## 3. WHAT WE ACCOMPLISHED TODAY (10 min)

### The Numbers
- Setup time: ~1 hour
- Database tables created: 14
- Servers running: 2/2 (frontend + backend)
- Dependencies installed: 100%
- Current blockers: 1 (AI API keys)

### Database Setup ✓
**What we did:**
1. Created PostgreSQL database called `crisis360`
2. Enabled pgvector extension (for AI similarity search)
3. Switched from SQLite to PostgreSQL
4. Ran migrations to create all 14 tables
5. Verified connection works

**Why PostgreSQL instead of SQLite?**
- SQLite = good for simple apps, one user at a time
- PostgreSQL = production-grade, handles many users, has vector support for AI
- We need vectors for the AI to compare similar requests

**The 14 Tables We Created:**
- `Request` - stores help requests (Week 1)
- `User` - user accounts (Week 2)
- `Volunteer` - volunteer profiles (Week 2)
- `Organization` - org profiles (Week 2)
- `Response` - when someone offers help (Week 2-3)
- `Match` - AI matching suggestions (Week 3)
- `CrisisEvent` - groups related requests (Week 4)
- `Resource` - what orgs have available (Week 3)
- Plus 6 more for messages, notifications, votes, etc.

### Backend Setup ✓
- Installed all packages (Express, Prisma, AI SDKs)
- Configured environment variables
- Server running on port 3001 (changed from 3000 due to conflict)

### Frontend Setup ✓
- Installed React + Vite packages
- Tailwind CSS ready to go
- Server running on port 5174 (changed from 5173 due to conflict)

---

## 4. CHALLENGES WE FACED (10 min)

### Challenge #1: Port Conflicts
**Problem:** Port 3000 and 5173 were already in use by something else

**Error we got:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
- Changed backend to port 3001 in `.env` file
- Frontend auto-adjusted to port 5174
- Both servers now running fine

**What we learned:** Always check if ports are free before starting servers

---

### Challenge #2: SQLite to PostgreSQL Migration
**Problem:** The project was set up for SQLite initially, but we need PostgreSQL

**Error we got:**
```
Error: The datasource provider `postgresql` doesn't match 
the one in migration_lock.toml, `sqlite`
```

**What we did:**
1. Deleted old SQLite migration files
2. Updated the database config file to use PostgreSQL
3. Created fresh migrations for PostgreSQL
4. Verified all 14 tables were created

**What we learned:** When changing databases, you need to start migrations fresh

---

### Challenge #3: Environment Variables Not Loading
**Problem:** We changed PORT to 3001 in `.env` file, but server kept trying port 3000

**Why it happened:** 
Nodemon (the tool that auto-restarts the server) watches code files, not config files

**Solution:** 
Manually stopped and restarted the server

**What we learned:** Config changes need manual restart

---

## 5. CURRENT STATUS (5 min)

### ✓ What's Done
- [x] Development environment fully set up
- [x] Database schema designed and deployed
- [x] Both servers running and accessible
- [x] Ready to start building features

### ○ What's Pending
- [ ] Get Anthropic API key (for Claude)
- [ ] Get OpenAI API key (for embeddings)
- [ ] Configure frontend API URL
- [ ] Set up CORS (so frontend can talk to backend)
- [ ] Build request submission endpoint
- [ ] Build priority feed endpoint
- [ ] Implement AI prioritization logic

### ⚠ Current Blocker
**Only 1 blocker:** Need AI API keys
- Anthropic Claude API - for generating explanations
- OpenAI API - for creating embeddings

Both have free tiers:
- Anthropic: $5 free credit
- OpenAI: $5 free credit

**Question for managers:** Can you help us get these, or should we use personal accounts?

---

## 6. HOW THE AI PRIORITIZATION WORKS (10 min)

### The Pipeline (Step by Step)

**Step 1: Someone submits a request**
Example: "Family of 4 needs food in Oakland, CA"

**Step 2: Create embedding**
AI converts the text into a list of numbers (called a vector)
- This lets us mathematically compare how similar requests are
- Like converting words into coordinates on a map

**Step 3: Search for similar requests**
Database looks for other requests with similar vectors
- Finds things like: "Need food assistance in Oakland"
- This tells us if there's a pattern/cluster

**Step 4: Calculate priority score (0-100)**
We look at 4 factors:

1. **Urgency** (user says how urgent)
   - Critical: 40 points
   - High: 30 points
   - Medium: 20 points
   - Low: 10 points

2. **Cluster density** (how many similar requests nearby)
   - 10+ similar: 30 points
   - 5-9 similar: 20 points
   - 2-4 similar: 10 points
   - Isolated: 0 points

3. **Time** (how recent)
   - < 1 hour: 20 points
   - 1-6 hours: 15 points
   - 6-24 hours: 10 points
   - > 24 hours: 5 points

4. **Location** (geographic clustering)
   - < 1 mile: 10 points
   - 1-5 miles: 7 points
   - 5-10 miles: 4 points
   - > 10 miles: 0 points

**Step 5: Ask Claude to explain**
Send the request + score + context to Claude
Claude writes 1-2 sentences explaining WHY it's important

Example:
"This is high priority because 12 similar food requests were submitted in Oakland within the past 2 hours, suggesting a localized supply issue."

**Rules for Claude:**
- Keep it short (1-2 sentences)
- Only state facts, no speculation
- Never make up details
- Reference actual signals (cluster size, time, location)

**Step 6: Show to user**
Display sorted list with explanations

---

## 7. SYSTEM ARCHITECTURE (5 min)

### How Everything Connects

```
USER'S BROWSER (React app at localhost:5174)
        ↓
    Sends HTTP requests
        ↓
BACKEND SERVER (Express at localhost:3001)
        ↓
    Splits into two paths:
        ↓                           ↓
   AI SERVICES              DATABASE
   - Claude                 - PostgreSQL
   - OpenAI                 - Stores everything
   - Priority scoring       - 14 tables
```

### Frontend's Job
- Show the UI (forms, buttons, lists)
- Validate form inputs
- Send data to backend
- Display results

### Backend's Job
- Receive requests from frontend
- Validate data again (never trust the client)
- Call AI services
- Save/load data from database
- Send responses back

### Database's Job
- Store all requests
- Store user data (later weeks)
- Search for similar requests using vectors

---

## 8. NEXT STEPS - WEEK 1 TASKS (10 min)

### Backend Tasks (12-16 hours estimated)

**1. POST /api/requests (2-3 hours)**
- Accept request submission
- Validate input (required fields, valid values)
- Save to database
- Return success/error

**2. AI Services (4-6 hours)**
- Call OpenAI to generate embedding
- Calculate priority score based on our algorithm
- Call Claude to generate explanation
- Store everything in database

**3. GET /api/requests/prioritized (2 hours)**
- Fetch all requests from database
- Sort by priority score (high to low)
- Return to frontend

**4. Middleware & Error Handling (2 hours)**
- CORS setup
- Input validation
- Error messages
- Logging

### Frontend Tasks (9-12 hours estimated)

**1. Role Selection Page (1-2 hours)**
- Show 3 options: help-seeker, volunteer, organization
- Save choice to local storage
- Navigate to appropriate view

**2. Request Submission Form (3-4 hours)**
- Fields: name, category, urgency, location, description
- Validation (required fields, max lengths)
- Submit to backend
- Show success/error message

**3. Priority Feed (3-4 hours)**
- Fetch requests from backend
- Display as cards sorted by priority
- Show priority score + AI explanation
- Filter by category

**4. Request Card Component (2 hours)**
- Reusable component
- Shows all request details
- Visual priority indicator (color coding)

---

## 9. TEAM WORK DISTRIBUTION (5 min)

### Option 1: Split by Layer
- **Backend team:** Builds API + AI services
- **Frontend team:** Builds UI + integrates API
- **Challenge:** Requires good coordination at integration points

### Option 2: Split by Feature (Recommended)
- **Person A:** Request Submission (form UI + POST endpoint + embedding)
- **Person B:** Priority Feed (feed UI + GET endpoint + display logic)
- **Person C:** AI Prioritization (scoring algorithm + Claude integration)
- **Benefit:** Each person owns a complete feature end-to-end

### Recommendation
Start with Option 2 - easier to see progress, faster feedback loop

**Question for managers:** Does this division make sense, or do you have other suggestions?

---

## 10. TECHNICAL DECISIONS TO DISCUSS (5 min)

### Decision 1: AI API Keys
**Question:** Budget for API keys or use free tier?

**Free tier limits:**
- Anthropic: $5 credit (~100k tokens)
- OpenAI: $5 credit (~500 requests)

Enough for development, might run out during demo day.

**Options:**
1. Use free tier, be careful with testing
2. Get paid accounts (need budget approval)
3. Use manager/company accounts if available

---

### Decision 2: Frontend-Backend Connection
**Question:** How should frontend know backend URL?

**Option A:** Hardcode (simple but only works locally)
```javascript
const API_URL = 'http://localhost:3001'
```

**Option B:** Environment variable (better for deployment)
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
```

**Recommendation:** Option B

---

### Decision 3: Testing Strategy
**Question:** Manual testing or write automated tests?

**Manual Testing:**
- ✓ Fast to do
- ✓ Good for 5-week project
- ✗ Time consuming
- ✗ Easy to miss things

**Automated Testing:**
- ✓ Catch bugs automatically
- ✓ Prevent regressions
- ✗ Takes time to write
- ✗ Maybe overkill for hackathon

**Recommendation:** Manual testing for MVP, add tests if time permits

---

### Decision 4: When to Deploy?
**Options:**
1. End of Week 1 (basic MVP)
2. End of Week 3 (half features done)
3. End of Week 5 (everything done)

**Recommendation:** Deploy early (end of Week 1), iterate in production

---

## 11. BLOCKERS & SUPPORT NEEDED (3 min)

### 🚧 Current Blockers
1. **AI API Keys** (critical for Week 1)
   - Need Anthropic + OpenAI accounts
   - Can we use company accounts?

### 🙏 Nice to Have
- UI/UX design mockups or guidelines
- Sample crisis data for realistic testing
- Code review from mentors
- Architecture feedback (is our approach sound?)

### ❓ Questions for Managers
1. Do we have access to paid AI API keys?
2. Any design guidelines we should follow?
3. What's the expected demo format at the end?
4. Weekly check-ins or only at end of each sprint?
5. Any security/compliance requirements we should know about?

---

## 12. 5-WEEK TIMELINE (5 min)

### Week 1: Foundation (Current)
- [x] Infrastructure setup
- [ ] Request submission
- [ ] AI prioritization
- [ ] Priority feed

### Week 2: Users & Authentication
- [ ] User signup/login
- [ ] User profiles (help-seeker, volunteer, org)
- [ ] Role-based views
- [ ] Request ownership (who submitted what)

### Week 3: Matching & Resources
- [ ] AI matches volunteers to requests
- [ ] Organizations manage resources (food, beds, etc.)
- [ ] Volunteers can claim requests
- [ ] Updates/comments on requests

### Week 4: Crisis Events & Analytics
- [ ] Group related requests (e.g., "Hurricane in Miami")
- [ ] Crisis event dashboard
- [ ] Analytics (how many requests fulfilled, etc.)
- [ ] Community validation/voting

### Week 5: Polish & Demo
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Final deployment
- [ ] Demo preparation
- [ ] Documentation

---

## 13. QUESTIONS & DISCUSSION (10+ min)

### Open Discussion Points

1. **Does our technical approach make sense?**
   - PostgreSQL for database
   - React + Express architecture
   - AI prioritization pipeline

2. **Timeline concerns?**
   - 5 weeks feels tight
   - What if we fall behind?
   - What's the minimum viable demo?

3. **Resource needs?**
   - API keys
   - Design help
   - Code reviews
   - Testing support

4. **Priorities?**
   - If we have to cut scope, what goes first?
   - What's absolutely required vs. nice-to-have?

5. **Demo expectations?**
   - Live demo or video?
   - How many features need to work?
   - Real data or mock data?

---

## APPENDIX: TECHNICAL DETAILS

### Database Schema Example
```javascript
// Request table - our core Week 1 focus
{
  id: "clx5e8k9j0000",              // unique ID
  submitterName: "Sarah Johnson",    // optional for Week 1
  category: "Food",                  // Food, Shelter, Medical, Transport, Other
  urgency: "High",                   // Low, Medium, High, Critical
  location: "Oakland, CA 94612",     // city, zip, or coordinates
  description: "Family of 4 needs...", // what they need
  embeddingJson: "[0.234, -0.567...]", // AI vector (1536 numbers)
  priorityScore: 85.5,               // 0-100 calculated score
  reasoning: "High priority because...", // Claude explanation
  status: "pending",                 // pending, in-progress, fulfilled, etc.
  createdAt: "2026-07-07T20:15:32Z", // timestamp
  updatedAt: "2026-07-07T20:15:32Z"  // timestamp
}
```

### API Example
```javascript
// Request submission
POST /api/requests
Content-Type: application/json

{
  "submitterName": "Sarah Johnson",
  "category": "Food",
  "urgency": "High",
  "location": "Oakland, CA 94612",
  "description": "Family of 4 needs food assistance. Lost power due to storm."
}

// Response
{
  "success": true,
  "data": {
    "id": "clx5e8k9j0000",
    "priorityScore": 85.5,
    "reasoning": "High priority: 12 similar food requests in Oakland within past 2 hours suggest localized crisis.",
    "status": "pending"
  }
}
```

### Environment Variables (.env file)
```bash
# Database
DATABASE_URL="postgresql://mbasnet@localhost:5432/crisis360"

# AI APIs (NEED TO ADD REAL KEYS)
ANTHROPIC_API_KEY="sk-ant-your-key-here"
OPENAI_API_KEY="sk-your-key-here"

# Server
PORT=3001
NODE_ENV="development"
```

### Commands to Run Project
```bash
# Backend (in /backend directory)
npm install          # install dependencies
npm run prisma:migrate  # set up database
npm run dev          # start server (localhost:3001)

# Frontend (in /frontend directory)  
npm install          # install dependencies
npm run dev          # start server (localhost:5174)
```

---

## KEY TALKING POINTS TO EMPHASIZE

1. **We're ready to code** - all infrastructure is set up, just need API keys
2. **Clear scope** - we know exactly what Week 1 MVP includes (and excludes)
3. **Realistic timeline** - we've estimated hours for each task
4. **AI is the differentiator** - not just showing requests, but explaining priority
5. **We hit challenges but solved them** - shows problem-solving ability
6. **We need minimal support** - mainly just API key access
7. **Flexible on approach** - open to feedback on architecture/priorities

---

**END OF NOTES**
