import { askLLM } from './chatbot.js';

// Persona + rules for the explanation. Kept as a system prompt so the request
// details in the user message stay cleanly separated from the instructions.
const EXPLANATION_SYSTEM_PROMPT = `You are an AI assistant explaining why a crisis help request has been prioritized.

Write a concise 1-2 sentence explanation of why the request received its priority score.

Rules:
- Be factual and specific
- Reference the concrete signals that drove the score: urgency level, number of similar requests nearby, and recency
- Attribute the score to its components (urgency, cluster density, time recency) so the reader understands which factors mattered most
- Do NOT speculate or add emotional language
- Do NOT invent facts not provided
- Keep it under 50 words
- Write in a confidence-inspiring tone`;

/**
 * Generate a natural-language explanation for why a request has its priority
 * score.
 *
 * Routes through askLLM, which tries OpenRouter's free models first and
 * falls back to the Gemini API — the same provider chain used by the chat and
 * voice features. If every provider fails, returns a templated fallback so
 * prioritization never breaks on the explanation step.
 *
 * @param {Object} request - The help request
 * @param {number} priorityScore - Calculated priority score (0-100)
 * @param {Array} similarRequests - Array of similar requests with similarity scores
 * @param {Object} scoreBreakdown - Breakdown of score components
 * @returns {Promise<string>} - 1-2 sentence explanation
 */
export async function generatePriorityExplanation(
  request,
  priorityScore,
  similarRequests,
  scoreBreakdown
) {
  const prompt = buildExplanationPrompt(request, priorityScore, similarRequests, scoreBreakdown);

  try {
    const explanation = await askLLM(prompt, {
      systemPrompt: EXPLANATION_SYSTEM_PROMPT,
    });
    return explanation.trim();
  } catch (error) {
    console.error('Error generating priority explanation:', error);
    // Fallback to a basic explanation when every provider is unavailable.
    return generateFallbackExplanation(request, priorityScore, similarRequests);
  }
}

/**
 * Build the prompt for Claude to explain the priority
 *
 * @param {Object} request - The help request
 * @param {number} priorityScore - Priority score
 * @param {Array} similarRequests - Similar requests
 * @param {Object} scoreBreakdown - Score components
 * @returns {string} - Prompt for Claude
 */
function buildExplanationPrompt(request, priorityScore, similarRequests, scoreBreakdown) {
  const hoursOld = Math.round(
    (Date.now() - new Date(request.createdAt)) / (1000 * 60 * 60)
  );

  return `Request Details:
- Category: ${request.category}
- Urgency: ${request.urgency}
- Location: ${request.location}
- Description: ${request.description}
- Submitted: ${hoursOld} hours ago

Priority Score: ${priorityScore}/100

Score Breakdown:
- Urgency component: ${scoreBreakdown.urgencyScore}/40
- Cluster density: ${scoreBreakdown.clusterScore}/30 (${similarRequests.length} similar requests nearby)
- Time recency: ${scoreBreakdown.timeScore}/30

Similar Requests Found: ${similarRequests.length}
${
  similarRequests.length > 0
    ? `
Top similar requests:
${similarRequests
  .slice(0, 3)
  .map(
    (sr, i) =>
      `${i + 1}. ${sr.request.category} in ${sr.request.location} (${Math.round(sr.similarity * 100)}% similar, ${sr.request.urgency} urgency)`
  )
  .join('\n')}
`
    : ''
}
Explain why this request received a priority score of ${priorityScore}/100, citing which score components drove it.`;
}

/**
 * Generate a simple fallback explanation when Claude API fails
 *
 * @param {Object} request - The help request
 * @param {number} priorityScore - Priority score
 * @param {Array} similarRequests - Similar requests
 * @returns {string} - Basic explanation
 */
function generateFallbackExplanation(request, priorityScore, similarRequests) {
  const hoursOld = Math.round(
    (Date.now() - new Date(request.createdAt)) / (1000 * 60 * 60)
  );

  if (similarRequests.length > 0) {
    return `This ${request.urgency.toLowerCase()} priority ${request.category.toLowerCase()} request is ranked at ${priorityScore}/100 because ${similarRequests.length} similar requests were found in ${request.location} within the past ${hoursOld} hours.`;
  } else {
    return `This ${request.urgency.toLowerCase()} priority ${request.category.toLowerCase()} request is ranked at ${priorityScore}/100 based on its urgency level and recency (submitted ${hoursOld} hours ago).`;
  }
}
