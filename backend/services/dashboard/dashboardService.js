import prisma from '../database/prisma.js';

/**
 * Dashboard Service
 *
 * Business logic + database access for role dashboards. Controllers call these
 * functions; they never touch Prisma directly.
 */

// Requests that still need attention. Anything not yet resolved counts as
// "active" so organizations see the full open workload, not just brand-new ones.
const ACTIVE_STATUSES = ['pending', 'in-progress', 'matched'];

// Responses this org is still working. "declined"/"completed" are done, so
// they don't belong in the "what am I currently handling" view.
const ACTIVE_RESPONSE_STATUSES = ['offered', 'accepted', 'in-progress'];

/**
 * Count how many times each value of `key` appears in a list of records.
 * Example: countBy(requests, 'urgency') -> { High: 3, Low: 1 }
 *
 * @param {object[]} records - the rows to tally
 * @param {string} key - the field to group by
 * @returns {Object<string, number>} a map of value -> count
 */
function countBy(records, key) {
  const counts = {};
  for (const record of records) {
    const value = record[key];
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

/**
 * Build the organization dashboard payload.
 *
 * Gives an organization the three things the product flow calls for: an
 * overview of active needs, the highest-priority requests to act on, and the
 * responses they are currently handling.
 *
 * @param {string} organizationUserId - the logged-in organization's user id
 * @returns {Promise<object>} summary + topPriorityRequests + yourActiveResponses
 */
export async function getOrganizationDashboard(organizationUserId) {
  // 1. Load all active requests once, then derive the summary + top list from
  //    them in memory. One query is plenty at MVP scale and keeps counts
  //    consistent with the list the org sees.
  const activeRequests = await prisma.request.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { priorityScore: 'desc' },
  });

  // 2. Summary breakdowns so the org can see the shape of current demand.
  const summary = {
    totalActive: activeRequests.length,
    byStatus: countBy(activeRequests, 'status'),
    byUrgency: countBy(activeRequests, 'urgency'),
    byCategory: countBy(activeRequests, 'category'),
  };

  // 3. The most urgent requests to act on first (already sorted by AI score).
  //    Cap at 10 so the dashboard stays scannable.
  const topPriorityRequests = activeRequests.slice(0, 10);

  // 4. This organization's in-flight responses, newest first, with the request
  //    each one is helping so the card can show context without another call.
  const yourActiveResponses = await prisma.response.findMany({
    where: {
      responderId: organizationUserId,
      responderType: 'organization',
      status: { in: ACTIVE_RESPONSE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      request: {
        select: {
          id: true,
          category: true,
          urgency: true,
          location: true,
          status: true,
          priorityScore: true,
        },
      },
    },
  });

  return { summary, topPriorityRequests, yourActiveResponses };
}

export default { getOrganizationDashboard };
