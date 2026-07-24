import { anthropic } from './clients.js';

/**
 * Resource Advisor
 * Given a help request and the resources an organization currently has
 * available, suggest which resources (and how much of each) to allocate.
 *
 * The suggestion always comes back as an array of:
 *   { resourceId, quantity, reason }
 * where resourceId is one the org actually has available. We ask Claude for a
 * recommendation, but fall back to a simple category-based heuristic if the AI
 * call fails or returns something we can't use — so the feature works even
 * without a live API key.
 */

// Same Claude model/env convention the explainer uses.
const ADVISOR_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// Roughly how many units of a resource one person needs. Used both to seed the
// heuristic fallback and to cap the AI's suggestion at something sensible.
const PER_PERSON = {
  food: 3, // meals per person (a day's worth)
  wood: 1, // bundles per person
  'health-care-kits': 1, // one kit per person
};

// Which resource types tend to match which request categories. Drives the
// deterministic fallback so a suggestion is always available.
const CATEGORY_TO_TYPES = {
  Food: ['food'],
  Shelter: ['wood', 'food'],
  Medical: ['health-care-kits'],
  Transport: [],
  Other: ['food', 'wood', 'health-care-kits'],
};

/**
 * Suggest resource allocations for a request.
 *
 * @param {Object} request - the help request { category, urgency, description,
 *   householdSize, location }
 * @param {Array} availableResources - the org's available resources, each
 *   { id, resourceType, name, quantity, unit }
 * @returns {Promise<Array>} array of { resourceId, quantity, reason }
 */
export async function suggestAllocations(request, availableResources) {
  // Nothing on hand to give — no suggestion to make.
  if (!availableResources || availableResources.length === 0) {
    return [];
  }

  try {
    const suggestion = await askClaudeForAllocations(request, availableResources);
    const cleaned = sanitizeSuggestion(suggestion, request, availableResources);
    // If the model gave us nothing usable, fall back to the heuristic.
    return cleaned.length > 0
      ? cleaned
      : heuristicAllocations(request, availableResources);
  } catch (error) {
    console.error('Resource advisor AI failed, using heuristic fallback:', error.message);
    return heuristicAllocations(request, availableResources);
  }
}

// --- Claude call ---

async function askClaudeForAllocations(request, availableResources) {
  const prompt = buildPrompt(request, availableResources);

  const response = await anthropic.messages.create({
    model: ADVISOR_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  return parseJsonArray(text);
}

function buildPrompt(request, availableResources) {
  const household = request.householdSize > 0 ? request.householdSize : 'unknown';
  const inventory = availableResources
    .map(
      (r) =>
        `- id: ${r.id} | type: ${r.resourceType} | name: ${r.name} | on hand: ${r.quantity} ${r.unit}`
    )
    .join('\n');

  return `You help a disaster-relief organization decide which of its available resources to assign to a specific help request.

Help request:
- Category: ${request.category}
- Urgency: ${request.urgency}
- People in household: ${household}
- Description: ${request.description}

Resources the organization has available (only choose from these):
${inventory}

Decide which resources to allocate and how much of each. Base the quantity on the household size and the nature of the request. Never suggest more than the amount on hand.

Respond with ONLY a JSON array, no prose, in exactly this shape:
[
  { "resourceId": "<id from the list>", "quantity": <whole number >= 1>, "reason": "<short reason, under 15 words>" }
]

If nothing in the inventory fits the request, respond with an empty array: []`;
}

// Pull the first JSON array out of the model's text. Returns [] if none found.
function parseJsonArray(text) {
  try {
    return JSON.parse(text);
  } catch {
    // The model sometimes wraps the array in prose or a code fence; grab the
    // outermost [...] and try again.
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      return JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
}

// Keep only suggestions that reference a real available resource with a sane
// quantity, clamped to what's actually on hand.
function sanitizeSuggestion(suggestion, request, availableResources) {
  if (!Array.isArray(suggestion)) return [];

  const byId = new Map(availableResources.map((r) => [r.id, r]));
  const seen = new Set();
  const cleaned = [];

  for (const item of suggestion) {
    const resource = byId.get(item?.resourceId);
    if (!resource || seen.has(resource.id)) continue;

    let quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) continue;
    // Never allocate more than the org has on hand.
    quantity = Math.min(quantity, resource.quantity);

    seen.add(resource.id);
    cleaned.push({
      resourceId: resource.id,
      quantity,
      reason: typeof item.reason === 'string' ? item.reason.slice(0, 120) : '',
    });
  }

  return cleaned;
}

// --- Deterministic fallback ---

// Suggest allocations without the AI: match the request's category to sensible
// resource types and size each by the household. Always caps at what's on hand.
function heuristicAllocations(request, availableResources) {
  const preferredTypes = CATEGORY_TO_TYPES[request.category] || CATEGORY_TO_TYPES.Other;
  const people = request.householdSize > 0 ? request.householdSize : 1;

  const suggestions = [];
  for (const type of preferredTypes) {
    const resource = availableResources.find((r) => r.resourceType === type);
    if (!resource) continue;

    const perPerson = PER_PERSON[type] || 1;
    const quantity = Math.max(1, Math.min(perPerson * people, resource.quantity));

    suggestions.push({
      resourceId: resource.id,
      quantity,
      reason: `${quantity} ${resource.unit} for a household of ${people}.`,
    });
  }

  return suggestions;
}
