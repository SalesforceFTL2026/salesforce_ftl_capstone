// Turn a free-form `location` string (a city, "City, ST", or a US zip) into
// { latitude, longitude } so a request can be plotted on the map.
//
// We resolve in the cheapest order that still works offline:
//   1. A small built-in gazetteer of the cities our demo/seed data uses, plus a
//      keyless zip lookup (Zippopotam.us) for 5-digit US zips. No network for
//      the common case, no API key ever.
//   2. As a fallback, OpenStreetMap's Nominatim geocoder (keyless, but rate
//      limited and requires network). Only hit when the gazetteer misses.
//
// Geocoding is best-effort: a location we can't resolve returns null and the
// request is simply saved without coordinates (it won't show on the map). We
// never throw from here so request creation never fails because of geocoding.

// Cities that appear in our seed/demo data (and a few likely nearby ones), so
// the map is populated without any network round-trip. Keyed by a normalized
// "city, st" and by bare city name. Coordinates are city-center approximations.
const CITY_GAZETTEER = {
  'austin, tx': { latitude: 30.2672, longitude: -97.7431 },
  'houston, tx': { latitude: 29.7604, longitude: -95.3698 },
  'dallas, tx': { latitude: 32.7767, longitude: -96.797 },
  'san antonio, tx': { latitude: 29.4241, longitude: -98.4936 },
  'fort worth, tx': { latitude: 32.7555, longitude: -97.3308 },
  'el paso, tx': { latitude: 31.7619, longitude: -106.485 },
  'corpus christi, tx': { latitude: 27.8006, longitude: -97.3964 },
  'galveston, tx': { latitude: 29.3013, longitude: -94.7977 },
};

// Normalize a location string for gazetteer lookup: lowercase, collapse
// whitespace, and drop any trailing zip so "Austin, TX 78701" -> "austin, tx".
const normalize = (location) =>
  String(location)
    .toLowerCase()
    .replace(/\b\d{5}(?:-\d{4})?\b/g, '') // strip zip codes
    .replace(/\s+/g, ' ')
    .replace(/[.,\s]+$/, '')
    .trim();

// Pull the first 5-digit US zip out of a location string, if present.
const extractZip = (location) => {
  const match = String(location).match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
};

// Look the location up in the built-in gazetteer (by "city, st" then bare city).
const fromGazetteer = (location) => {
  const key = normalize(location);
  if (CITY_GAZETTEER[key]) return CITY_GAZETTEER[key];
  const cityOnly = key.split(',')[0].trim();
  return CITY_GAZETTEER[cityOnly] || null;
};

// Resolve a 5-digit US zip to coordinates using the keyless Zippopotam.us API.
// Returns { latitude, longitude } or null on any miss/error.
const fromZip = async (zip) => {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
};

// Last-resort geocode via OpenStreetMap Nominatim (keyless). Nominatim asks for
// an identifying User-Agent and rate-limits to ~1 req/sec, so this is only used
// when the gazetteer and zip lookup both miss.
const fromNominatim = async (location) => {
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(location);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MapResponse/1.0 (crisis-coordination demo)' },
    });
    if (!res.ok) return null;
    const results = await res.json();
    const hit = results?.[0];
    if (!hit) return null;
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
};

// Geocode a free-form location string to { latitude, longitude }, or null if it
// can't be resolved. Tries the offline gazetteer, then a zip lookup, then
// Nominatim. Never throws — geocoding is best-effort.
export const geocodeLocation = async (location) => {
  if (!location || typeof location !== 'string' || !location.trim()) return null;

  const local = fromGazetteer(location);
  if (local) return local;

  const zip = extractZip(location);
  if (zip) {
    const byZip = await fromZip(zip);
    if (byZip) return byZip;
  }

  return await fromNominatim(location);
};

// Great-circle distance between two { latitude, longitude } points, in miles
// (haversine formula). Used to sort requests by how far they are from an org.
export const haversineMiles = (a, b) => {
  const R = 3958.8; // Earth's radius in miles
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};

export default { geocodeLocation, haversineMiles };
