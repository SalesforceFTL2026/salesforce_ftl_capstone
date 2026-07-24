// Cross-source event de-duplication.
//
// Several feeds report the SAME real disaster: a hurricane can appear in GDACS,
// EONET, and FEMA at once; an earthquake in both USGS and GDACS. Each source's
// (source, externalId) is unique within itself, but nothing stops the same
// storm from becoming three markers on the map. This collapses events that are
// close in BOTH space and time into a single representative event.
//
// Heuristic (deliberately simple): two events are "the same" if they occurred
// within DISTANCE_MILES of each other AND within TIME_HOURS of each other. We
// keep the higher-severity of the two (ties broken by the more recent one) so
// the surviving event carries the strongest signal.

import { haversineMiles } from '../geocoding/geocoder.js';

// How close in space/time two events must be to be treated as duplicates.
// Disasters are large and feeds timestamp them differently, so these are
// generous on purpose; tighten if distinct nearby events get merged.
const DISTANCE_MILES = 100;
const TIME_HOURS = 72;

const SEVERITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };

// Is `b` a duplicate of `a`? Requires finite coords on both.
const isDuplicate = (a, b) => {
  if (
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return false;
  }

  const miles = haversineMiles(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude }
  );
  if (miles > DISTANCE_MILES) return false;

  const hours =
    Math.abs(new Date(a.occurredAt) - new Date(b.occurredAt)) / (1000 * 60 * 60);
  return hours <= TIME_HOURS;
};

// Pick which of two duplicate events to keep: higher severity, then more recent.
const preferred = (a, b) => {
  const ra = SEVERITY_RANK[a.severity] || 0;
  const rb = SEVERITY_RANK[b.severity] || 0;
  if (ra !== rb) return ra > rb ? a : b;
  return new Date(a.occurredAt) >= new Date(b.occurredAt) ? a : b;
};

/**
 * Collapse cross-source duplicates from a combined list of normalized events.
 *
 * O(n²) — fine for the hundreds-of-events scale a seed run deals with. Returns
 * a new array; does not mutate the input.
 *
 * @param {Array} events - normalized events from one or more adapters
 * @returns {{ events: Array, removed: number }} deduped events + how many were
 *   merged away (handy for logging what a "comprehensive" pull collapsed).
 */
export function dedupeEvents(events) {
  const kept = [];
  let removed = 0;

  for (const event of events) {
    const dupIndex = kept.findIndex((k) => isDuplicate(k, event));
    if (dupIndex === -1) {
      kept.push(event);
    } else {
      kept[dupIndex] = preferred(kept[dupIndex], event);
      removed += 1;
    }
  }

  return { events: kept, removed };
}

export default { dedupeEvents };
