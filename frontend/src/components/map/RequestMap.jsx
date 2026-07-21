import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Continental-US center + zoom, used when we have nothing to fit to.
const US_CENTER = [39.5, -98.35];
const US_ZOOM = 4;

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
const FitBounds = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
};

const RequestMap = ({ requests = [], onInteract, interactingId, confirmations = {} }) => {
  // Only geocoded requests can be plotted.
  const mappable = useMemo(() => requests.filter(hasCoords), [requests]);
  const points = useMemo(
    () => mappable.map((r) => [Number(r.latitude), Number(r.longitude)]),
    [mappable]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-md">
        <MapContainer
          center={US_CENTER}
          zoom={US_ZOOM}
          scrollWheelZoom={false}
          style={{ height: '28rem', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {mappable.map((r) => (
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
          {requests.length - mappable.length} request
          {requests.length - mappable.length === 1 ? '' : 's'} without a mappable location{' '}
          {requests.length - mappable.length === 1 ? 'is' : 'are'} not shown.
        </p>
      )}

      {/* Urgency legend */}
      <div className="flex items-center justify-center flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
        {Object.entries(URGENCY_COLOR).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

// The content shown inside a pin's popup: request summary + optional action.
const RequestPopup = ({ request, onInteract, interacting, confirmation }) => {
  const { submitterName, requesterName, name, category, urgency, location, description, priorityScore } = request;
  const who = submitterName || requesterName || name || 'Help Seeker';
  const hasScore = typeof priorityScore === 'number' && priorityScore > 0;

  return (
    <div className="min-w-[12rem]">
      <p className="font-bold text-sm text-[#1C2A16]">{who}</p>
      <p className="text-xs text-gray-600 mt-0.5">
        {category || 'Uncategorized'}
        {urgency ? ` · ${urgency} urgency` : ''}
        {hasScore ? ` · AI ${Math.round(priorityScore)}` : ''}
      </p>
      {location && <p className="text-xs text-gray-500 mt-0.5">{location}</p>}
      {description && <p className="text-xs text-gray-700 mt-1">{description}</p>}

      {confirmation ? (
        <p className="text-xs font-semibold text-green-700 mt-2">✓ Helping</p>
      ) : (
        onInteract && (
          <button
            type="button"
            onClick={() => onInteract(request)}
            disabled={interacting}
            className="mt-2 px-3 py-1.5 rounded-lg bg-[#6ba3d3] text-white text-xs font-semibold hover:bg-[#5a92c2] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {interacting ? 'Saving…' : 'I can help'}
          </button>
        )
      )}
    </div>
  );
};

export default RequestMap;
