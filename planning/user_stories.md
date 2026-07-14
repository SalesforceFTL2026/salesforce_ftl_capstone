# Project Proposal: MapResponse

## Pod Members
Monika Basnet, Ava Flanigan, & Jennifer Ye

## Problem Statement

During crises (natural disasters, housing emergencies, public health disruptions), three groups are simultaneously underserved:

1. People affected by the crisis don't know where to ask for help or whether help is actually available.
2. Volunteers want to help but lack visibility into real-time, verified needs.
3. Nonprofits struggle to coordinate resources, prioritize urgency, and communicate clearly as situations evolve.

Information exists, but it is fragmented across forms, posts, spreadsheets, and ad hoc messages. There is no shared system that:

- Ingests needs directly from affected individuals,
- Aggregates and validates them for nonprofits, and
- Intelligently routes volunteers where impact is highest.

## Target Audience

- People seeking help during a crisis (aid requests, supply needs, housing, medical)
- Volunteers looking for high-impact, timely ways to help
- Nonprofit organizations coordinating response efforts and resources

## User Roles

1. **Help Seeker**: A person experiencing a crisis or community need who is requesting assistance through the platform.
2. **Volunteer**: A person offering their time, skills, or resources to help others respond to active crises.
3. **Organization**: A nonprofit, agency, or company coordinating crisis response efforts and managing resources at scale.

---

## User Personas

### Help Seeker Persona 1: Maria Chen (42), Oakland, CA

Maria is a single mother of two who works as a restaurant server. When flash flooding hit her neighborhood last month, her ground-floor apartment was damaged and she had to evacuate with her kids to her sister's house. She's never used emergency services before and isn't sure where to start. She has an older smartphone and relies heavily on text messages rather than email. She needs immediate help finding temporary housing and replacing essentials like clothing and school supplies for her children. Maria values clear communication and wants to know someone is actually responding to her request.

### Help Seeker Persona 2: David Park (67), Portland, OR

David is a retired accountant living alone in a suburban neighborhood. He has limited mobility due to arthritis and relies on a walker. During a recent winter storm, he lost power and heat for several days. He's comfortable with technology—he uses email daily and video calls with his grandchildren—but has never used social media or apps beyond email and news. David is concerned about being a burden but recognizes when he genuinely needs help. He prefers speaking to people directly and values reliability and follow-through over speed.

### Volunteer Persona 1: Jordan Smith (28), Seattle, WA

Jordan is an EMT who works irregular shifts at a hospital. They grew up volunteering at their church's food bank and want to continue giving back to their community. Jordan checks their phone frequently throughout the day and is comfortable with apps—they use rideshare apps, delivery apps, and scheduling apps regularly. They're motivated by direct impact and want to see concrete results from their volunteer work. Jordan has medical training but also general skills like driving and logistics coordination. They prefer volunteering opportunities that match their current schedule and location, typically within 10 miles of home or work.

### Volunteer Persona 2: Patricia "Pat" Williams (54), Austin, TX

Pat is a high school teacher with summers off and occasional free weekday evenings. She's been volunteering with local nonprofits for over 20 years and has deep connections in her community. She primarily uses her laptop for planning and organization, though she keeps her phone handy for urgent communication. Pat is motivated by long-term community building and prefers ongoing relationships rather than one-off tasks. She has experience coordinating groups, teaching, and administrative work. Pat is cautious about new technology but willing to learn if it genuinely helps people.

### Organization Persona 1: Acme Relief Organization (mid-sized nonprofit with 15 staff and 200+ volunteers)

Acme Relief is a regional disaster response nonprofit operating across three counties. Their Operations Director, Michelle Torres, manages resource deployment and volunteer coordination. The org has two emergency shelters, a fleet of vehicles, and partnerships with local food banks and medical clinics. They respond to 10-15 crises per year ranging from house fires to natural disasters. Michelle uses spreadsheets, email, and a volunteer management system daily, but data is siloed—she can't easily see real-time volunteer availability or resource gaps across active crises. Acme values data-driven decision-making and wants to maximize their impact per dollar spent.

### Organization Persona 2: City Emergency Management Department (government agency with 50 staff)

The City EMD coordinates with multiple organizations, first responders, and community groups during large-scale emergencies. Director James Rodriguez oversees crisis response strategy and resource allocation across city departments. The department has access to significant resources but struggles with coordination across agencies and getting real-time visibility into what's actually happening on the ground. They generate lots of reports but decision-makers need synthesized intelligence, not raw data dumps. James values systems that integrate with existing infrastructure and provide clear situational awareness without requiring staff to learn entirely new workflows.

---

## User Stories

1. As a help seeker, I want to submit a help request describing my situation and what I need, so that I can get connected to people or organizations who can assist me.

2. As a help seeker, I want to see the status of my help request and whether anyone has been assigned to help me, so that I know if help is coming and approximately when.

3. As a volunteer, I want to see a feed of opportunities ranked by how well they match my skills and availability, so that I can quickly find where I can help most effectively.

4. As a volunteer, I want to understand why an opportunity is recommended for me, so that I can evaluate whether it's truly a good fit before committing.

5. As a volunteer, I want to commit to helping with a specific request, so that the person seeking help knows someone is coming and I have clear accountability.

6. As an organization, I want to see all active crises I'm responding to in one dashboard, so that I can maintain situational awareness across multiple concurrent events.

7. As an organization, I want to deploy resources (shelter beds, supplies, funds) to specific crises, so that needs are met and I have a record of what was allocated where.

8. As an organization, I want to see gap analysis showing unmet needs across active crises, so that I know where to prioritize additional resources or request help from partners.

9. As any user, I want to see a map view showing crisis locations with heatmap intensity visualization, so that I can understand geographic distribution and severity at a glance.

10. As any user, I want to see the AI's reasoning for prioritization and matching decisions, so that I can trust the system and understand why certain choices were made.
