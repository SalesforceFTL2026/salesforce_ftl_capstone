// USGS Earthquake ingestion adapter.
//
// Pulls recent significant earthquakes from the USGS public GeoJSON feed and
// normalizes them into the internal "crisis event" shape the rest of the
// ingestion pipeline understands. USGS is keyless, no rate limits for this
// feed, and every feature already carries coordinates — so it's the cheapest
// real, well-formed disaster source to start from.
//
// Feed docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
//
// The normalized event shape (shared by every future adapter — NWS, FEMA, …):
//   {
//     source:      'usgs',            // which adapter produced this
//     externalId:  string,           // stable id from the source (dedupe key)
//     category:    'Other',          // maps onto the Request category enum
//     severity:    'Low'|'Medium'|'High'|'Critical',
//     magnitude:   number|null,      // source-specific intensity, if any
//     location:    string,           // human-readable place (geocodable)
//     latitude:    number,
//     longitude:   number,
//     description: string,           // neutral one-line summary
//     occurredAt:  Date,
//     url:         string,           // canonical link back to the source
//   }

// Which feed window to pull. "significant_month" keeps the volume low and the
// events demo-worthy; swap for "4.5_week" etc. if you want more density.
const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';

// Map an earthquake magnitude onto our four-level urgency/severity scale.
// Thresholds follow the rough USGS damage bands (M4.5 felt widely, M6 strong,
// M7 major). Anything without a magnitude defaults to Medium.
const severityFromMagnitude = (mag) => {
  if (!Number.isFinite(mag)) return 'Medium';
  if (mag >= 7.0) return 'Critical';
  if (mag >= 6.0) return 'High';
  if (mag >= 4.5) return 'Medium';
  return 'Low';
};

// Turn one USGS GeoJSON feature into a normalized event, or null if it's
// missing the coordinates/id we need to be useful.
const normalizeFeature = (feature) => {
  const props = feature?.properties || {};
  const coords = feature?.geometry?.coordinates; // [lng, lat, depth]
  const externalId = feature?.id;

  if (!externalId || !Array.isArray(coords) || coords.length < 2) return null;

  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const magnitude = Number.isFinite(Number(props.mag)) ? Number(props.mag) : null;
  const place = props.place || 'Unknown location';
  const occurredAt = Number.isFinite(Number(props.time))
    ? new Date(Number(props.time))
    : new Date();

  return {
    source: 'usgs',
    externalId: String(externalId),
    category: 'Other', // earthquakes don't map to Food/Shelter/etc. on their own
    severity: severityFromMagnitude(magnitude),
    magnitude,
    location: place,
    latitude,
    longitude,
    description: magnitude
      ? `Magnitude ${magnitude.toFixed(1)} earthquake near ${place}.`
      : `Earthquake reported near ${place}.`,
    occurredAt,
    url: props.url || '',
  };
};

/**
 * Fetch recent significant earthquakes and return them as normalized events.
 *
 * Best-effort like the geocoder: any network/parse failure yields an empty
 * array rather than throwing, so a bad fetch never aborts a seed run.
 *
 * @param {object} [options]
 * @param {number} [options.limit] - cap the number of events returned
 * @returns {Promise<Array>} normalized event objects (possibly empty)
 */
export async function fetchEvents({ limit } = {}) {
  try {
    const res = await fetch(USGS_FEED_URL, {
      headers: { 'User-Agent': 'MapResponse/1.0 (crisis-coordination demo)' },
    });
    if (!res.ok) {
      console.error(`USGS feed returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];

    const events = features
      .map(normalizeFeature)
      .filter(Boolean)
      // Newest first so a `limit` keeps the most recent events.
      .sort((a, b) => b.occurredAt - a.occurredAt);

    return typeof limit === 'number' ? events.slice(0, limit) : events;
  } catch (err) {
    console.error('Failed to fetch USGS events:', err.message);
    return [];
  }
}

export default { fetchEvents };
