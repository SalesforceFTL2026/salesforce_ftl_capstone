import { askLLM } from '../services/ai/chatbot.js';
import { detectHelpRequest } from '../services/ai/extractor.js';
import * as requestModel from '../models/requestModel.js';
import prisma from '../services/database/prisma.js';
import { hasRole } from '../utils/roles.js';

/**
 * Chat Controller
 * Handles the AI assistant chat for help-seekers, volunteers, and organizations.
 * Each role gets a system prompt grounded in that account's own data, so the
 * assistant can speak to their actual situation instead of giving generic
 * answers.
 */

// How many prior turns of the conversation we accept from the client. Keeping
// this bounded protects the model's context window and our token usage.
const MAX_HISTORY_TURNS = 10;
// Allowed roles for a history message coming from the client.
const VALID_ROLES = new Set(['user', 'assistant']);

// Build the system prompt that makes the assistant aware of *this* help-seeker:
// who they are and what help requests they currently have open.
const buildHelpSeekerPrompt = (user, requests) => {
  const requestLines = requests.length
    ? requests
        .map(
          (r) =>
            `- ${r.category} (urgency: ${r.urgency}, status: ${r.status}) at ${r.location}: "${r.description}"`
        )
        .join('\n')
    : '- (no requests submitted yet)';

  return `You are a helpful, calm assistant for MapResponse, a disaster-relief platform.
You are chatting with a help-seeker who may be in a stressful or emergency situation.
Be concise, practical, warm, and reassuring. Give clear safety guidance and help them
understand and manage their help requests.

The person you are helping:
- Name: ${user.name}
- Location: ${user.location || 'not provided'}

Their current help requests (${requests.length}):
${requestLines}

Use this context to give relevant, personalized help. If they ask about the status of
their requests, answer using the list above and do not invent requests that aren't listed.
If they describe a new need, you can suggest they submit a new request from their dashboard.
For any life-threatening emergency, always tell them to call local emergency services (911)
immediately.`;
};

// Build the system prompt for *this* volunteer: their skills and the requests
// they've already offered to help with. Mirrors the help-seeker prompt but
// frames the assistant as a coordinator that helps the volunteer contribute.
const buildVolunteerPrompt = (user, skills, interests) => {
  const skillLines = skills.length
    ? skills.map((s) => `- ${s.name} (self-rated ${s.level}/5)`).join('\n')
    : '- (no skills listed yet)';

  const interestLines = interests.length
    ? interests
        .map(
          (r) =>
            `- ${r.category} (urgency: ${r.urgency}, status: ${r.status}) at ${r.location}: "${r.description}"`
        )
        .join('\n')
    : '- (not signed up to help with any requests yet)';

  return `You are a helpful, encouraging assistant for MapResponse, a disaster-relief platform.
You are chatting with a VOLUNTEER, not a help-seeker: this person is offering aid, not
requesting it. Always answer from that perspective — never treat them as someone in
crisis, never ask if they are safe or need help themselves, and never respond as if they
submitted a help request. Be concise, practical, and supportive. Help them understand the
requests they've signed up for, suggest how their skills can be useful, and guide them on
staying safe while helping others.

The volunteer you are helping:
- Name: ${user.name}
- Location: ${user.location || 'not provided'}

Their skills (${skills.length}):
${skillLines}

Requests they've offered to help with (${interests.length}):
${interestLines}

Use this context to give relevant, personalized guidance. If they ask about the requests
they're helping with, answer using the list above and do not invent requests that aren't
listed. If they want to help more, you can suggest they browse the priority feed or available
tasks from their dashboard. Always remind them to prioritize their own safety, and for any
life-threatening emergency to call local emergency services (911) immediately.`;
};

// Build the system prompt for *this* organization. An org is a coordinator, so
// its assistant answers three kinds of questions: what new help requests have
// come in, what volunteer tasks to post for the requests it has taken on, and
// which of its own resources to allocate to those requests.
//
// @param {Object} user - the signed-in organization's User row
// @param {Object} context - from loadOrganizationContext(): { orgName,
//   resourceTypes, assignedRequests, openRequests, tasks, resources }
const buildOrganizationPrompt = (user, context) => {
  const { orgName, assignedRequests, openRequests, tasks, resources } = context;

  // Requests this org has assigned to itself. These are the ones it can post
  // tasks for and allocate resources to, so they carry the most detail.
  const assignedLines = assignedRequests.length
    ? assignedRequests
        .map(
          (r) =>
            `- [id: ${r.id}] ${r.category} (urgency: ${r.urgency}, status: ${r.status}, household: ${
              r.householdSize > 0 ? r.householdSize : 'unknown'
            }) at ${r.location}: "${r.description}" — tasks posted: ${r.taskCount}, resources allocated: ${r.allocationCount}`
        )
        .join('\n')
    : '- (none — this organization has not taken on any requests yet)';

  // Unclaimed requests, highest AI priority first. This is the "what's new"
  // list the org browses before deciding what to take on.
  const openLines = openRequests.length
    ? openRequests
        .map(
          (r) =>
            `- [id: ${r.id}] ${r.category} (urgency: ${r.urgency}, priority score: ${Math.round(
              r.priorityScore
            )}/100) at ${r.location}: "${r.description}"`
        )
        .join('\n')
    : '- (no unclaimed requests right now)';

  const resourceLines = resources.length
    ? resources
        .map(
          (r) =>
            `- ${r.name} (type: ${r.resourceType}) — ${r.quantity} ${r.unit} on hand${
              r.available ? '' : ' (marked unavailable)'
            }`
        )
        .join('\n')
    : '- (no resources in the resource bank yet)';

  const taskLines = tasks.length
    ? tasks
        .map(
          (task) =>
            `- "${task.title}" (status: ${task.status}, ${task.volunteersConfirmed}/${task.minVolunteers} volunteers, resources ready: ${task.resourcesReady ? 'yes' : 'no'}) for request ${task.requestId}`
        )
        .join('\n')
    : '- (no volunteer tasks posted yet)';

  return `You are a helpful, precise assistant for MapResponse, a disaster-relief platform.
You are chatting with an ORGANIZATION that provides aid — a coordinator, not someone in
crisis and not an individual volunteer. Never treat them as a help-seeker, never ask if
they are safe, and never respond as if they submitted a help request. Speak to them as an
operations partner: concise, practical, and specific.

The organization you are helping:
- Organization: ${orgName}
- Contact name: ${user.name}
- Location: ${user.location || 'not provided'}

Requests this organization has taken on (${assignedRequests.length}):
${assignedLines}

New unclaimed help requests, highest priority first (${openRequests.length}):
${openLines}

This organization's resource bank (${resources.length}):
${resourceLines}

Volunteer tasks this organization has posted (${tasks.length}):
${taskLines}

You help with three things:

1. NEW HELP REQUESTS. Answer questions about the unclaimed requests above — what has come
   in, which are most urgent, and which fit this organization's resources. When you
   recommend taking one on, say why in terms of the actual request and the actual
   inventory above, and tell them they can assign it from the Requests page.

2. RECOMMENDING VOLUNTEER TASKS. For requests the organization has taken on, propose
   concrete, staffable volunteer tasks (what volunteers would do, roughly how many are
   needed, and what skills help). Only propose tasks for requests in the "taken on" list —
   a task must be attached to a request the organization has assigned to itself. Tell them
   the Tasks page can draft and create these.

3. RECOMMENDING RESOURCE ALLOCATIONS. Suggest which items from the resource bank above to
   allocate to which taken-on request, and how much of each. Size quantities to the
   household and never suggest more than the amount on hand. Only name resources that
   appear in the bank above. Allocation requires the request to be assigned to this
   organization first, so if they ask about a request they haven't taken on, say that.

Ground every answer in the lists above. Never invent requests, resources, tasks,
quantities, or statuses that are not listed — if something isn't there, say so plainly.
For any life-threatening emergency, tell them to contact local emergency services (911)
immediately.`;
};

// How many unclaimed requests to put in the org's prompt. The feed can be long;
// the top slice by AI priority is what an org actually triages.
const MAX_OPEN_REQUESTS = 15;

// Load an organization's own data for grounding the assistant.
//
// Two different id spaces are in play here, and mixing them up silently returns
// nothing: a request is claimed via a Response row keyed by the org's USER id
// (`responderId`), while resources and volunteer tasks are keyed by the
// Organization profile id. We look up both.
//
// @param {Object} user - the signed-in organization's User row
// @returns {Promise<Object>} { orgName, assignedRequests, openRequests, tasks,
//   resources } — every list defaults to empty so a missing org profile (the
//   profile row is created lazily on first resource/task call) still chats.
const loadOrganizationContext = async (user) => {
  const org = await prisma.organization.findUnique({ where: { userId: user.id } });

  // Requests this org has claimed, with enough related data to tell the model
  // what has already been done for each one. Only this org's own tasks count
  // toward "tasks posted"; the org profile may not exist yet, in which case it
  // has no tasks at all.
  const claimed = await prisma.response.findMany({
    where: { responderId: user.id, responderType: 'organization' },
    include: {
      request: {
        include: {
          volunteerTasks: { where: { organizationId: org?.id ?? '' } },
          allocations: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const assignedRequests = claimed
    .filter((response) => response.request)
    .map(({ request }) => ({
      id: request.id,
      category: request.category,
      urgency: request.urgency,
      status: request.status,
      location: request.location,
      description: request.description,
      householdSize: request.householdSize,
      taskCount: request.volunteerTasks?.length || 0,
      allocationCount: request.allocations?.length || 0,
    }));

  const claimedIds = new Set(assignedRequests.map((r) => r.id));

  // New requests still open for someone to take on, highest AI priority first.
  const open = await prisma.request.findMany({
    where: { status: { in: ['pending', 'in-progress'] } },
    orderBy: { priorityScore: 'desc' },
    take: MAX_OPEN_REQUESTS + claimedIds.size,
  });

  const openRequests = open
    .filter((r) => !claimedIds.has(r.id))
    .slice(0, MAX_OPEN_REQUESTS);

  // Resources and posted tasks both hang off the Organization profile, which
  // may not exist yet for an org that has never added either.
  const [resources, tasks] = org
    ? await Promise.all([
        prisma.resource.findMany({
          where: { organizationId: org.id },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.volunteerTask.findMany({
          where: { organizationId: org.id },
          orderBy: { createdAt: 'desc' },
        }),
      ])
    : [[], []];

  return {
    orgName: org?.organizationName || user.name,
    assignedRequests,
    openRequests,
    tasks,
    resources,
  };
};

// Load a volunteer's own data for grounding the assistant: their profile skills
// and the requests they've offered to help with. Failures here shouldn't break
// the chat, so callers can treat an empty result as "no data yet."
const loadVolunteerContext = async (userId) => {
  const [profile, interests] = await Promise.all([
    prisma.volunteer.findUnique({ where: { userId } }),
    prisma.response.findMany({
      where: { responderId: userId, responderType: 'volunteer' },
      include: { request: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const skills = parseSkills(profile?.skills);
  const requests = interests.map((response) => ({
    ...response.request,
    responseStatus: response.status,
  }));

  return { skills, requests };
};

// Safely turn the stored skills JSON string into an array of { name, level }.
// Legacy profiles stored a plain array of skill-name strings; those come back
// with a default mid-range level of 3. Returns [] for missing or malformed data.
// (Kept in sync with the same helper in dashboardController.js.)
const parseSkills = (skillsJson) => {
  if (!skillsJson) return [];
  try {
    const parsed = JSON.parse(skillsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => {
        if (typeof s === 'string') {
          return s.trim() ? { name: s.trim(), level: 3 } : null;
        }
        if (s && typeof s.name === 'string' && s.name.trim()) {
          const level = Number(s.level);
          return {
            name: s.name.trim(),
            level: Number.isInteger(level) && level >= 1 && level <= 5 ? level : 3,
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

// POST /api/chat
// Body: { message: string, history?: [{ role: 'user'|'assistant', content: string }] }
// Replies with the assistant's answer, grounded in the caller's own data. The
// system prompt (and the data it's built from) depends on the caller's role.
export const chat = async (req, res) => {
  try {
    // The assistant is available to help-seekers, volunteers, and organizations,
    // each with its own grounded prompt. `hasRole` is admin-permissive, so an
    // admin matches every check — the branch order below decides which persona
    // an admin sees (volunteer first, as before).
    const isHelpSeeker = hasRole(req.user, 'help-seeker');
    const isVolunteer = hasRole(req.user, 'volunteer');
    const isOrganization = hasRole(req.user, 'organization');
    if (!isHelpSeeker && !isVolunteer && !isOrganization) {
      return res.status(403).json({
        success: false,
        message: 'The assistant is not available for this account type.',
      });
    }

    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please include a non-empty message.',
      });
    }

    // Sanitize the client-provided history: keep only well-formed user/assistant
    // turns, and cap how many we forward to the model.
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              VALID_ROLES.has(m.role) &&
              typeof m.content === 'string' &&
              m.content.trim() !== ''
          )
          .slice(-MAX_HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    // Build a role-specific system prompt grounded in the caller's own data.
    let systemPrompt;
    if (isVolunteer) {
      const { skills, requests } = await loadVolunteerContext(req.user.id);
      systemPrompt = buildVolunteerPrompt(req.user, skills, requests);
    } else if (isOrganization) {
      // Orgs get their claimed requests, the open feed, their resource bank, and
      // the tasks they've posted, so the assistant can recommend concretely.
      const context = await loadOrganizationContext(req.user);
      systemPrompt = buildOrganizationPrompt(req.user, context);
    } else {
      // Pull the help-seeker's own requests so the assistant can speak to them.
      const requests = await requestModel.getRequestsByUser(req.user.id);
      systemPrompt = buildHelpSeekerPrompt(req.user, requests);
    }

    const reply = await askLLM(message, { systemPrompt, history: safeHistory });

    // For help-seekers, also check whether this message describes a NEW need. If
    // it does, return a draft the chat renders as an editable card so they can
    // submit it in one tap (via the same POST /api/requests the form uses).
    // Best-effort: a detection failure must never break the chat reply itself.
    let draft = null;
    if (isHelpSeeker) {
      try {
        const convo = [...safeHistory, { role: 'user', content: message }]
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');
        const detection = await detectHelpRequest(convo);
        if (detection.isRequest) {
          draft = {
            category: detection.category,
            urgency: detection.urgency,
            // Fall back to their profile location if they never named one.
            location: detection.location || req.user.location || '',
            description: detection.description,
            householdSize: detection.householdSize,
          };
        }
      } catch (detectError) {
        console.error('Request detection failed:', detectError.message);
      }
    }

    res.status(200).json({
      success: true,
      reply,
      draft,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      message: 'The assistant is unavailable right now. Please try again in a moment.',
    });
  }
};
