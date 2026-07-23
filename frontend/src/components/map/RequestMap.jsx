import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getCountyFeatures,
  computeCountyIntensities,
  rampColor,
  sigmaForZoom,
} from './countyChoropleth';

// Interactive Leaflet map of help requests. Each request that has been geocoded
// (latitude/longitude, added in issue #110) drops a pin colored by urgency;
// clicking a pin opens a popup with the request's details and — when a handler
// is provided — an action (e.g. a volunteer's "I can help"). Requests without
// coordinates are simply not plotted.
//
// We deliberately avoid Leaflet's default marker images: they 404 under Vite's
// bundler. Instead each pin is a small CSS `divIcon` we style ourselves, which
// also lets us color it by urgency for free.
//
// @param {object[]} requests - requests to plot (only geocoded ones appear)
// @param {(request) => void} [onInteract] - optional per-request action
// @param {string|null} [interactingId] - id currently being submitted
// @param {Object<string,string>} [confirmations] - requestId -> confirmation text

// Urgency -> pin color, matching the urgency dots used elsewhere in the app.
const URGENCY_COLOR = {
  Critical: '#c84444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};
const DEFAULT_COLOR = '#6ba3d3';

// Urgency -> heat intensity. Divided by the max (4) to give each point a
// 0–1 weight for the choropleth falloff, so Critical needs burn hottest.
const URGENCY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// Heat gradient for the legend, mirroring the RAMP in countyChoropleth.js so
// the legend matches the map exactly. Steps through neighboring hues (blue ->
// green -> yellow -> orange -> red) so it reads as one clean cool->hot sweep.
// An ORDERED array, not an object: numeric-like object keys ("0", "1") get
// reordered by the JS engine, which would scramble the gradient stops.
const HEAT_GRADIENT = ['#38bdf8', '#22c55e', '#eab308', '#f97316', '#dc2626'];

// Continental-US center + zoom, used when we have nothing to fit to.
const US_CENTER = [39.5, -98.35];
const US_ZOOM = 4;

// The app only serves the US, so we lock the map to the continental US (plus a
// little slack around the edges). MAX_BOUNDS is a hard pan limit; US_BOUNDS is
// the tighter box we frame to. MIN_ZOOM stops users zooming out to the globe.
const US_BOUNDS = [
  [25.5, -123], // SW (~S. Florida / SoCal)
  [48.5, -68], // NE (~N. border / Maine)
];
// Generous pan clamp — wide enough that the visible frame is always filled
// with tiles (no grey letterbox gutters) while still stopping users from
// wandering off to other continents.
const MAX_BOUNDS = [
  [5, -150],
  [60, -50],
];
const MIN_ZOOM = 4;

// A request is mappable only once it has real numeric coordinates.
const hasCoords = (r) =>
  Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));

// Build a colored teardrop pin as a Leaflet divIcon.
const pinIcon = (urgency) => {
  const color = URGENCY_COLOR[urgency] || DEFAULT_COLOR;
  return L.divIcon({
    className: 'mr-pin',
    html: `<span style="
      display:block;width:1rem;height:1rem;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 16],
    popupAnchor: [0, -16],
  });
};

// Pan/zoom the map so all plotted requests are in view whenever they change.
// A single request centers on it; many requests fit their bounding box.
const FitBounds = ({ points, mode }) => {
  const map = useMap();
  useEffect(() => {
    // The choropleth fills every county, so we always frame the whole country
    // rather than zooming into wherever the requests happen to be.
    // Both modes share the generous pan clamp (MAX_BOUNDS, set on the
    // MapContainer) so dragging to the edges stays smooth and never hard-walls.
    if (mode === 'heat') {
      // Frame tightly on the continental US so it fills the map.
      map.fitBounds(US_BOUNDS, { padding: [0, 0] });
      return;
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
    } else {
      map.fitBounds(points, { padding: [60, 60], maxZoom: 9 });
    }
  }, [map, points, mode]);
  return null;
};

// County-level choropleth overlay. Instead of a blurry density blob, EVERY US
// county polygon is filled with a color, so the whole map reads as one
// continuous heat field (like the classic county maps). Per-county intensity
// comes from a smooth Gaussian distance falloff off the real request points
// (see countyChoropleth.js), so color radiates out from clusters and cools
// with distance — no isolated "gradient pins".
//
// The gradient is view-aware: as the user zooms in, the falloff radius shrinks
// (sigmaForZoom) so clusters resolve into distinct counties, and the color ramp
// is re-normalized against only the counties currently on screen. So a region
// that reads as one lukewarm smear at the country level spreads into a full
// cool→hot gradient once you zoom into it. We restyle on every zoom/pan.
const ChoroplethLayer = ({ points, onLoadingChange }) => {
  const map = useMap();
  useEffect(() => {
    let layer = null;
    let cancelled = false; // guard against unmount/toggle before the load lands
    onLoadingChange?.(true);

    const weighted = points.map(([lat, lng, weight]) => ({ lat, lng, weight }));

    // Recolor every county for the current zoom + viewport. Cheap enough
    // (a few thousand counties) to run live on each move.
    const restyle = (features) => {
      const b = map.getBounds();
      const bounds = {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      };
      const intensities = computeCountyIntensities(features, weighted, {
        sigma: sigmaForZoom(map.getZoom()),
        bounds,
      });
      layer?.setStyle((f) => {
        const t = intensities.get(f.id) ?? 0;
        return {
          fillColor: rampColor(t),
          fillOpacity: 0.7,
          color: '#ffffff', // thin white county borders, like the reference
          weight: 0.3,
          opacity: 0.5,
        };
      });
    };

    // County geometry lazy-loads on first open (~840KB), so this is async.
    getCountyFeatures().then((features) => {
      if (cancelled) return;
      layer = L.geoJSON({ type: 'FeatureCollection', features }).addTo(map);
      restyle(features);

      // Re-normalize the gradient to whatever is now in view.
      const onMove = () => restyle(features);
      map.on('zoomend moveend', onMove);
      layer._onMove = onMove; // stash so cleanup can detach it

      onLoadingChange?.(false);
    });

    return () => {
      cancelled = true;
      onLoadingChange?.(false);
      if (layer) {
        if (layer._onMove) map.off('zoomend moveend', layer._onMove);
        map.removeLayer(layer);
      }
    };
  }, [map, points, onLoadingChange]);
  return null;
};

const RequestMap = ({ requests = [], onInteract, interactingId, confirmations = {} }) => {
  const { t } = useTranslation();
  // 'pins' shows urgency markers; 'heat' shows the county choropleth.
  const [mode, setMode] = useState('pins');
  // True while the (lazy-loaded) county geometry is downloading/building.
  const [heatLoading, setHeatLoading] = useState(false);
  const handleHeatLoading = useCallback((loading) => setHeatLoading(loading), []);

  // Only geocoded requests can be plotted.
  const mappable = useMemo(() => requests.filter(hasCoords), [requests]);
  const points = useMemo(
    () => mappable.map((r) => [Number(r.latitude), Number(r.longitude)]),
    [mappable]
  );
  // [lat, lng, intensity] triples for the heat overlay.
  const heatPoints = useMemo(
    () =>
      mappable.map((r) => [
        Number(r.latitude),
        Number(r.longitude),
        (URGENCY_WEIGHT[r.urgency] || 1) / 4,
      ]),
    [mappable]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Pins / Heatmap toggle */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10">
          {[
            { id: 'pins', label: t('requests.map.pins') },
            { id: 'heat', label: t('requests.map.heatmap') },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              aria-pressed={mode === opt.id}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
                mode === opt.id
                  ? 'bg-[#6ba3d3] text-white'
                  : 'text-[#1C2A16] dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-md">
        {/* Skeleton shown over the map while the county geometry lazy-loads. */}
        {heatLoading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-white/70 dark:bg-[#16233a]/70 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-full border-2 border-[#6ba3d3] border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-[#1C2A16] dark:text-gray-200">
              {t('requests.map.loadingHeatmap')}
            </p>
          </div>
        )}
        <MapContainer
          center={US_CENTER}
          zoom={US_ZOOM}
          minZoom={MIN_ZOOM}
          maxBounds={MAX_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={false}
          style={{ height: 'min(80vh, 900px)', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            noWrap
          />
          <FitBounds points={points} mode={mode} />
          {mode === 'heat' && <ChoroplethLayer points={heatPoints} onLoadingChange={handleHeatLoading} />}
          {mode === 'pins' &&
            mappable.map((r) => (
              <Marker
                key={r.id}
                position={[Number(r.latitude), Number(r.longitude)]}
                icon={pinIcon(r.urgency)}
              >
                <Popup>
                  <RequestPopup
                    request={r}
                    onInteract={onInteract}
                    interacting={interactingId === r.id}
                    confirmation={confirmations[r.id]}
                  />
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Note when some requests can't be plotted, so the map isn't mistaken
          for the full picture. */}
      {mappable.length < requests.length && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('requests.map.notShown', { count: requests.length - mappable.length })}
        </p>
      )}

      {/* Legend: urgency colors for pins, a density ramp for the heatmap. */}
      {mode === 'pins' ? (
        <div className="flex items-center justify-center flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
          {Object.entries(URGENCY_COLOR).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
              {t(`requests.urgencies.${label}`)}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>{t('requests.map.fewerNeeds')}</span>
          <span
            className="inline-block h-2 w-32 rounded-full"
            style={{
              background: `linear-gradient(to right, ${HEAT_GRADIENT.join(', ')})`,
            }}
          />
          <span>{t('requests.map.moreNeeds')}</span>
        </div>
      )}
    </div>
  );
};

// The content shown inside a pin's popup: request summary + optional action.
const RequestPopup = ({ request, onInteract, interacting, confirmation }) => {
  const { t } = useTranslation();
  const { submitterName, requesterName, name, category, urgency, location, description, priorityScore } = request;
  const who = submitterName || requesterName || name || t('requests.map.popup.helpSeeker');
  const hasScore = typeof priorityScore === 'number' && priorityScore > 0;

  return (
    <div className="min-w-[12rem]">
      <p className="font-bold text-sm text-[#1C2A16]">{who}</p>
      <p className="text-xs text-gray-600 mt-0.5">
        {category || t('requests.map.popup.uncategorized')}
        {urgency ? ` · ${t('requests.map.popup.urgencySuffix', { urgency })}` : ''}
        {hasScore ? ` · ${t('requests.map.popup.aiScore', { score: Math.round(priorityScore) })}` : ''}
      </p>
      {location && <p className="text-xs text-gray-500 mt-0.5">{location}</p>}
      {description && <p className="text-xs text-gray-700 mt-1">{description}</p>}

      {confirmation ? (
        <p className="text-xs font-semibold text-green-700 mt-2">{t('requests.map.popup.helping')}</p>
      ) : (
        onInteract && (
          <button
            type="button"
            onClick={() => onInteract(request)}
            disabled={interacting}
            className="mt-2 px-3 py-1.5 rounded-lg bg-[#6ba3d3] text-white text-xs font-semibold hover:bg-[#5a92c2] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {interacting ? t('requests.map.popup.saving') : t('requests.map.popup.iCanHelp')}
          </button>
        )
      )}
    </div>
  );
};

export default RequestMap;
