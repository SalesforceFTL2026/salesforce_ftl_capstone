import { askChatbot } from './chatbot.js';

// These MUST stay in sync with the validation in requestController.createRequest.
const VALID_CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const VALID_URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Extract structured help-request fields from a voice transcript.
 *
 * We go through OpenRouter (via askChatbot) rather than the Anthropic SDK
 * directly: the deployment only has an OpenRouter key, and OpenRouter's free
 * models speak the OpenAI chat format, not Anthropic tool-use. So instead of
 * forcing a tool call we ask for a strict JSON object and parse it defensively.
 *
 * The returned object mirrors the shape createRequest expects, plus a per-field
 * `confidence` map that the frontend "confirm what we heard" step (#156) uses to
 * highlight anything the caller should double-check before submitting.
 *
 * @param {string} transcript - Transcribed text of what the caller said
 * @returns {Promise<{category: string, urgency: string, location: string,
 *   description: string, householdSize: number|null, confidence: Object}>}
 * @throws {Error} - If the transcript is empty or no usable JSON comes back
 */
export async function extractRequestFields(transcript) {
  const text = (transcript || '').trim();
  if (!text) {
    throw new Error('Cannot extract fields from an empty transcript');
  }

  const reply = await askChatbot(buildExtractionPrompt(text), {
    systemPrompt:
      'You extract structured data from crisis help-request transcripts. ' +
      'You reply with ONLY a single JSON object and no other text, code fences, or commentary.',
  });

  const parsed = parseJsonObject(reply);
  if (!parsed) {
    throw new Error('Model did not return parseable JSON request fields');
  }

  return normalizeExtraction(parsed);
}

/**
 * Build the instruction prompt wrapped around the caller's transcript.
 *
 * @param {string} transcript - Trimmed transcript text
 * @returns {string}
 */
function buildExtractionPrompt(transcript) {
  return `Extract the help-request fields from this crisis call transcript and return them as JSON.

Return ONLY a JSON object with exactly these keys:
{
  "category": one of ${JSON.stringify(VALID_CATEGORIES)},
  "urgency": one of ${JSON.stringify(VALID_URGENCIES)},
  "location": string (where help is needed, exactly as said; "" if none given),
  "description": string (a neutral 1-2 sentence summary of the need),
  "householdSize": integer number of people affected, or null if not stated,
  "confidence": { "category": 0-1, "urgency": 0-1, "location": 0-1, "description": 0-1, "householdSize": 0-1 }
}

Rules:
- Only use information actually present in the transcript. Do NOT invent details.
- category: use "Other" if it does not clearly fit the rest.
- urgency: infer from tone and content (e.g. "trapped", "no water", "injured" => higher urgency).
- confidence: give an honest 0-1 score per field; use a low score (below 0.6) when you had to guess or the transcript was vague or garbled.
- Output the JSON object only — no markdown, no code fences, no explanation.

Transcript:
"""
${transcript}
"""`;
}

/**
 * Pull the first JSON object out of a model reply. Free models sometimes wrap
 * the JSON in prose or ```json fences, so we locate the outermost braces rather
 * than trusting the whole string to be clean JSON.
 *
 * @param {string} reply - Raw model text
 * @returns {Object|null} - Parsed object, or null if none could be parsed
 */
function parseJsonObject(reply) {
  if (!reply || typeof reply !== 'string') return null;

  // Strip common code-fence wrappers first.
  const unfenced = reply.replace(/```(?:json)?/gi, '').trim();

  // Try the whole thing, then fall back to the outermost { ... } slice.
  const candidates = [unfenced];
  const first = unfenced.indexOf('{');
  const last = unfenced.lastIndexOf('}');
  if (first !== -1 && last > first) {
    candidates.push(unfenced.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object') return obj;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Defensively coerce the parsed JSON into the exact contract, in case the model
 * returns an out-of-enum value or malformed confidence map.
 *
 * @param {Object} input - Parsed model output
 * @returns {Object} - Normalized fields
 */
function normalizeExtraction(input = {}) {
  const category = VALID_CATEGORIES.includes(input.category)
    ? input.category
    : 'Other';
  const urgency = VALID_URGENCIES.includes(input.urgency)
    ? input.urgency
    : 'Medium';

  let householdSize = null;
  const n = Number(input.householdSize);
  if (Number.isInteger(n) && n > 0) {
    householdSize = n;
  }

  const rawConfidence = input.confidence || {};
  const clamp = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 && num <= 1 ? num : 0;
  };

  return {
    category,
    urgency,
    location: typeof input.location === 'string' ? input.location.trim() : '',
    description:
      typeof input.description === 'string' ? input.description.trim() : '',
    householdSize,
    confidence: {
      category: clamp(rawConfidence.category),
      urgency: clamp(rawConfidence.urgency),
      location: clamp(rawConfidence.location),
      description: clamp(rawConfidence.description),
      householdSize: clamp(rawConfidence.householdSize),
    },
  };
}
