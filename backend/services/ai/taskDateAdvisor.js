import { anthropic } from './clients.js';

/**
 * Task Date Advisor
 * Given a volunteer task plus context about the organization's readiness,
 * suggest 2-3 candidate dates for the volunteer day, each with a short reason.
 *
 * Factors we feed the model:
 *   - urgency / priority of the task
 *   - whether the minimum number of volunteers is met
 *   - whether the necessary resources are ready
 *   - the skills the task needs vs. what's available
 *
 * As with the resource advisor, we ask Claude but always fall back to a simple
 * deterministic rule so the feature works even without a live API key. Every
 * suggested date is validated to be a real, future ISO date before we return it.
 */

const ADVISOR_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// How many candidate dates we aim to return.
const NUM_SUGGESTIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Suggest volunteer-day dates for a task.
 *
 * @param {Object} task - the volunteer task { title, description, category,
 *   urgency, skillsNeeded, minVolunteers, maxVolunteers, volunteersConfirmed,
 *   resourcesReady }
 * @param {Object} [context] - optional extra signals
 * @param {string[]} [context.availableSkills] - skills the org's volunteers cover
 * @param {number} [context.availableResourceCount] - resources currently available
 * @param {Date}   [context.today] - "now" (injectable for testing)
 * @returns {Promise<Array>} array of { date: 'YYYY-MM-DD', reason: string }
 */
export async function suggestTaskDates(task, context = {}) {
  const today = context.today instanceof Date ? context.today : new Date();

  try {
    const suggestion = await askClaudeForDates(task, context, today);
    const cleaned = sanitizeSuggestion(suggestion, today);
    return cleaned.length > 0 ? cleaned : heuristicDates(task, today);
  } catch (error) {
    console.error('Task date advisor AI failed, using heuristic fallback:', error.message);
    return heuristicDates(task, today);
  }
}

// --- Claude call ---

async function askClaudeForDates(task, context, today) {
  const prompt = buildPrompt(task, context, today);

  const response = await anthropic.messages.create({
    model: ADVISOR_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  return parseJsonArray(text);
}

function buildPrompt(task, context, today) {
  const skillsNeeded = parseList(task.skillsNeeded);
  const availableSkills = Array.isArray(context.availableSkills)
    ? context.availableSkills
    : [];
  const missingSkills = skillsNeeded.filter((s) => !availableSkills.includes(s));

  const minMet = task.volunteersConfirmed >= task.minVolunteers;
  const todayIso = toIsoDate(today);

  return `You help a disaster-relief organization schedule the "volunteer day" for a task — the date volunteers should show up to do the work.

Today's date is ${todayIso}. Only suggest dates AFTER today.

Task:
- Title: ${task.title}
- Description: ${task.description}
- Category: ${task.category || 'unspecified'}
- Urgency/priority: ${task.urgency || 'Medium'}
- Volunteers: ${task.volunteersConfirmed} confirmed of ${task.minVolunteers} minimum needed${task.maxVolunteers ? ` (max ${task.maxVolunteers})` : ''}
- Minimum volunteers met: ${minMet ? 'yes' : 'no'}
- Necessary resources ready: ${task.resourcesReady ? 'yes' : 'no'}
- Skills needed: ${skillsNeeded.length ? skillsNeeded.join(', ') : 'none specified'}
- Skills currently missing among volunteers: ${missingSkills.length ? missingSkills.join(', ') : 'none'}
- Resources currently available in inventory: ${context.availableResourceCount ?? 'unknown'}

Guidance:
- Higher urgency -> sooner dates.
- If the minimum volunteers are not met, or resources aren't ready, or skills are missing, allow more lead time so the gaps can be filled.
- Offer a spread of options (e.g. earliest reasonable, balanced, and a safer later date).

Respond with ONLY a JSON array of exactly ${NUM_SUGGESTIONS} options, no prose, in this shape:
[
  { "date": "YYYY-MM-DD", "reason": "<short reason, under 20 words>" }
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

// Keep only options with a real, future date and a usable reason. De-dupes
// dates and caps to NUM_SUGGESTIONS.
function sanitizeSuggestion(suggestion, today) {
  if (!Array.isArray(suggestion)) return [];

  const todayStart = startOfDay(today).getTime();
  const seen = new Set();
  const cleaned = [];

  for (const item of suggestion) {
    const iso = normalizeIsoDate(item?.date);
    if (!iso) continue;

    const time = new Date(`${iso}T00:00:00`).getTime();
    if (Number.isNaN(time) || time <= todayStart) continue; // must be in the future
    if (seen.has(iso)) continue;

    seen.add(iso);
    cleaned.push({
      date: iso,
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 140) : '',
    });
    if (cleaned.length >= NUM_SUGGESTIONS) break;
  }

  return cleaned;
}

// --- Deterministic fallback ---

// Suggest dates without the AI: base the lead time on urgency, then push it out
// further when the task isn't ready yet (min volunteers unmet or resources not
// ready). Returns three spread-out options.
function heuristicDates(task, today) {
  // Base lead time in days by urgency — more urgent means sooner.
  const baseByUrgency = { Critical: 2, High: 4, Medium: 7, Low: 14 };
  let lead = baseByUrgency[task.urgency] ?? 7;

  // Not ready yet? Give more runway to fill the gaps.
  if (task.volunteersConfirmed < task.minVolunteers) lead += 5;
  if (!task.resourcesReady) lead += 3;

  // Three options: the computed lead, and two progressively safer dates.
  const offsets = [lead, lead + 4, lead + 9];
  const reasons = [
    'Earliest date that fits the task urgency and current readiness.',
    'Balanced option with extra buffer to confirm volunteers and resources.',
    'Safer date allowing time to fill any remaining gaps.',
  ];

  return offsets.map((days, i) => ({
    date: toIsoDate(new Date(today.getTime() + days * DAY_MS)),
    reason: reasons[i],
  }));
}

// --- small helpers ---

function parseList(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Accept a Date, ISO string, or 'YYYY-MM-DD' and return 'YYYY-MM-DD' or null.
function normalizeIsoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

export default { suggestTaskDates };
