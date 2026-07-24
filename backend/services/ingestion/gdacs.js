// GDACS (Global Disaster Alert and Coordination System) ingestion adapter.
//
// Pulls current global disaster alerts — earthquakes, tropical cyclones,
// floods, droughts, volcanoes — from GDACS's keyless events API and normalizes
// them into the shared event shape. GDACS's value is its built-in alert level
// (Green/Orange/Red), so unlike EONET we don't have to invent severity — we map
// their operational alert level straight onto our scale.
//
// API: https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP
//
// Emits the shared normalized event shape documented in usgs.js.

const GDACS_URL =
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP';

// GDACS alert level -> our four-level scale. Green is the lowest operational
// band GDACS emits; we surface it as Low. Anything unrecognized -> Medium.
const severityFromAlertLevel = (level) => {
  switch (String(level).toLowerCase()) {
    case 'red':
      return 'Critical';
    case 'orange':
      return 'High';
    case 'green':
      return 'Low';
    default:
      return 'Medium';
  }
};

// Human-readable label for GDACS's two-letter event type codes.
const EVENT_TYPE_LABELS = {
  EQ: 'Earthquake',
  TC: 'Tropical Cyclone',
  FL: 'Flood',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
  TS: 'Tsunami',
};

// Turn one GDACS feature into a normalized event, or null if it lacks the id or
// coordinates we need.
const normalizeFeature = (feature) => {
  const props = feature?.properties || {};
  const externalId = props.eventid;
  if (externalId == null) return null;

  const coords = feature?.geometry?.coordinates; // [lng, lat]
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const typeLabel = EVENT_TYPE_LABELS[props.eventtype] || 'Disaster';
  const country = props.country || 'unknown area';
  const occurredAt = props.fromdate ? new Date(props.fromdate) : new Date();

  // GDACS packs a numeric intensity (e.g. earthquake magnitude, cyclone
  // category) into severitydata.severity — surface it as our magnitude field.
  const severityNum = Number(props.severitydata?.severity);
  const magnitude = Number.isFinite(severityNum) ? severityNum : null;

  return {
    source: 'gdacs',
    // Namespace with the event type: GDACS ids are only unique per type.
    externalId: `${props.eventtype}-${externalId}`,
    category: 'Other',
    severity: severityFromAlertLevel(props.alertlevel),
    magnitude,
    location: country,
    latitude,
    longitude,
    description:
      props.description || props.name || `${typeLabel} in ${country}.`,
    occurredAt,
    url: props.url?.report || `https://www.gdacs.org/report.aspx?eventid=${externalId}`,
  };
};

/**
 * Fetch current global disaster alerts and return them as normalized events.
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
    const res = await fetch(GDACS_URL, {
      headers: { 'User-Agent': 'MapResponse/1.0 (crisis-coordination demo)' },
    });
    if (!res.ok) {
      console.error(`GDACS feed returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    const events = features
      .map(normalizeFeature)
      .filter(Boolean)
      .sort((a, b) => b.occurredAt - a.occurredAt);

    return typeof limit === 'number' ? events.slice(0, limit) : events;
  } catch (err) {
    console.error('Failed to fetch GDACS events:', err.message);
    return [];
  }
}

export default { fetchEvents };
