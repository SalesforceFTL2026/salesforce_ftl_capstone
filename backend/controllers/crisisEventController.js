import * as crisisEventModel from '../models/crisisEventModel.js';

/**
 * Crisis Event Controller
 * Serves ingested real-world crisis events (USGS/NWS/EONET/GDACS/FEMA) for the
 * map overlay. Read-only — events are written by the ingestion job, not the API.
 */

// GET /api/crisis-events
// Query params:
//   source        - restrict to one source ('usgs', 'nws', 'eonet', 'gdacs', 'fema')
//   includeStale  - 'true' to include deactivated/expired events (default: active only)
//   limit         - max events to return
export const getCrisisEvents = async (req, res) => {
  try {
    const { source, includeStale, limit } = req.query;

    const parsedLimit = Number(limit);
    const events = await crisisEventModel.getCrisisEvents({
      activeOnly: includeStale !== 'true',
      source: source || undefined,
      limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    });

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('Error fetching crisis events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch crisis events',
      error: error.message,
    });
  }
};

export default { getCrisisEvents };
