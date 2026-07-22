// Turn a real crisis event into a few plausible help requests.
//
// A raw event ("M6.1 earthquake near Ridgecrest, CA") isn't itself a help
// request — our product is people asking for help. This bridges the two: given
// a normalized event, it asks the model for a handful of realistic requests a
// person nearby might file in the aftermath (food, shelter, medical, …). The
// output is geographically coherent with the event, so the feed, clustering,
// and heatmap all light up around a real place instead of synthetic noise.
//
// We reuse askChatbot (OpenRouter free models, OpenAI chat format) exactly like
// extractor.js, including the ONLY-JSON discipline and defensive parsing, so
// this survives whatever a free model hands back.

import { askChatbot } from '../ai/chatbot.js';

// Kept in sync with requestController.createRequest validation (same lists the
// extractor guards against).
const VALID_CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const VALID_URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Generate plausible help requests inspired by a real crisis event.
 *
 * @param {object} event - a normalized event from an ingestion adapter
 * @param {object} [options]
 * @param {number} [options.count] - how many requests to ask for (default 3)
 * @returns {Promise<Array<{category,urgency,location,description}>>}
 *   Normalized, validated request seeds. Empty array if the model can't be
 *   parsed — the caller can still seed the raw event on its own.
 */
export async function generateRequestsForEvent(event, { count = 3 } = {}) {
  if (!event || !event.location) return [];

  let reply;
  try {
    reply = await askChatbot(buildPrompt(event, count), {
      systemPrompt:
        'You generate realistic crisis help-request data for a disaster-response demo. ' +
        'You reply with ONLY a single JSON array and no other text, code fences, or commentary.',
      validate: (r) => Array.isArray(parseJsonArray(r)),
    });
  } catch (err) {
    console.error(`  Could not generate requests for ${event.externalId}:`, err.message);
    return [];
  }

  const parsed = parseJsonArray(reply);
  if (!parsed) return [];

  return parsed
    .map((item) => normalizeRequest(item, event))
    .filter(Boolean)
    .slice(0, count);
}

// Build the instruction prompt around a single event.
function buildPrompt(event, count) {
  const mag = event.magnitude != null ? ` (magnitude ${event.magnitude})` : '';
  return `A real crisis just occurred: ${event.description}${mag}
Location: ${event.location}
Severity: ${event.severity}

Generate ${count} realistic, DISTINCT help requests that different people near this location might submit in the aftermath. Vary the categories and urgencies so the set feels like a real community's needs.

Return ONLY a JSON array of exactly ${count} objects, each with these keys:
{
  "category": one of ${JSON.stringify(VALID_CATEGORIES)},
  "urgency": one of ${JSON.stringify(VALID_URGENCIES)},
  "description": string (a neutral 1-2 sentence first-person description of the need; do NOT invent specific names, phone numbers, or addresses)
}

Rules:
- Ground every request in the event above (same kind of disaster, same area).
- Keep descriptions realistic and concise; no melodrama, no invented personal details.
- Output the JSON array only — no markdown, no code fences, no explanation.`;
}

// Pull the first JSON array out of a model reply. Mirrors extractor.js's
// parseJsonObject but for an array payload.
function parseJsonArray(reply) {
  if (!reply || typeof reply !== 'string') return null;

  const unfenced = reply.replace(/```(?:json)?/gi, '').trim();

  const candidates = [unfenced];
  const first = unfenced.indexOf('[');
  const last = unfenced.lastIndexOf(']');
  if (first !== -1 && last > first) {
    candidates.push(unfenced.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    try {
      const arr = JSON.parse(candidate);
      if (Array.isArray(arr)) return arr;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// Coerce one model item into a valid request seed, inheriting the event's
// location so the request geocodes to where the disaster actually happened.
function normalizeRequest(item = {}, event) {
  const description =
    typeof item.description === 'string' ? item.description.trim() : '';
  if (!description) return null;

  const category = VALID_CATEGORIES.includes(item.category)
    ? item.category
    : 'Other';
  const urgency = VALID_URGENCIES.includes(item.urgency)
    ? item.urgency
    : 'Medium';

  return {
    category,
    urgency,
    location: event.location,
    latitude: event.latitude,
    longitude: event.longitude,
    description,
  };
}

export default { generateRequestsForEvent };
