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

export default { getCurrentPosition, DEFAULT_RADIUS_MILES };
