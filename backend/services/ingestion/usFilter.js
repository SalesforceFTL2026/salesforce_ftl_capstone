// Restrict normalized events to the United States.
//
// Sources differ: NWS and FEMA are already US-only, but USGS, EONET, and GDACS
// are global. Rather than special-case each adapter, we filter on the one field
// every normalized event shares — its coordinates — against a set of bounding
// boxes covering the US and its major territories. This keeps the adapters
// generic (reusable for a future non-US deployment) and the US policy in one
// place.
//
// Bounding boxes are approximate and intentionally a little generous at the
// edges; for a demo "is this in/near the US?" that's the right trade-off over
// a precise (and much heavier) point-in-polygon check.

// [minLat, maxLat, minLng, maxLng]
const US_BOXES = [
  [24.4, 49.4, -125.0, -66.9], // Contiguous US (CONUS)
  [51.2, 71.5, -168.0, -129.0], // Alaska (mainland + eastern Aleutians)
  [51.0, 53.5, 172.0, 180.0], // Alaska: Aleutians west of the antimeridian
  [18.9, 22.3, -160.3, -154.7], // Hawaii
  [17.6, 18.6, -67.3, -64.5], // Puerto Rico + US Virgin Islands
  [13.2, 20.6, 144.6, 146.1], // Guam + Northern Mariana Islands
];

// Is a { latitude, longitude } inside any US bounding box?
export const isInUnitedStates = (latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return US_BOXES.some(
    ([minLat, maxLat, minLng, maxLng]) =>
      latitude >= minLat &&
      latitude <= maxLat &&
      longitude >= minLng &&
      longitude <= maxLng
  );
};

/**
 * Keep only the events whose coordinates fall within the US (incl. AK, HI, and
 * major territories). Events without usable coordinates are dropped, since we
 * can't confirm they're in-scope.
 *
 * @param {Array} events - normalized events from one or more adapters
 * @returns {Array} the subset located in the United States
 */
export const filterUnitedStates = (events) =>
  events.filter((e) => isInUnitedStates(e.latitude, e.longitude));

export default { isInUnitedStates, filterUnitedStates };
