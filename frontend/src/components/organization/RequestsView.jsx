import { useState } from 'react';
import HeatMap from './HeatMap';
import AllocationPanel from './AllocationPanel';

// Requests view for an organization, matching the wireframe:
//  - "Your Requests": requests this org has assigned to itself.
//  - "All Requests": every other request in the system (any status), which the
//    org can browse but not allocate resources to until it assigns them.
//  - Request heat map (top right).
//  - A detail panel (bottom right) for the selected request.
//
// @param {object[]} yourRequests - requests the org has assigned to itself
// @param {object[]} unfiltered - all other requests the org can browse
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(request, status) => void} onStatusChange
// @param {string|null} updatingId
// @param {object[]} resources - the org's inventory, for allocating to requests
// @param {() => void} onAllocationsChanged - refresh resources after allocating
// @param {Set<string>} assignedIds - ids of requests assigned to this org
// @param {(request, assign) => void} onToggleAssign - assign/unassign a request
// @param {string|null} assigningId - request id currently being (un)assigned
const RequestsView = ({
  yourRequests, unfiltered, loading, error, onRetry, onStatusChange, updatingId,
  resources = [], onAllocationsChanged,
  assignedIds = new Set(), onToggleAssign, assigningId,
}) => {
  // Which request's details show in the bottom-right panel.
  const [selected, setSelected] = useState(null);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: two request tables */}
      <div className="flex flex-col gap-6">
        <RequestTable
          title="Your Requests"
          requests={yourRequests}
          loading={loading}
          error={error}
          onRetry={onRetry}
          selectedId={selected?.id}
          onSelect={setSelected}
          emptyText="You aren't responding to any requests yet."
        />
        <RequestTable
          title="All Requests"
          requests={unfiltered}
          loading={loading}
          error={error}
          onRetry={onRetry}
          selectedId={selected?.id}
          onSelect={setSelected}
          emptyText="No other requests right now."
        />
      </div>

      {/* Right: heat map + detail panel */}
      <div className="flex flex-col gap-6">
        <div className="bg-white dark:bg-[#16233a] rounded-3xl p-5 shadow-md transition-colors duration-300">
          <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white text-center mb-3">
            Request Heat Map
          </h2>
          <HeatMap caption="Last updated 8 min ago" />
        </div>

        <RequestDetail
          request={selected}
          onStatusChange={onStatusChange}
          updating={selected && updatingId === selected.id}
          resources={resources}
          onAllocationsChanged={onAllocationsChanged}
          isAssigned={selected ? assignedIds.has(selected.id) : false}
          onToggleAssign={onToggleAssign}
          assigning={selected && assigningId === selected.id}
        />
      </div>
    </div>
  );
};

// --- Request table ---
const RequestTable = ({ title, requests, loading, error, onRetry, selectedId, onSelect, emptyText }) => (
  <div>
    <div className="inline-block bg-[#9db29a] dark:bg-[#1f3320] text-[#1C2A16] dark:text-white font-bold rounded-t-2xl px-6 py-2 mb-[-8px] relative z-10">
      {title}
    </div>
    <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-2xl rounded-tl-none shadow-md overflow-hidden transition-colors duration-300">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto] gap-4 bg-[#c5d9ef] dark:bg-[#22304a] px-5 py-3 font-bold text-[#1C2A16] dark:text-white">
        <span>Name</span>
        <span>Priority</span>
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
            <PriorityLabel request={r} />
          </button>
        );
      })}
    </div>
  </div>
);

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

const RequestDetail = ({
  request, onStatusChange, updating, resources, onAllocationsChanged,
  isAssigned, onToggleAssign, assigning,
}) => {
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

        {/* Assign / unassign this request to the organization. Assigning is what
            unlocks allocating resources below; other orgs can assign the same
            request independently. */}
        {onToggleAssign && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleAssign(request, !isAssigned)}
              disabled={assigning}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-60 ${
                isAssigned
                  ? 'bg-white/70 dark:bg-black/20 text-[#1C2A16] dark:text-white border border-[#1C2A16]/30 dark:border-white/20'
                  : 'bg-[#1C2A16] dark:bg-[#7F9764] text-white'
              }`}
            >
              {assigning
                ? 'Saving…'
                : isAssigned
                  ? 'Unassign from us'
                  : 'Assign to us'}
            </button>
            {isAssigned && (
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                Assigned to your organization
              </span>
            )}
          </div>
        )}

        {/* Assign resources from the org's inventory to this request — only once
            the request is assigned to this organization. */}
        {isAssigned ? (
          <AllocationPanel
            request={request}
            resources={resources}
            onChanged={onAllocationsChanged}
          />
        ) : (
          <p className="mt-4 pt-4 border-t border-white/40 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300">
            Assign this request to your organization to allocate resources to it.
          </p>
        )}
      </div>
    </div>
  );
};

export default RequestsView;
