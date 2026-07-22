// Helpers for the county-level choropleth "heatmap" view.
//
// Unlike a kernel-density heat blob, a choropleth fills EVERY county polygon
// with a color, so the whole map reads as one continuous field. We drive the
// per-county intensity from the real request points using a smooth Gaussian
// distance falloff: counties near a cluster of needs burn hot, and the color
// radiates outward and cools with distance — no hard floor, no isolated dots.

import { feature } from 'topojson-client';
// NOTE: us-atlas/counties-10m.json is ~840KB. It is imported dynamically (see
// getCountyFeatures) so it only downloads when a user actually opens the
// choropleth, keeping it out of the main bundle.

// The heat ramp, as [stop, [r,g,b]] pairs (matches HEAT_GRADIENT in RequestMap).
// The stops step through neighboring hues (blue -> green -> yellow -> orange ->
// red) so every interpolated pair stays saturated — going straight from blue to
// amber blends through a muddy gray, which is what made the old ramp look off.
const RAMP = [
  [0.0, [56, 189, 248]], // #38bdf8 sky (fewest)
  [0.3, [34, 197, 94]], // #22c55e green
  [0.55, [234, 179, 8]], // #eab308 amber
  [0.78, [249, 115, 22]], // #f97316 orange
  [1.0, [220, 38, 38]], // #dc2626 red (most)
];

// Continuously interpolate the ramp at t in [0,1] -> "#rrggbb".
// Continuous (not bucketed) is what makes it read smoother than the reference.
export const rampColor = (t) => {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i += 1) {
    const [s0, c0] = RAMP[i - 1];
    const [s1, c1] = RAMP[i];
    if (x <= s1) {
      const f = s1 === s0 ? 0 : (x - s0) / (s1 - s0);
      const rgb = c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
      return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return '#7f1d1d';
};

// Build the county FeatureCollection once, lazy-loading the (large) TopoJSON on
// first use. Cached as a promise so concurrent callers share one fetch and
// later opens resolve instantly.
let countyFeaturesPromise = null;
export const getCountyFeatures = () => {
  if (!countyFeaturesPromise) {
    countyFeaturesPromise = import('us-atlas/counties-10m.json').then((mod) => {
      const topo = mod.default;
      return feature(topo, topo.objects.counties).features;
    });
  }
  return countyFeaturesPromise;
};

// Rough centroid of a county polygon/multipolygon — average of its outer-ring
// vertices. Precise enough for a distance falloff; we don't need true area
// centroids here.
const centroidOf = (geometry) => {
  let sx = 0;
  let sy = 0;
  let n = 0;
  const addRing = (ring) => {
    for (const [lng, lat] of ring) {
      sx += lng;
      sy += lat;
      n += 1;
    }
  };
  if (geometry.type === 'Polygon') {
    addRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) addRing(poly[0]);
  }
  return n ? [sx / n, sy / n] : null;
};

// Cache centroids alongside features (keyed by feature id).
let centroidCache = null;
const getCentroids = (features) => {
  if (!centroidCache) {
    centroidCache = new Map();
    for (const f of features) {
      centroidCache.set(f.id, centroidOf(f.geometry));
    }
  }
  return centroidCache;
};

// A county centroid is "in view" if it falls inside the given lat/lng bounds.
const inBounds = (clat, clng, b) =>
  clat >= b.minLat && clat <= b.maxLat && clng >= b.minLng && clng <= b.maxLng;

// Compute a 0–1 intensity per county from the request points.
//
// points: [{ lat, lng, weight }]  (weight 1–4 from urgency)
// options:
//   sigma:  falloff radius in degrees — bigger = smoother, wider spread. This
//           should shrink as the user zooms in so nearby clusters separate out
//           instead of blurring into one blob.
//   bounds: { minLat, maxLat, minLng, maxLng } of the current viewport. When
//           given, normalization uses only the counties in view, so zooming
//           into a quiet region still spreads the ramp across its local
//           min→max instead of pinning everything to the national peak.
//
// Returns Map<countyId, intensity>. Each county's raw score is the sum over
// points of weight * exp(-(dist/sigma)^2). Raw scores always come from ALL
// points (a cluster just off-screen still bleeds warmth to the edge), but the
// max we normalize against is scoped to the visible counties when `bounds` is
// supplied — that's what makes the gradient adapt to the current view.
export const computeCountyIntensities = (features, points, options = {}) => {
  const { sigma = 4, bounds = null } = options;
  const centroids = getCentroids(features);
  const raw = new Map();
  let max = 0;

  if (points.length === 0) {
    for (const f of features) raw.set(f.id, 0);
    return raw;
  }

  const twoSigmaSq = 2 * sigma * sigma;
  for (const f of features) {
    const c = centroids.get(f.id);
    if (!c) {
      raw.set(f.id, 0);
      continue;
    }
    const [clng, clat] = c;
    let score = 0;
    for (const p of points) {
      const dLat = clat - p.lat;
      const dLng = (clng - p.lng) * Math.cos((clat * Math.PI) / 180); // lng shrinks toward poles
      const d2 = dLat * dLat + dLng * dLng;
      score += p.weight * Math.exp(-d2 / twoSigmaSq);
    }
    raw.set(f.id, score);
    // Only counties in the current viewport define the ramp's top end.
    if ((!bounds || inBounds(clat, clng, bounds)) && score > max) max = score;
  }

  if (max > 0) {
    // Normalize, then apply a gentle gamma so mid-range counties stay vivid
    // instead of washing out — keeps the whole map colorful, not just clusters.
    // Clamp to 1 since off-screen counties can exceed the in-view max.
    for (const [id, score] of raw) {
      raw.set(id, Math.min(1, score / max) ** 0.6);
    }
  }
  return raw;
};

// Falloff radius (degrees) for a given Leaflet zoom level. At the country view
// (~zoom 4) we want a broad ~4° blur; each zoom-in roughly halves the radius so
// clusters resolve into distinct hot counties instead of one smear. Clamped so
// it never gets so tiny that isolated points vanish, nor so wide it flattens.
export const sigmaForZoom = (zoom) => {
  const sigma = 4 * 2 ** ((4 - zoom) * 0.75);
  return Math.max(0.15, Math.min(6, sigma));
};
