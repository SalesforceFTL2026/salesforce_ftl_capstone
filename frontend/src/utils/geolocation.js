// Browser geolocation helper for the "Near me" toggle (issue #116).
//
// Wraps the callback-based navigator.geolocation.getCurrentPosition in a promise
// that resolves to { lat, lng } or rejects with a friendly, user-facing message.
// We never surface the raw GeolocationPositionError to the UI.

// Default radius (miles) applied when a user turns on "Near me". Kept modest so
// the feed narrows to a genuinely local set of requests.
export const DEFAULT_RADIUS_MILES = 25;

// Turn a GeolocationPositionError into a message we're comfortable showing.
const messageForError = (err) => {
  switch (err?.code) {
    case 1: // PERMISSION_DENIED
      return 'Location access was blocked. Enable it in your browser to use “Near me”.';
    case 2: // POSITION_UNAVAILABLE
      return 'We couldn’t determine your location right now. Please try again.';
    case 3: // TIMEOUT
      return 'Finding your location took too long. Please try again.';
    default:
      return 'Something went wrong getting your location.';
  }
};

// Resolve to the user's current { lat, lng }, or reject with an Error whose
// message is safe to display. Rejects immediately if the browser has no
// geolocation support.
// Great-circle distance in miles between two { lat, lng } points (haversine).
// Used to sort a feed by how close each request is to the volunteer. Returns
// null when either point is missing coordinates so callers can sort those last.
export const distanceMiles = (from, to) => {
  if (
    !from || !to ||
    !Number.isFinite(from.lat) || !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) || !Number.isFinite(to.lng)
  ) {
    return null;
  }

  const R = 3958.8; // Earth's radius in miles
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};

export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser doesn’t support location, so “Near me” isn’t available.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(messageForError(err))),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });

export default { getCurrentPosition, distanceMiles, DEFAULT_RADIUS_MILES };
