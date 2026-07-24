// Geographic distance helpers used by the "near me" / geo-radius filtering
// (issues #115, #116). Distances are in miles to match the radius the UI asks
// for. We use the haversine formula — great-circle distance on a sphere —
// which is accurate to well within a mile at city scale, plenty for "show me
// requests within N miles of here".

const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (deg) => (deg * Math.PI) / 180;

// Great-circle distance in miles between two { lat, lng } points.
export const distanceMiles = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
};

// A request is locatable only once it has real numeric coordinates. Requests
// without coordinates can't be within any radius, so radius filtering drops
// them (matching the map, which also can't plot them).
const hasCoords = (r) =>
  Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));

// Parse and validate a geo-radius filter from query params. Returns
// { lat, lng, radiusMiles } when all three are valid numbers (with lat/lng in
// range and radius > 0), or null when the filter is absent or malformed — in
// which case callers should skip filtering rather than error out.
export const parseRadiusFilter = ({ lat, lng, radius } = {}) => {
  if (lat === undefined || lng === undefined || radius === undefined) return null;

  const latitude = Number(lat);
  const longitude = Number(lng);
  const radiusMiles = Number(radius);

  const valid =
    Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 &&
    Number.isFinite(radiusMiles) && radiusMiles > 0;

  return valid ? { lat: latitude, lng: longitude, radiusMiles } : null;
};

// Keep only the requests whose coordinates fall within `radiusMiles` of the
// given center, annotating each survivor with `distanceMiles` (rounded to one
// decimal) so callers can display or sort by it. Requests without coordinates
// are excluded.
export const filterWithinRadius = (requests, { lat, lng, radiusMiles }) =>
  requests
    .filter(hasCoords)
    .map((r) => ({
      ...r,
      distanceMiles:
        Math.round(distanceMiles(lat, lng, Number(r.latitude), Number(r.longitude)) * 10) / 10,
    }))
    .filter((r) => r.distanceMiles <= radiusMiles);

export default { distanceMiles, parseRadiusFilter, filterWithinRadius };
