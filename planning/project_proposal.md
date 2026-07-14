# Project Proposal

## MapResponse

### Team Name
MAJic

### Pod Members
Monika Basnet, Ava Flanigan, & Jennifer Ye

---

## Problem Statement

During crises (natural disasters, housing emergencies, public health disruptions), three groups are simultaneously underserved:

1. People affected by the crisis don't know where to ask for help or whether help is actually available.
2. Volunteers want to help but lack visibility into real-time, verified needs.
3. Nonprofits struggle to coordinate resources, prioritize urgency, and communicate clearly as situations evolve.

Information exists, but it is fragmented across forms, posts, spreadsheets, and ad hoc messages. There is no shared system that:
- Ingests needs directly from affected individuals,
- Aggregates and validates them for nonprofits, and
- Intelligently routes volunteers where impact is highest.

---

## Target Audience

- People seeking help during a crisis (aid requests, supply needs, housing, medical)
- Volunteers looking for high-impact, timely ways to help
- Nonprofit organizations coordinating response efforts and resources

---

## Description

MapResponse is an AI-powered crisis coordination platform that connects people in need, volunteers, and nonprofits through a shared intelligence layer.

Individuals submit help requests, nonprofits manage and validate needs at scale, and volunteers receive AI-ranked recommendations for where they can contribute most effectively. Instead of acting as a chatbot, MapResponse acts as a decision-support system that prioritizes, clusters, and explains crisis needs in real time.

---

## Expected Feature List

### Shared Core Platform Features

#### 1. Authentication & Profiles
- **a.** Role-based login (Organization / Volunteer / Requester)
- **b.** Profile includes
  - i. Location
  - ii. Skills (required for volunteers)
  - iii. Org type (required for organizations)
  - iv. Basic identity + preferences

#### 2. Crisis Feed (Global Intelligence Layer)
- **a.** Single unified feed of all active crises:
  - i. AI-clustered crisis events (core engine)
  - ii. Ranked by urgency + proximity + relevance
  - iii. Filters:
    1. location
    2. category (medical, housing, food, disaster, etc.)
    3. role-specific relevance
  - iv. Each crisis card shows:
    - v. AI-generated summary
    - vi. urgency score
    - vii. unmet need level
    - viii. "why this matters to you" explanation

#### 3. Crisis Detail Page (Central Hub)
- **a.** AI crisis summary (what happened + severity)
- **b.** Needs vs Resources breakdown
- **c.** Volunteer demand + supply gaps
- **d.** Geographic heatmap
- **e.** Timeline of escalation
- **f.** AI reasoning panel ("why this is high priority")

#### 4. AI Assistant (unified across all users)
- **a.** one shared agent with role-aware behavior
- **b.** Users can ask:
  - i. "Where is help most needed right now?"
  - ii. "What resources do we still lack for this crisis?"
  - iii. "Where can I contribute most effectively?"
- **c.** AI responds using:
  - d. structured crisis + needs data
  - e. embeddings-based retrieval
  - f. role-based reasoning layer

#### 5. Notifications System
- **a.** Crisis updates
- **b.** Match confirmations
- **c.** Urgent shortage alerts
- **d.** Volunteer opportunity suggestions

---

### Organization Module (Nonprofits / Agencies / Companies)

#### 1. Resource Management Dashboard
- **a.** Organizations manage:
  - i. Supplies (food, medical, shelter, etc.)
  - ii. Funds / logistics capacity
  - iii. Availability status:
    1. pledged
    2. in transit
    3. delivered

#### 2. Organization Impact Dashboard
- **a.** Coverage score (needs fulfilled vs unmet)
- **b.** Active crises being supported
- **c.** Resource allocation efficiency
- **d.** Volunteer contributions received
- **e.** AI-generated weekly report

#### 3. Crisis Response Console
- **a.** Shows crises relevant to organization resources
- **b.** AI explains:
  - i. "You can cover 40% of this crisis"
  - ii. "This crisis matches your medical supplies inventory"

#### 4. Volunteer Coordination
- **a.** Post volunteer needs tied to crises
- **b.** Review and assign volunteers
- **c.** Track hours / participation

---

### Individual Help-Seeker Module

#### 1. Submit Help Request
- **a.** Simple structured form:
  - i. category (food, shelter, medical, etc.)
  - ii. urgency
  - iii. location
  - iv. optional description/photo
- **b.** These requests become nodes in the MapResponse crisis clustering engine

#### 2. My Requests Dashboard
- **a.** Status tracking:
  - i. submitted → matched → fulfilled
- **b.** ETA estimates (AI-assisted)
- **c.** Updates from organizations

#### 3. Local Resource View
- **a.** Nearby available help
- **b.** Active aid centers
- **c.** Real-time availability (if applicable)
- **d.** AI explanation:
  - i. "These resources are prioritized due to proximity + supply match"

#### 4. Community Signal Layer
- **a.** Aggregated view of similar requests
- **b.** AI clusters duplicate needs into:
  - i. "community-level demand signals"
- **c.** Upvote/confirm similar needs → increases urgency score

---

### Volunteer Module

#### 1. Smart Opportunity Feed
- **a.** AI-ranked volunteer opportunities
- **b.** Matches based on:
  - i. skills
  - ii. location
  - iii. availability
  - iv. crisis urgency

#### 2. Availability + Matching System
- **a.** Volunteers set availability windows
- **b.** AI proactively surfaces:
  - i. "high impact opportunities during your free time"

#### 3. Impact Dashboard
- **a.** Hours contributed
- **b.** Crises assisted
- **c.** Organizations worked with
- **d.** Shareable impact summary

#### 4. AI Volunteer Matching
- **a.** Instead of browsing manually:
  - i. "Where can I help most with medical background this week?"
  - ii. AI responds with ranked opportunities + reasoning

---

## AI-Powered Features

### 1. AI Need Clustering & Prioritization Engine

Instead of treating each request independently, MapResponse:
- Converts help requests into embeddings
- Clusters similar needs together (e.g., "food insecurity" vs "temporary housing")
- Assigns dynamic urgency scores based on:
  - Volume of similar requests
  - Time since submission
  - Location density
  - Resource availability

This creates a live crisis map of where help is breaking down.

### 2. AI Matching + Explanation Layer

When a volunteer or nonprofit asks why something is urgent, the system doesn't just respond, it justifies the recommendation.

**Example:**
> "This request is ranked high priority because 14 similar requests were submitted in the last 6 hours within a 2-mile radius, and no matching resources are currently available."

This is a reasoned output, not a static summary.

---

## AI Feature API Endpoint Sketch

### Endpoint: `POST /ai/prioritize-requests`

**Who calls it:**
- Nonprofit dashboard (to surface urgent needs)
- Volunteer feed (to rank where help matters most)

**Request body:**
- `userId`: ID of the requesting user
- `userRole`: "nonprofit" | "volunteer"
- `filters`: location, category, availability window

**What the backend does:**
1. Fetch active help requests from the database
2. Generate or retrieve embeddings for request descriptions
3. Perform vector similarity clustering
4. Compute urgency scores using:
   - a. Time decay
   - b. Cluster density
   - c. Resource coverage ratios
5. Construct a structured prompt with ranked results
6. Call the LLM to generate human-readable explanations
7. Return ranked requests with explanations

**Success response:**
```json
{
  "results": [
    {
      "requestId": "abc123",
      "priorityScore": 0.91,
      "reasoning": "High volume of unmet food requests in this area with no active nonprofit coverage."
    }
  ]
}
```

**Failure response:**
```json
{ "error": "Prioritization engine unavailable" }
```

**Why this runs on the backend:**
This pipeline involves embeddings, clustering logic, and AI calls that require secure keys, controlled compute, and reproducibility, none of which belong in the browser.

---

## Related Work

Several existing platforms partially address aspects of crisis coordination, trend detection, and resource matching, but none solve both signal intelligence and actionable need coordination for all stakeholders (people in need, volunteers, and nonprofits).

- **ReliefWeb** provides news and alerts about global crises, but it is informational, not interactive or personalized.
- **Mutual Aid spreadsheets** and grassroots coordination efforts are useful at local scale but become unmanageable at larger scale due to fragmentation and lack of prioritization.
- **Crisis hotlines** and single-channel support systems provide reactive help but lack real-time data synthesis and recommendations.

One notable real-world application that inspired this project is **Good360's use of Salesforce Agentforce** to automate resource matching for disaster relief. Good360 is a nonprofit that connects corporate donations with nonprofits serving communities in need. By leveraging AI agents (Salesforce Agentforce) and a unified data layer, Good360's system triples the speed of matching donated goods to communities and reduces operational overhead, freeing humans to focus on high-value coordination tasks. Agentforce analyzes donor, partner, inventory, and logistics data to recommend optimal matches and supports real-time updates and routing during disaster events.

Unlike Good360's resource-matching use case, which focuses on optimizing physical goods distribution, MapResponse extends the idea of AI-assisted coordination into signal aggregation, trend intelligence, and priority-aware need recommendations across general crises. It aims not just to route goods among nonprofits but to provide all stakeholders (people seeking help, volunteers, and organizations) with a shared intelligence layer that unifies needs, sentiment, urgency, and resource suggestions in a coherent interface.

---

## Open Questions

1. How should urgency scoring be tuned to avoid bias?
2. How can nonprofits override or audit AI decisions?
3. Should individuals be able to see how their request was prioritized?
4. What guardrails prevent misinformation or malicious requests?
5. How real-time should reprioritization be?
