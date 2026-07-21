import { anthropic } from './clients.js';

// Claude model used to extract structured request fields from a voice
// transcript. Configurable via env so it can track whatever model id the key's
// endpoint accepts without a code change.
const EXTRACTION_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// These MUST stay in sync with the validation in requestController.createRequest.
const VALID_CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const VALID_URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

// Tool schema forces Claude to return a well-formed object instead of prose we
// would have to parse. Every field is required so the model can't silently drop
// one; unknown values are represented explicitly (null / "Other").
const EXTRACTION_TOOL = {
  name: 'record_help_request',
  description:
    'Record the structured help-request fields extracted from what the caller said.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: VALID_CATEGORIES,
        description:
          'The kind of help needed. Use "Other" if it does not clearly fit the rest.',
      },
      urgency: {
        type: 'string',
        enum: VALID_URGENCIES,
        description:
          'How time-critical the need is. Critical = life-threatening/immediate.',
      },
      location: {
        type: 'string',
        description:
          'Where help is needed, as spoken (address, cross-streets, city, or landmark). Empty string if the caller gave none.',
      },
      description: {
        type: 'string',
        description:
          'A concise 1-2 sentence summary of the need, in plain language.',
      },
      householdSize: {
        type: ['integer', 'null'],
        description:
          'Number of people affected, if stated. null if not mentioned.',
      },
      confidence: {
        type: 'object',
        description:
          'Confidence 0-1 for each extracted field, so a human can review low-confidence values before submitting.',
        properties: {
          category: { type: 'number' },
          urgency: { type: 'number' },
          location: { type: 'number' },
          description: { type: 'number' },
          householdSize: { type: 'number' },
        },
        required: ['category', 'urgency', 'location', 'description', 'householdSize'],
      },
    },
    required: ['category', 'urgency', 'location', 'description', 'householdSize', 'confidence'],
  },
};

/**
 * Extract structured help-request fields from a voice transcript via Claude.
 *
 * The returned object mirrors the shape createRequest expects, plus a per-field
 * `confidence` map that the frontend "confirm what we heard" step (#156) uses to
 * highlight anything the caller should double-check before submitting.
 *
 * @param {string} transcript - Transcribed text of what the caller said
 * @returns {Promise<{category: string, urgency: string, location: string,
 *   description: string, householdSize: number|null,
 *   confidence: Object}>}
 * @throws {Error} - If the transcript is empty or Claude returns no tool call
 */
export async function extractRequestFields(transcript) {
  const text = (transcript || '').trim();
  if (!text) {
    throw new Error('Cannot extract fields from an empty transcript');
  }

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 500,
    tools: [EXTRACTION_TOOL],
    // Force the model to call our tool rather than reply with prose.
    tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name },
    messages: [
      {
        role: 'user',
        content: buildExtractionPrompt(text),
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Claude did not return structured request fields');
  }

  return normalizeExtraction(toolUse.input);
}

/**
 * Build the instruction prompt wrapped around the caller's transcript.
 *
 * @param {string} transcript - Trimmed transcript text
 * @returns {string}
 */
function buildExtractionPrompt(transcript) {
  return `You are helping intake a crisis help request from a phone call. Below is a transcript of what the caller said. Extract the structured fields by calling the record_help_request tool.

Rules:
- Only use information actually present in the transcript. Do NOT invent details.
- category must be one of: ${VALID_CATEGORIES.join(', ')}. Use "Other" if unclear.
- urgency must be one of: ${VALID_URGENCIES.join(', ')}. Infer from tone and content (e.g. "trapped", "no water", "injured" => higher urgency).
- location: capture exactly what the caller said about where they are. Use an empty string if they gave none.
- description: a neutral 1-2 sentence summary of the need. No emotional embellishment.
- householdSize: only fill in if a number of people is stated; otherwise null.
- confidence: give an honest 0-1 score per field. Use a low score when you had to guess or the transcript was vague/garbled.

Transcript:
"""
${transcript}
"""`;
}

/**
 * Defensively coerce Claude's tool input into the exact contract, in case the
 * model returns an out-of-enum value or malformed confidence map.
 *
 * @param {Object} input - Raw tool_use input from Claude
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
  if (Number.isInteger(input.householdSize) && input.householdSize > 0) {
    householdSize = input.householdSize;
  }

  const rawConfidence = input.confidence || {};
  const clamp = (n) =>
    typeof n === 'number' && n >= 0 && n <= 1 ? n : 0;

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
