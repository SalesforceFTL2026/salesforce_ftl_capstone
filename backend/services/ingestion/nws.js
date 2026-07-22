// NWS (National Weather Service) alert ingestion adapter.
//
// Pulls active US weather alerts — floods, severe storms, extreme heat,
// tropical storms, red-flag/fire warnings — from the keyless weather.gov API
// and normalizes them into the same event shape usgs.js produces. Unlike
// earthquakes, these hazards map naturally onto real human needs (a flood
// warning -> shelter/food requests), and they sit on top of our US-centric
// map coverage, so they make the demo feel local and coherent.
//
// API docs: https://www.weather.gov/documentation/services-web-api
//
// Emits the shared normalized event shape documented in usgs.js.

// Active alerts endpoint. We ask only for the higher-severity bands so the
// volume stays demo-worthy and every event is genuinely consequential.
// NOTE: the /alerts/active endpoint does NOT accept a `limit` param (it 400s);
// we cap client-side after fetching instead.
const NWS_ALERTS_URL =
  'https://api.weather.gov/alerts/active?severity=Extreme,Severe';

// Map NWS's severity vocabulary onto our four-level scale. NWS also carries an
// `urgency` (Immediate/Expected/…) which we use to break the "Unknown" tie.
const severityFromNws = (severity, urgency) => {
  switch (severity) {
    case 'Extreme':
      return 'Critical';
    case 'Severe':
      return 'High';
    case 'Moderate':
      return 'Medium';
    case 'Minor':
      return 'Low';
    default:
      // Unknown severity: lean on urgency so an "Immediate" alert isn't buried.
      return urgency === 'Immediate' ? 'High' : 'Medium';
  }
};

// Compute a single representative point for an alert's polygon so it can be
// dropped on the map. NWS geometry is a Polygon or MultiPolygon (or null for
// zone-only alerts); we average the outer-ring vertices — good enough for a
// marker, and we return null if there's no usable geometry.
const centroidOf = (geometry) => {
  if (!geometry) return null;

  // Collect coordinate pairs from the first ring of each polygon.
  let rings = [];
  if (geometry.type === 'Polygon') {
    rings = geometry.coordinates || [];
  } else if (geometry.type === 'MultiPolygon') {
    rings = (geometry.coordinates || []).map((poly) => poly[0]).filter(Boolean);
  } else {
    return null;
  }

  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const ring of rings) {
    for (const pair of ring) {
      const lng = Number(pair?.[0]);
      const lat = Number(pair?.[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        sumLat += lat;
        sumLng += lng;
        n += 1;
      }
    }
  }
  if (n === 0) return null;
  return { latitude: sumLat / n, longitude: sumLng / n };
};

// Turn one NWS alert feature into a normalized event, or null if it lacks the
// id/geometry we need to place it on the map.
const normalizeFeature = (feature) => {
  const props = feature?.properties || {};
  const externalId = feature?.id;
  if (!externalId) return null;

  const point = centroidOf(feature?.geometry);
  if (!point) return null; // zone-only alert with no polygon — skip for the map

  const event = props.event || 'Weather alert';
  const area = props.areaDesc || 'Unknown area';
  const onset = props.onset || props.effective;
  const occurredAt = onset ? new Date(onset) : new Date();

  return {
    source: 'nws',
    externalId: String(externalId),
    category: 'Other', // the raw hazard; generated requests carry real categories
    severity: severityFromNws(props.severity, props.urgency),
    magnitude: null, // NWS has no single numeric magnitude
    location: area,
    latitude: point.latitude,
    longitude: point.longitude,
    description: props.headline || `${event} for ${area}.`,
    occurredAt,
    // The feature id is already the canonical alert URL on weather.gov.
    url: String(externalId),
  };
};

/**
 * Fetch active US weather alerts and return them as normalized events.
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
    const res = await fetch(NWS_ALERTS_URL, {
      // weather.gov asks for an identifying User-Agent and speaks GeoJSON.
      headers: {
        'User-Agent': 'MapResponse/1.0 (crisis-coordination demo)',
        Accept: 'application/geo+json',
      },
    });
    if (!res.ok) {
      console.error(`NWS feed returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    const events = features
      .map(normalizeFeature)
      .filter(Boolean)
      // Newest first so a `limit` keeps the most recent alerts.
      .sort((a, b) => b.occurredAt - a.occurredAt);

    return typeof limit === 'number' ? events.slice(0, limit) : events;
  } catch (err) {
    console.error('Failed to fetch NWS events:', err.message);
    return [];
  }
}

export default { fetchEvents };
