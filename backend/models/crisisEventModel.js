import prisma from '../services/database/prisma.js';

/**
 * Crisis Event Model
 * Read access to crisis events. Writes are handled by the ingestion job
 * (services/ingestion/ingestEvents.js), not through the API, so this model is
 * intentionally read-only.
 */

// Get crisis events for the map overlay. By default returns only active events
// that have coordinates (so every result is plottable). Newest first.
//
// options:
//   activeOnly  - when true (default), exclude deactivated/expired events
//   source      - restrict to one ingestion source ('usgs', 'nws', …)
//   limit       - cap the number returned
export const getCrisisEvents = async ({ activeOnly = true, source, limit } = {}) => {
  return await prisma.crisisEvent.findMany({
    where: {
      ...(activeOnly ? { active: true } : {}),
      ...(source ? { source } : {}),
      // Only events we can place on the map.
      latitude: { not: null },
      longitude: { not: null },
    },
    orderBy: { startDate: 'desc' },
    ...(typeof limit === 'number' ? { take: limit } : {}),
  });
};

export default { getCrisisEvents };
