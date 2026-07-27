import { askLLM } from '../services/ai/chatbot.js';
import * as requestModel from '../models/requestModel.js';
import prisma from '../services/database/prisma.js';
import { hasRole } from '../utils/roles.js';

/**
 * Chat Controller
 * Handles the AI assistant chat for help-seekers and volunteers. Each role gets
 * a system prompt grounded in that person's own data, so the assistant can speak
 * to their actual situation instead of giving generic answers.
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
    // The assistant is available to help-seekers and volunteers. Anyone else
    // (e.g. organizations, admins) doesn't have a personal-assistant view yet.
    const isHelpSeeker = hasRole(req.user, 'help-seeker');
    const isVolunteer = hasRole(req.user, 'volunteer');
    if (!isHelpSeeker && !isVolunteer) {
      return res.status(403).json({
        success: false,
        message: 'The assistant is only available to help-seekers and volunteers.',
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
    } else {
      // Pull the help-seeker's own requests so the assistant can speak to them.
      const requests = await requestModel.getRequestsByUser(req.user.id);
      systemPrompt = buildHelpSeekerPrompt(req.user, requests);
    }

    const reply = await askLLM(message, { systemPrompt, history: safeHistory });

    res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      message: 'The assistant is unavailable right now. Please try again in a moment.',
      error: error.message,
    });
  }
};
