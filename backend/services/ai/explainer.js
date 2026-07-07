import { anthropic } from './clients.js';

/**
 * Generate Claude explanation for why a request has its priority score
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
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const explanation = response.content[0].text.trim();
    return explanation;
  } catch (error) {
    console.error('Error generating Claude explanation:', error);
    // Fallback to a basic explanation
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

  return `You are an AI assistant explaining why a crisis help request has been prioritized.

Request Details:
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

Write a concise 1-2 sentence explanation of why this request received a priority score of ${priorityScore}/100.

Rules:
- Be factual and specific
- Reference concrete signals (similar requests, urgency level, recency)
- Do NOT speculate or add emotional language
- Do NOT invent facts not provided above
- Keep it under 50 words
- Write in a confidence-inspiring tone

Explanation:`;
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
