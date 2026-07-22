// NASA EONET (Earth Observatory Natural Event Tracker) ingestion adapter.
//
// Pulls open global natural events — wildfires, severe storms, volcanoes,
// floods, ice — from NASA's keyless EONET API and normalizes them into the
// shared event shape usgs.js/nws.js produce. EONET is the widest-coverage free
// source we have, so it fills the global-hazard gap earthquakes+US-weather miss.
//
// API docs: https://eonet.gsfc.nasa.gov/docs/v3
//
// Emits the shared normalized event shape documented in usgs.js.

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open';

// EONET has no per-event severity, so we infer one from the category. These are
// coarse but sensible: an active volcano/severe storm outranks a routine
// dust-and-haze advisory. Unlisted categories default to Medium.
const SEVERITY_BY_CATEGORY = {
  Volcanoes: 'Critical',
  'Severe Storms': 'High',
  Wildfires: 'High',
  Floods: 'High',
  Earthquakes: 'High',
  Landslides: 'High',
  'Sea and Lake Ice': 'Medium',
  Drought: 'Medium',
  'Dust and Haze': 'Low',
  Snow: 'Low',
  'Temperature Extremes': 'Medium',
  'Water Color': 'Low',
  'Manmade': 'Medium',
};

const severityFromCategories = (categories) => {
  // Take the highest severity among all of an event's categories.
  const rank = { Low: 1, Medium: 2, High: 3, Critical: 4 };
  let best = 'Medium';
  for (const c of categories) {
    const sev = SEVERITY_BY_CATEGORY[c] || 'Medium';
    if (rank[sev] > rank[best]) best = sev;
  }
  return best;
};

// Turn one EONET event into a normalized event, or null if it has no usable
// point geometry. EONET geometry is an ordered array of observations (a storm
// track); we take the most recent one as the event's current location.
const normalizeEvent = (event) => {
  const externalId = event?.id;
  if (!externalId) return null;

  const geometry = Array.isArray(event?.geometry) ? event.geometry : [];
  const latest = geometry[geometry.length - 1];
  const coords = latest?.coordinates;
  // We only place point events on the map; polygon geometries are rare here and
  // skipped rather than mis-centroided.
  if (latest?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2) {
    return null;
  }

  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const categories = (event.categories || [])
    .map((c) => c?.title)
    .filter(Boolean);
  const occurredAt = latest?.date ? new Date(latest.date) : new Date();
  const title = event.title || 'Natural event';

  return {
    source: 'eonet',
    externalId: String(externalId),
    category: 'Other', // the raw hazard; generated requests carry real categories
    severity: severityFromCategories(categories),
    magnitude: null,
    location: title, // EONET titles read like places ("Tropical Storm Bertha")
    latitude,
    longitude,
    description: categories.length
      ? `${title} (${categories.join(', ')}).`
      : `${title}.`,
    occurredAt,
    url: event.link || `https://eonet.gsfc.nasa.gov/api/v3/events/${externalId}`,
  };
};

/**
 * Fetch open global natural events and return them as normalized events.
 *
 * Best-effort: any network/parse failure yields an empty array rather than
 * throwing, so a bad fetch never aborts a seed run.
 *
 * @param {object} [options]
 * @param {number} [options.limit] - cap the number of events returned
 * @returns {Promise<Array>} normalized event objects (possibly empty)
 */
export async function fetchEvents({ limit } = {}) {
  try {
    const res = await fetch(EONET_URL, {
      headers: { 'User-Agent': 'MapResponse/1.0 (crisis-coordination demo)' },
    });
    if (!res.ok) {
      console.error(`EONET feed returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rawEvents = Array.isArray(data?.events) ? data.events : [];

    const events = rawEvents
      .map(normalizeEvent)
      .filter(Boolean)
      .sort((a, b) => b.occurredAt - a.occurredAt);

    return typeof limit === 'number' ? events.slice(0, limit) : events;
  } catch (err) {
    console.error('Failed to fetch EONET events:', err.message);
    return [];
  }
}

export default { fetchEvents };
