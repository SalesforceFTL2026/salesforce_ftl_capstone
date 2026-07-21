import { useState, useMemo, useEffect } from 'react';
import HeatMap from './HeatMap';
import RequestMap from '../map/RequestMap';
import NearMeToggle from '../map/NearMeToggle';
import AllocationPanel from './AllocationPanel';
import { getRequestDistances, requestErrorMessage } from '../../utils/requests';

// How the request tables can be ordered.
const SORT_OPTIONS = [
  { id: 'priority', label: 'Priority (high → low)' },
  { id: 'newest', label: 'Newest first' },
  { id: 'nearest', label: 'Nearest to you' },
];

// Return a copy of `requests` ordered by the chosen sort. For "nearest" we use
// the distances map ({ id: miles | null }); requests with an unknown distance
// (null / not yet loaded) sort to the end so real distances come first.
const sortRequests = (requests, sortBy, distances) => {
  const copy = [...requests];
  if (sortBy === 'newest') {
    copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'nearest') {
    const far = Number.POSITIVE_INFINITY;
    const miles = (r) => {
      const d = distances[r.id];
      return typeof d === 'number' ? d : far;
    };
    copy.sort((a, b) => miles(a) - miles(b));
  } else {
    // Default: priority score, highest first.
    copy.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }
  return copy;
};

// Requests view for an organization, matching the wireframe:
//  - "Your Requests": requests this org is already responding to.
//  - "Unfiltered Requests": the open priority feed (not yet claimed).
//  - Request heat map (top right).
//  - A detail panel (bottom right) for the selected request.
//
// @param {object[]} yourRequests - requests the org is responding to
// @param {object[]} unfiltered - open/unclaimed priority-feed requests
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(request, status) => void} onStatusChange
// @param {string|null} updatingId
// @param {string} orgLocation - the org's location, used as the "nearest" origin
// @param {() => void} onOrgLocationChange - persist a new org location
// @param {object|null} near - active "Near me" geo-radius filter (issue #116)
// @param {(near) => void} onNearChange - toggle/update the "Near me" filter
// @param {object[]} resources - the org's inventory, for allocating to requests
// @param {() => void} onAllocationsChanged - refresh resources after allocating
const RequestsView = ({
  yourRequests, unfiltered, loading, error, onRetry, onStatusChange, updatingId,
  orgLocation, onOrgLocationChange,
  near, onNearChange,
  resources = [], onAllocationsChanged,
}) => {
  // Which request's details show in the bottom-right panel.
  const [selected, setSelected] = useState(null);
  // Top-right panel view: the density heat map, or the interactive pin map.
  const [geoView, setGeoView] = useState('heat');

  // Every request the org can see (its own + the open feed), for the heat map
  // and pin map. De-duplicated so a request the org is responding to that also
  // appears in the open feed is only plotted once.
  const allRequests = useMemo(() => {
    const byId = new Map();
    for (const r of [...yourRequests, ...unfiltered]) {
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
    return [...byId.values()];
  }, [yourRequests, unfiltered]);

  // Sorting: how the tables are ordered, plus the distance data "nearest" needs.
  const [sortBy, setSortBy] = useState('priority');
  const [distances, setDistances] = useState({});
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState('');

  // Inline editor for the org's own location (the origin "nearest" measures from).
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState(orgLocation || '');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const saveLocation = async () => {
    setSavingLocation(true);
    setLocationError('');
    try {
      await onOrgLocationChange?.(locationInput.trim());
      setEditingLocation(false);
    } catch (err) {
      setLocationError(requestErrorMessage(err, 'Could not save your location.'));
    } finally {
      setSavingLocation(false);
    }
  };

  // When the org picks "nearest", fetch distances from its location (once we
  // have one). We key off orgLocation so switching orgs re-fetches.
  useEffect(() => {
    if (sortBy !== 'nearest') return;

    if (!orgLocation) {
      setDistanceError('Add a location to your organization profile to sort by distance.');
      return;
    }

    let cancelled = false;
    setDistanceLoading(true);
    setDistanceError('');
    getRequestDistances(orgLocation)
      .then((map) => { if (!cancelled) setDistances(map); })
      .catch((err) => {
        if (!cancelled) setDistanceError(requestErrorMessage(err, 'Could not sort by distance.'));
      })
      .finally(() => { if (!cancelled) setDistanceLoading(false); });

    return () => { cancelled = true; };
  }, [sortBy, orgLocation]);

  const sortedYours = useMemo(
    () => sortRequests(yourRequests, sortBy, distances),
    [yourRequests, sortBy, distances]
  );
  const sortedUnfiltered = useMemo(
    () => sortRequests(unfiltered, sortBy, distances),
    [unfiltered, sortBy, distances]
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: sort control + two request tables */}
      <div className="flex flex-col gap-6">
        <div className="bg-white dark:bg-[#16233a] rounded-2xl px-5 py-3 shadow-md flex flex-wrap items-center gap-2 transition-colors duration-300">
          <label htmlFor="sort-requests" className="text-sm font-semibold text-[#1C2A16] dark:text-white">
            Sort by
          </label>
          <select
            id="sort-requests"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-3 py-1.5"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {sortBy === 'nearest' && distanceLoading && (
            <span className="text-xs text-gray-500 dark:text-gray-400" role="status">Measuring distances…</span>
          )}

          {/* Your location — the origin "nearest" measures from. Editable inline. */}
          <div className="ml-auto flex items-center gap-2">
            {editingLocation ? (
              <>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveLocation(); }}
                  placeholder="City, ST or ZIP"
                  autoFocus
                  className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-2 py-1.5 w-40"
                />
                <button
                  type="button"
                  onClick={saveLocation}
                  disabled={savingLocation}
                  className="text-xs font-semibold bg-[#1C2A16] dark:bg-[#7F9764] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-60"
                >
                  {savingLocation ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingLocation(false); setLocationError(''); }}
                  className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setLocationInput(orgLocation || ''); setEditingLocation(true); }}
                className="text-xs font-semibold text-[#1C2A16] dark:text-gray-200 hover:underline"
                title="Set the location distances are measured from"
              >
                📍 {orgLocation ? `Your location: ${orgLocation}` : 'Set your location'}
              </button>
            )}
          </div>
        </div>

        {(locationError || (sortBy === 'nearest' && distanceError)) && (
          <p className="text-xs text-amber-700 dark:text-amber-400 -mt-4">
            {locationError || distanceError}
          </p>
        )}

        <RequestTable
          title="Your Requests"
          requests={sortedYours}
          loading={loading}
          error={error}
          onRetry={onRetry}
          selectedId={selected?.id}
          onSelect={setSelected}
          emptyText="You aren't responding to any requests yet."
          sortBy={sortBy}
          distances={distances}
        />
        <RequestTable
          title="Unfiltered Requests"
          requests={sortedUnfiltered}
          loading={loading}
          error={error}
          onRetry={onRetry}
          selectedId={selected?.id}
          onSelect={setSelected}
          emptyText="No open requests right now."
          sortBy={sortBy}
          distances={distances}
        />
      </div>

      {/* Right: heat map / pin map + detail panel */}
      <div className="flex flex-col gap-6">
        <div className="bg-white dark:bg-[#16233a] rounded-3xl p-5 shadow-md transition-colors duration-300">
          {/* "Near me" geo-radius filter (issue #116). Narrows the open feed —
              and therefore the heat/pin map — to the org's area. */}
          {onNearChange && (
            <div className="mb-3">
              <NearMeToggle
                onChange={onNearChange}
                active={Boolean(near)}
                count={near ? unfiltered.length : null}
              />
            </div>
          )}
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white">
              {geoView === 'heat' ? 'Request Heat Map' : 'Request Map'}
            </h2>
            {/* Toggle between the density heat map and the interactive pin map. */}
            <div className="flex rounded-xl bg-black/5 dark:bg-white/10 p-1">
              {[
                { id: 'heat', label: 'Heat' },
                { id: 'map', label: 'Map' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGeoView(opt.id)}
                  aria-pressed={geoView === opt.id}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
                    geoView === opt.id
                      ? 'bg-[#6ba3d3] text-white'
                      : 'text-[#1C2A16] dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {geoView === 'heat' ? (
            <HeatMap requests={allRequests} caption="Shaded by where needs cluster" />
          ) : (
            <RequestMap requests={allRequests} />
          )}
        </div>

        <RequestDetail
          request={selected}
          onStatusChange={onStatusChange}
          updating={selected && updatingId === selected.id}
          resources={resources}
          onAllocationsChanged={onAllocationsChanged}
        />
      </div>
    </div>
  );
};

// Column label + per-row value for the right-hand column, which follows the
// active sort: priority label, request date, or distance from the org.
const secondColumnHeader = (sortBy) =>
  sortBy === 'newest' ? 'Date' : sortBy === 'nearest' ? 'Distance' : 'Priority';

// --- Request table ---
const RequestTable = ({
  title, requests, loading, error, onRetry, selectedId, onSelect, emptyText,
  sortBy = 'priority', distances = {},
}) => (
  <div>
    <div className="inline-block bg-[#9db29a] dark:bg-[#1f3320] text-[#1C2A16] dark:text-white font-bold rounded-t-2xl px-6 py-2 mb-[-8px] relative z-10">
      {title}
    </div>
    <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-2xl rounded-tl-none shadow-md overflow-hidden transition-colors duration-300">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto] gap-4 bg-[#c5d9ef] dark:bg-[#22304a] px-5 py-3 font-bold text-[#1C2A16] dark:text-white">
        <span>Name</span>
        <span>{secondColumnHeader(sortBy)}</span>
      </div>

      {loading && (
        <p className="px-5 py-4 text-gray-500 dark:text-gray-400 text-sm" role="status">Loading…</p>
      )}
      {!loading && error && (
        <div className="px-5 py-4">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <button onClick={onRetry} className="text-sm font-semibold underline mt-1">Try again</button>
        </div>
      )}
      {!loading && !error && requests.length === 0 && (
        <p className="px-5 py-4 text-gray-500 dark:text-gray-400 text-sm">{emptyText}</p>
      )}
      {!loading && !error && requests.map((r) => {
        const isSelected = r.id === selectedId;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onSelect(r)}
            className={`w-full grid grid-cols-[1fr_auto] gap-4 px-5 py-3 text-left border-t border-white/60 dark:border-white/10 transition-colors ${
              isSelected ? 'bg-[#bcd4f1] dark:bg-[#2b3b55]' : 'hover:bg-white/60 dark:hover:bg-white/5'
            }`}
          >
            <span className="text-[#1C2A16] dark:text-gray-100 font-medium truncate">
              {r.submitterName || r.requesterName || r.name || 'Help Seeker'}
            </span>
            <SecondColumn request={r} sortBy={sortBy} distances={distances} />
          </button>
        );
      })}
    </div>
  </div>
);

// Right-hand column value for a row, matching the active sort: the priority
// label, the request's date, or its distance from the org.
const SecondColumn = ({ request, sortBy, distances }) => {
  if (sortBy === 'newest') {
    const d = request.createdAt ? new Date(request.createdAt) : null;
    return (
      <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
      </span>
    );
  }

  if (sortBy === 'nearest') {
    const miles = distances[request.id];
    return (
      <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {typeof miles === 'number' ? `${miles} mi` : '—'}
      </span>
    );
  }

  return <PriorityLabel request={request} />;
};

// Turn an urgency / priority score into the wireframe's "Low / High / Not set".
const PriorityLabel = ({ request }) => {
  const { urgency, priorityScore } = request;
  let label = urgency;
  if (!label && typeof priorityScore === 'number' && priorityScore > 0) {
    label = priorityScore >= 70 ? 'High' : priorityScore >= 40 ? 'Medium' : 'Low';
  }
  if (!label) return <span className="text-gray-400 dark:text-gray-500 italic">Not set</span>;

  const tone = {
    Critical: 'text-red-700 dark:text-red-400',
    High: 'text-orange-600 dark:text-orange-400',
    Medium: 'text-yellow-700 dark:text-yellow-400',
    Low: 'text-green-700 dark:text-green-400',
  }[label] || 'text-gray-600 dark:text-gray-300';

  return <span className={`font-semibold ${tone}`}>{label}</span>;
};

// --- Detail panel (bottom right) ---
const STATUS_OPTIONS = ['pending', 'in-progress', 'matched', 'fulfilled', 'closed'];

const RequestDetail = ({ request, onStatusChange, updating, resources, onAllocationsChanged }) => {
  if (!request) {
    return (
      <div className="bg-[#bcd4f1] dark:bg-[#16233a] rounded-3xl p-8 shadow-md text-center text-[#1C2A16] dark:text-gray-300 transition-colors duration-300">
        Select a request to see its details.
      </div>
    );
  }

  const {
    submitterName, requesterName, name, phone, householdSize, description, category,
    urgency, location, priorityScore, status,
  } = request;

  return (
    <div className="bg-[#bcd4f1] dark:bg-[#16233a] rounded-3xl p-5 shadow-md flex flex-col sm:flex-row gap-4 transition-colors duration-300">
      {/* Requester card */}
      <div className="bg-[#9db29a] dark:bg-[#1f3320] rounded-2xl p-4 text-center text-[#1C2A16] dark:text-white sm:w-44 shrink-0">
        <p className="font-bold text-sm mb-2">{submitterName || requesterName || name || 'Help Seeker'}</p>
        <div className="w-16 h-16 mx-auto rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase">Phone Number</p>
        <p className="text-sm bg-white/70 dark:bg-black/20 rounded-full px-2 py-1 mt-1">
          {phone || '(555) 123-4567'}
        </p>
        <p className="text-xs font-semibold uppercase mt-2"># in Household</p>
        <p className="text-sm bg-white/70 dark:bg-black/20 rounded-full px-2 py-1 mt-1">
          {householdSize ?? '—'}
        </p>
      </div>

      {/* Request details */}
      <div className="flex-1 text-[#1C2A16] dark:text-white">
        <h3 className="font-bold uppercase tracking-wide mb-2">Help Request Details</h3>

        <p className="text-xs font-semibold uppercase">Description</p>
        <p className="bg-white/70 dark:bg-black/20 rounded-lg p-2 text-sm min-h-[48px] mb-3">
          {description || 'No description provided.'}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase">Category of Help</p>
            <p className="bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1 text-sm mt-1">{category || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase">User-Declared Urgency</p>
            <p className="bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1 text-sm mt-1">{urgency || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase">Location</p>
            <p className="bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1 text-sm mt-1">{location || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase">AI Priority Rating</p>
            <p className="bg-white/70 dark:bg-black/20 rounded-lg px-2 py-1 text-sm mt-1">
              {typeof priorityScore === 'number' && priorityScore > 0 ? Math.round(priorityScore) : 'Not scored'}
            </p>
          </div>
        </div>

        {/* Status control — the org's action on this request */}
        {onStatusChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="detail-status" className="text-xs font-semibold uppercase">Status</label>
            <select
              id="detail-status"
              value={status || 'pending'}
              disabled={updating}
              onChange={(e) => onStatusChange(request, e.target.value)}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-3 py-1.5 capitalize disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {updating && <span className="text-xs" role="status">Saving…</span>}
          </div>
        )}

        {/* Assign resources from the org's inventory to this request */}
        <AllocationPanel
          request={request}
          resources={resources}
          onChanged={onAllocationsChanged}
        />
      </div>
    </div>
  );
};

export default RequestsView;
