import { askLLM } from './chatbot.js';

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
 * As with the resource advisor, we ask an LLM via askLLM (Anthropic locally,
 * then OpenRouter -> Gemini -> OpenAI) but always fall back to a simple
 * deterministic rule so the feature works even without a live API key. Every
 * suggested date is validated to be a real, future ISO date before we return it.
 */

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
 * @param {number} [context.volunteerCount] - volunteers signed up for the task
 * @param {Object} [context.volunteerWeekdayCoverage] - map of lowercase weekday
 *   -> how many signed-up volunteers are free that day (e.g. { monday: 3 })
 * @param {Date}   [context.today] - "now" (injectable for testing)
 * @returns {Promise<Array>} array of { date: 'YYYY-MM-DD', reason: string }
 */
export async function suggestTaskDates(task, context = {}) {
  const today = context.today instanceof Date ? context.today : new Date();

  try {
    const suggestion = await askForDates(task, context, today);
    const cleaned = sanitizeSuggestion(suggestion, today);
    return cleaned.length > 0 ? cleaned : heuristicDates(task, today, context);
  } catch (error) {
    console.error('Task date advisor AI failed, using heuristic fallback:', error.message);
    return heuristicDates(task, today, context);
  }
}

// Weekday index (0 = Sunday, matching Date#getDay) for each lowercase name, so
// the heuristic can nudge a candidate date onto a well-covered weekday.
const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// Render the volunteer weekday-coverage map for the prompt, e.g.
// "Monday (3), Saturday (2)". Falls back to a plain note when there's no data.
function formatWeekdayCoverage(coverage) {
  if (!coverage || typeof coverage !== 'object') return 'unknown';
  const parts = Object.keys(WEEKDAY_INDEX)
    .filter((day) => coverage[day] > 0)
    .map((day) => `${day.charAt(0).toUpperCase() + day.slice(1)} (${coverage[day]})`);
  return parts.length ? parts.join(', ') : 'no volunteers have set availability yet';
}

// --- LLM call ---

async function askForDates(task, context, today) {
  const reply = await askLLM(buildPrompt(task, context, today), {
    systemPrompt:
      'You suggest volunteer-day dates for a disaster-relief organization. ' +
      'You reply with ONLY a JSON array and no other text, code fences, or commentary.',
    // Fall through to the next provider if the reply contains no JSON array.
    validate: (r) => typeof r === 'string' && /\[[\s\S]*\]/.test(r),
  });
  return parseJsonArray(reply);
}

function buildPrompt(task, context, today) {
  const skillsNeeded = parseList(task.skillsNeeded);
  const availableSkills = Array.isArray(context.availableSkills)
    ? context.availableSkills
    : [];
  const missingSkills = skillsNeeded.filter((s) => !availableSkills.includes(s));

  const minMet = task.volunteersConfirmed >= task.minVolunteers;
  const todayIso = toIsoDate(today);
  const coverageLine = formatWeekdayCoverage(context.volunteerWeekdayCoverage);

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
- Signed-up volunteers' weekly availability: ${coverageLine}

Guidance:
- Higher urgency -> sooner dates.
- If the minimum volunteers are not met, or resources aren't ready, or skills are missing, allow more lead time so the gaps can be filled.
- Prefer weekdays when the most signed-up volunteers are available. If a weekday has no volunteer availability, avoid it unless urgency forces it. Each suggested date's weekday should, where possible, be one the volunteers are free on.
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
// ready). When we know which weekdays the signed-up volunteers are free, nudge
// each candidate forward to the next covered weekday. Returns three spread-out
// options.
function heuristicDates(task, today, context = {}) {
  // Base lead time in days by urgency — more urgent means sooner.
  const baseByUrgency = { Critical: 2, High: 4, Medium: 7, Low: 14 };
  let lead = baseByUrgency[task.urgency] ?? 7;

  // Not ready yet? Give more runway to fill the gaps.
  if (task.volunteersConfirmed < task.minVolunteers) lead += 5;
  if (!task.resourcesReady) lead += 3;

  // Weekdays (0-6) at least one signed-up volunteer is free on.
  const coverage = context.volunteerWeekdayCoverage;
  const coveredDays = coverage
    ? Object.keys(WEEKDAY_INDEX).filter((d) => coverage[d] > 0).map((d) => WEEKDAY_INDEX[d])
    : [];
  const hasCoverage = coveredDays.length > 0;

  // Three options: the computed lead, and two progressively safer dates.
  const offsets = [lead, lead + 4, lead + 9];
  const baseReasons = [
    'Earliest date that fits the task urgency and current readiness.',
    'Balanced option with extra buffer to confirm volunteers and resources.',
    'Safer date allowing time to fill any remaining gaps.',
  ];

  const seen = new Set();
  const options = [];
  for (let i = 0; i < offsets.length; i++) {
    let date = new Date(today.getTime() + offsets[i] * DAY_MS);
    let reason = baseReasons[i];

    // Shift forward (up to a week) to the next weekday volunteers are free on.
    if (hasCoverage) {
      const shifted = nextCoveredDate(date, coveredDays);
      if (shifted) {
        date = shifted;
        reason += ' Falls on a day your signed-up volunteers are available.';
      }
    }

    // Avoid emitting duplicate dates after shifting; push out a day if needed.
    let iso = toIsoDate(date);
    while (seen.has(iso)) {
      date = new Date(date.getTime() + DAY_MS);
      iso = toIsoDate(date);
    }
    seen.add(iso);
    options.push({ date: iso, reason });
  }
  return options;
}

// Given a date, return the soonest date on or after it whose weekday is in
// `coveredDays` (Date#getDay values). Searches up to a week; null if none.
function nextCoveredDate(date, coveredDays) {
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(date.getTime() + i * DAY_MS);
    if (coveredDays.includes(candidate.getDay())) return candidate;
  }
  return null;
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
