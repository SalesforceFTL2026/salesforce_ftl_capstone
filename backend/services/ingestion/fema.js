// OpenFEMA disaster-declaration ingestion adapter.
//
// Pulls recent US federal disaster declarations from the keyless OpenFEMA API
// and normalizes them into the shared event shape. FEMA is the authoritative
// US source — official declarations for floods, fires, hurricanes, severe
// storms — which makes it strong context for clustering ("this cluster of
// requests sits inside a federally-declared disaster area").
//
// Two shape quirks handled here:
//   1. FEMA has NO coordinates. We geocode the designated area + state via the
//      existing best-effort geocoder so events can go on the map and take part
//      in cross-source dedup.
//   2. FEMA returns one record PER designated county, so a single flood can be
//      dozens of rows. We collapse by disasterNumber to one event each.
//
// API docs: https://www.fema.gov/about/openfema/api
//
// Emits the shared normalized event shape documented in usgs.js.

import { geocodeLocation } from '../geocoding/geocoder.js';

// Most recent declarations first. We over-fetch a little because we collapse
// many county rows down to a few distinct disasters below.
const FEMA_URL =
  'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries' +
  '?$orderby=declarationDate desc&$top=200';

// FEMA incident types are already human-readable (Flood, Fire, Hurricane, …);
// we don't try to grade severity from them (a declaration is inherently
// serious), so everything comes in as High and the alert level nuance is left
// to sources that actually publish one (GDACS, NWS).
const DEFAULT_SEVERITY = 'High';

// Strip FEMA's "(County)"/"(Parish)" suffixes so the area geocodes cleanly.
const cleanArea = (area) =>
  String(area || '')
    .replace(/\((County|Parish|Borough|Municipality|City)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fetch recent US disaster declarations and return them as normalized events.
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
    const res = await fetch(FEMA_URL, {
      headers: { 'User-Agent': 'MapResponse/1.0 (crisis-coordination demo)' },
    });
    if (!res.ok) {
      console.error(`OpenFEMA feed returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const rows = Array.isArray(data?.DisasterDeclarationsSummaries)
      ? data.DisasterDeclarationsSummaries
      : [];

    // Collapse the per-county rows to one row per disaster (keep the first).
    const byDisaster = new Map();
    for (const row of rows) {
      const key = row?.disasterNumber;
      if (key == null) continue;
      if (!byDisaster.has(key)) byDisaster.set(key, row);
    }

    // Newest first, then apply the limit BEFORE geocoding so we only pay for
    // the network geocode on events we'll actually keep.
    let disasters = [...byDisaster.values()].sort(
      (a, b) => new Date(b.declarationDate) - new Date(a.declarationDate)
    );
    if (typeof limit === 'number') disasters = disasters.slice(0, limit);

    const events = [];
    for (const row of disasters) {
      const area = cleanArea(row.designatedArea);
      const state = row.state || '';
      // Prefer "County, ST"; fall back to just the state if area is generic.
      const locationLabel =
        area && !/statewide/i.test(area) ? `${area}, ${state}` : state;

      const coords = await geocodeLocation(locationLabel);
      if (!coords) continue; // can't map it -> skip (keeps the map honest)

      const incident = row.incidentType || 'Disaster';
      const title = row.declarationTitle || incident;
      const occurredAt = row.declarationDate
        ? new Date(row.declarationDate)
        : new Date();

      events.push({
        source: 'fema',
        externalId: String(row.femaDeclarationString || row.disasterNumber),
        category: 'Other',
        severity: DEFAULT_SEVERITY,
        magnitude: null,
        location: locationLabel,
        latitude: coords.latitude,
        longitude: coords.longitude,
        description: `Federally declared disaster: ${title} (${incident}) in ${locationLabel}.`,
        occurredAt,
        url: `https://www.fema.gov/disaster/${row.disasterNumber}`,
      });
    }

    return events;
  } catch (err) {
    console.error('Failed to fetch OpenFEMA events:', err.message);
    return [];
  }
}

export default { fetchEvents };
