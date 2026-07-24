/**
 * Priority scoring for help requests.
 *
 * The score (0-100) is a weighted sum of three continuous components, so
 * requests spread across the full range instead of clustering into a handful
 * of discrete buckets:
 *
 *   - Severity      (0-50): how bad inaction is. Combines self-reported urgency
 *                           with an objective per-category criticality, and is
 *                           floored high when the text signals a life-safety
 *                           need (e.g. epipen, insulin) that people often
 *                           under-report.
 *   - Cluster       (0-20): how many similar nearby requests exist, with
 *                           diminishing returns (a systemic issue, not linear).
 *   - Recency       (0-30): smooth exponential time decay — no bucket jumps, so
 *                           re-scoring the same request gives a stable, gently
 *                           changing value rather than a sudden step.
 *
 * The math is deterministic for a fixed input and clock. The only run-to-run
 * variation comes from the cluster count, which depends on vector search — that
 * is now reproducible because embeddings use a single provider (Cohere).
 */

// Weight (0-1) of self-reported urgency. Self-reported, so people inflate it;
// it is only 60% of severity, balanced by objective category criticality.
const URGENCY_WEIGHT = {
  Low: 0.25,
  Medium: 0.5,
  High: 0.75,
  Critical: 1.0,
};

// Objective criticality (0-1) by category. Medical is life-or-death; transport
// and misc needs are rarely time-to-harm critical. Categories: Food, Shelter,
// Medical, Transport, Other (Water included defensively for free-text intake).
const CATEGORY_CRITICALITY = {
  Medical: 1.0,
  Water: 0.9,
  Shelter: 0.75,
  Food: 0.6,
  Transport: 0.4,
  Other: 0.45,
};

// Point ceilings for each component; they sum to 100.
const SEVERITY_MAX = 50;
const CLUSTER_MAX = 20;
const RECENCY_MAX = 30;

// Recency uses exp(-hoursOld / TAU): at 0h -> full points, ~24h -> 37%,
// ~48h -> 14%. Continuous, so no jump at bucket boundaries.
const RECENCY_TAU_HOURS = 24;

// Cluster uses 1 - exp(-n / SCALE): 1 request -> 28%, 3 -> 63%, 10 -> 96% of
// the cluster ceiling. Diminishing returns instead of a hard linear cap.
const CLUSTER_SCALE = 3;

// Blend of the two severity inputs. Urgency is self-reported so it is weighted
// a bit lower than the objective category signal's complement.
const URGENCY_SHARE = 0.6;
const CATEGORY_SHARE = 0.4;

// When the description signals an immediate threat to life, floor severity here
// (0-1) regardless of the self-reported urgency. This is what makes "needs an
// epipen" outrank a "Critical"-marked but non-life-threatening request even if
// the submitter picked a lower urgency.
const LIFE_SAFETY_FLOOR = 0.9;

// Substrings that indicate an immediate threat to life. Matched case-insensitively
// against category + description.
const LIFE_SAFETY_KEYWORDS = [
  'epipen', 'epi pen', 'anaphyla', 'allergic reaction',
  'insulin', 'diabetic', 'dialysis',
  'oxygen', 'ventilator', 'asthma', 'inhaler', 'can\'t breathe', 'cannot breathe',
  'seizure', 'unconscious', 'not breathing', 'overdose', 'naloxone', 'narcan',
  'chest pain', 'heart attack', 'cardiac', 'stroke', 'defibrillator',
  'severe bleeding', 'hemorrhage', 'in labor', 'newborn',
];

/**
 * Detect whether a request describes an immediate threat to life.
 *
 * @param {Object} request - The help request
 * @returns {boolean}
 */
export function hasLifeSafetySignal(request) {
  const haystack = `${request.category || ''} ${request.description || ''}`.toLowerCase();
  return LIFE_SAFETY_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * Compute the raw component points for a request. Shared by the public score
 * and breakdown functions so they can never disagree.
 *
 * @param {Object} request - The help request
 * @param {Array} similarRequests - Similar requests from vector search
 * @returns {{severity:number, cluster:number, recency:number, lifeSafety:boolean, hoursOld:number}}
 */
function computeComponents(request, similarRequests = []) {
  // Severity: blend self-reported urgency with objective category criticality,
  // then floor for detected life-safety needs.
  const urgencyNorm = URGENCY_WEIGHT[request.urgency] ?? URGENCY_WEIGHT.Low;
  const categoryNorm = CATEGORY_CRITICALITY[request.category] ?? CATEGORY_CRITICALITY.Other;
  let severityNorm = URGENCY_SHARE * urgencyNorm + CATEGORY_SHARE * categoryNorm;

  const lifeSafety = hasLifeSafetySignal(request);
  if (lifeSafety) {
    severityNorm = Math.max(severityNorm, LIFE_SAFETY_FLOOR);
  }
  const severity = SEVERITY_MAX * severityNorm;

  // Cluster: diminishing returns on the number of similar nearby requests.
  const clusterNorm = 1 - Math.exp(-similarRequests.length / CLUSTER_SCALE);
  const cluster = CLUSTER_MAX * clusterNorm;

  // Recency: smooth exponential decay from creation time.
  const hoursOld = Math.max(0, (Date.now() - new Date(request.createdAt)) / (1000 * 60 * 60));
  const recency = RECENCY_MAX * Math.exp(-hoursOld / RECENCY_TAU_HOURS);

  return { severity, cluster, recency, lifeSafety, hoursOld };
}

/**
 * Calculate priority score for a help request.
 *
 * @param {Object} request - The help request
 * @param {string} request.category - Request category (Food/Shelter/Medical/...)
 * @param {string} request.urgency - Urgency level (Low/Medium/High/Critical)
 * @param {string} [request.description] - Free text; scanned for life-safety signals
 * @param {Date} request.createdAt - When request was created
 * @param {Array} similarRequests - Array of similar requests with similarity scores
 * @returns {number} - Priority score (0-100)
 */
export function calculatePriorityScore(request, similarRequests = []) {
  const { severity, cluster, recency } = computeComponents(request, similarRequests);
  const total = severity + cluster + recency;
  return Math.min(Math.round(total), 100);
}

/**
 * Get breakdown of score components (rounded points) for the explanation and
 * for debugging.
 *
 * @param {Object} request - The help request
 * @param {Array} similarRequests - Similar requests
 * @returns {Object} - Score breakdown
 */
export function getScoreBreakdown(request, similarRequests = []) {
  const { severity, cluster, recency, lifeSafety } = computeComponents(request, similarRequests);

  const severityScore = Math.round(severity);
  const clusterScore = Math.round(cluster);
  const recencyScore = Math.round(recency);

  return {
    severityScore, // out of SEVERITY_MAX (50)
    clusterScore, // out of CLUSTER_MAX (20)
    recencyScore, // out of RECENCY_MAX (30)
    totalScore: Math.min(Math.round(severity + cluster + recency), 100),
    similarRequestCount: similarRequests.length,
    lifeSafety, // true when a life-safety keyword floored severity
    maxima: { severity: SEVERITY_MAX, cluster: CLUSTER_MAX, recency: RECENCY_MAX },
  };
}
