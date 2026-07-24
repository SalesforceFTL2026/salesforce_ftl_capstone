import { anthropic } from './clients.js';

/**
 * Task Suggestion Advisor
 * Given an existing help request, propose 2-3 concrete volunteer tasks the
 * organization could post to address it. Each suggestion is a ready-to-edit
 * draft: title, description, category, urgency, skills, and a min/max number of
 * volunteers.
 *
 * As with the other AI advisors, we ask Claude but always fall back to a simple
 * deterministic rule so the feature works even without a live API key. Every
 * suggestion is sanitized to the shape and vocabulary the task form expects
 * before it is returned.
 */

const ADVISOR_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// How many task drafts we aim to return.
const NUM_SUGGESTIONS = 3;

// Vocabulary the task form / controller accept. Anything outside these is
// coerced to a safe default during sanitizing.
const CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Suggest volunteer tasks for a help request.
 *
 * @param {Object} request - the help request { category, urgency, location,
 *   description }
 * @returns {Promise<Array>} array of task drafts:
 *   { title, description, category, urgency, skillsNeeded: string[],
 *     minVolunteers, maxVolunteers }
 */
export async function suggestTasksForRequest(request) {
  try {
    const raw = await askClaudeForTasks(request);
    const cleaned = sanitizeSuggestions(raw, request);
    return cleaned.length > 0 ? cleaned : heuristicTasks(request);
  } catch (error) {
    console.error('Task suggestion AI failed, using heuristic fallback:', error.message);
    return heuristicTasks(request);
  }
}

// --- Claude call ---

async function askClaudeForTasks(request) {
  const prompt = buildPrompt(request);

  const response = await anthropic.messages.create({
    model: ADVISOR_MODEL,
    max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  return parseJsonArray(text);
}

function buildPrompt(request) {
  return `You help a disaster-relief organization break a help request into concrete volunteer tasks it can staff and post.

Help request:
- Category: ${request.category || 'unspecified'}
- Urgency: ${request.urgency || 'Medium'}
- Location: ${request.location || 'unspecified'}
- Description: ${request.description || '(no description)'}

Propose ${NUM_SUGGESTIONS} distinct, actionable volunteer tasks that would help fulfill this request. Keep them grounded in the request — do not invent facts that aren't implied by it.

For each task:
- title: short and action-oriented (under 60 chars)
- description: 1-2 sentences on what volunteers will do
- category: one of ${CATEGORIES.join(', ')}
- urgency: one of ${URGENCIES.join(', ')} (match or stay close to the request's urgency)
- skillsNeeded: array of 0-4 short skill names (e.g. "driving", "medical", "translation")
- minVolunteers: whole number >= 1
- maxVolunteers: whole number >= minVolunteers, or null for no cap

Respond with ONLY a JSON array of exactly ${NUM_SUGGESTIONS} objects, no prose, in this shape:
[
  {
    "title": "...",
    "description": "...",
    "category": "...",
    "urgency": "...",
    "skillsNeeded": ["..."],
    "minVolunteers": 2,
    "maxVolunteers": 6
  }
]`;
}

// Pull the first JSON array out of the model's text. Returns [] if none found.
function parseJsonArray(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      return JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
}

// Coerce each raw suggestion into the exact shape/vocabulary the task form
// expects. Drops anything without a usable title/description, and caps to
// NUM_SUGGESTIONS.
function sanitizeSuggestions(raw, request) {
  if (!Array.isArray(raw)) return [];

  const cleaned = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const description =
      typeof item.description === 'string' ? item.description.trim() : '';
    if (!title || !description) continue;

    const min = toPositiveInt(item.minVolunteers, 1);
    const max = normalizeMax(item.maxVolunteers, min);

    cleaned.push({
      title: title.slice(0, 120),
      description: description.slice(0, 600),
      category: CATEGORIES.includes(item.category)
        ? item.category
        : requestCategory(request),
      urgency: URGENCIES.includes(item.urgency)
        ? item.urgency
        : requestUrgency(request),
      skillsNeeded: normalizeSkills(item.skillsNeeded),
      minVolunteers: min,
      maxVolunteers: max,
    });

    if (cleaned.length >= NUM_SUGGESTIONS) break;
  }

  return cleaned;
}

// --- Deterministic fallback ---

// Build a few generic-but-relevant task drafts from the request itself, so the
// org still gets useful starting points without the AI. We tailor the first
// task to the request's category and keep two general support tasks.
function heuristicTasks(request) {
  const category = requestCategory(request);
  const urgency = requestUrgency(request);
  const where = request.location ? ` in ${request.location}` : '';

  const byCategory = {
    Food: {
      title: 'Prepare and distribute food',
      description: `Pack and hand out meals or groceries to the household that requested help${where}.`,
      skillsNeeded: ['food handling'],
    },
    Shelter: {
      title: 'Set up temporary shelter',
      description: `Help set up and prepare safe shelter space for the people in this request${where}.`,
      skillsNeeded: ['manual labor'],
    },
    Medical: {
      title: 'Provide basic medical support',
      description: `Assist with first aid and check-ins for the people in this request${where}.`,
      skillsNeeded: ['medical', 'first aid'],
    },
    Transport: {
      title: 'Transport people or supplies',
      description: `Drive people or deliver needed supplies for this request${where}.`,
      skillsNeeded: ['driving'],
    },
    Other: {
      title: 'On-site support',
      description: `Provide hands-on help for the need described in this request${where}.`,
      skillsNeeded: [],
    },
  };

  const primary = byCategory[category] || byCategory.Other;

  return [
    {
      title: primary.title,
      description: primary.description,
      category,
      urgency,
      skillsNeeded: primary.skillsNeeded,
      minVolunteers: 2,
      maxVolunteers: 6,
    },
    {
      title: 'Coordinate logistics',
      description: `Organize volunteers, supplies, and scheduling for this ${category.toLowerCase()} request${where}.`,
      category,
      urgency,
      skillsNeeded: ['logistics'],
      minVolunteers: 1,
      maxVolunteers: 3,
    },
    {
      title: 'Check in with the household',
      description: 'Follow up with the people who requested help to confirm needs are met and gather any updates.',
      category,
      urgency: 'Low',
      skillsNeeded: [],
      minVolunteers: 1,
      maxVolunteers: 2,
    },
  ];
}

// --- small helpers ---

function requestCategory(request) {
  return CATEGORIES.includes(request?.category) ? request.category : 'Other';
}

function requestUrgency(request) {
  return URGENCIES.includes(request?.urgency) ? request.urgency : 'Medium';
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

// Max may be null (no cap); if provided it must be a whole number >= min.
function normalizeMax(value, min) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) return null;
  return n;
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s) => typeof s === 'string' && s.trim() !== '')
    .map((s) => s.trim().slice(0, 40))
    .slice(0, 4);
}

export default { suggestTasksForRequest };
