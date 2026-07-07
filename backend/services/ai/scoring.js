/**
 * Calculate priority score for a help request
 *
 * Score is based on:
 * - User-stated urgency (0-40 points)
 * - Cluster density - similar nearby requests (0-30 points)
 * - Time decay - recency of request (0-30 points)
 *
 * @param {Object} request - The help request
 * @param {string} request.urgency - Urgency level (Low/Medium/High/Critical)
 * @param {Date} request.createdAt - When request was created
 * @param {Array} similarRequests - Array of similar requests with similarity scores
 * @returns {number} - Priority score (0-100)
 */
export function calculatePriorityScore(request, similarRequests = []) {
  let score = 0;

  // Component 1: User urgency (0-40 points)
  const urgencyPoints = {
    Low: 10,
    Medium: 20,
    High: 30,
    Critical: 40,
  };
  score += urgencyPoints[request.urgency] || 10;

  // Component 2: Cluster density (0-30 points)
  // More similar requests = higher priority (indicates systemic issue)
  const clusterScore = Math.min(similarRequests.length * 5, 30);
  score += clusterScore;

  // Component 3: Time decay (0-30 points)
  // Recent requests get higher priority
  const hoursOld = (Date.now() - new Date(request.createdAt)) / (1000 * 60 * 60);
  let timeScore;

  if (hoursOld < 1) {
    timeScore = 30; // Last hour
  } else if (hoursOld < 6) {
    timeScore = 25; // Last 6 hours
  } else if (hoursOld < 24) {
    timeScore = 20; // Last day
  } else if (hoursOld < 72) {
    timeScore = 10; // Last 3 days
  } else {
    timeScore = 5; // Older
  }

  score += timeScore;

  // Normalize to 0-100 range
  return Math.min(Math.round(score), 100);
}

/**
 * Get breakdown of score components for debugging
 *
 * @param {Object} request - The help request
 * @param {Array} similarRequests - Similar requests
 * @returns {Object} - Score breakdown
 */
export function getScoreBreakdown(request, similarRequests = []) {
  const urgencyPoints = {
    Low: 10,
    Medium: 20,
    High: 30,
    Critical: 40,
  };

  const urgencyScore = urgencyPoints[request.urgency] || 10;
  const clusterScore = Math.min(similarRequests.length * 5, 30);

  const hoursOld = (Date.now() - new Date(request.createdAt)) / (1000 * 60 * 60);
  let timeScore;
  if (hoursOld < 1) timeScore = 30;
  else if (hoursOld < 6) timeScore = 25;
  else if (hoursOld < 24) timeScore = 20;
  else if (hoursOld < 72) timeScore = 10;
  else timeScore = 5;

  const totalScore = Math.min(urgencyScore + clusterScore + timeScore, 100);

  return {
    urgencyScore,
    clusterScore,
    timeScore,
    totalScore,
    similarRequestCount: similarRequests.length,
  };
}
