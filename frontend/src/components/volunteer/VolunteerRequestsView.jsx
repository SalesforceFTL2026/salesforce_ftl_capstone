import { useState, useMemo } from 'react';
import RequestCard from '../RequestCard/RequestCard';
import HeatMap from '../organization/HeatMap';

// Active Help Requests view for a volunteer, built from the product wireframe.
// A view switcher (Calendar / List / Cards / Map) sits above the requests. The
// List view is the wireframe's default: a table of Name / Category / Urgency /
// Time Submitted with a filter control. Cards reuses the shared RequestCard so
// a volunteer can still express interest. Calendar and Map are placeholders
// until those data sources exist. This is a front-end presentation layer over
// the same priority-feed data the dashboard already loads.
//
// @param {object[]} requests - the active/prioritized requests
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(request) => void} onInteract - "I can help with this"
// @param {string|null} interactingId
// @param {Object<string,string>} confirmations - requestId -> confirmation text
const VIEWS = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'list', label: 'List', icon: 'list' },
  { id: 'cards', label: 'Cards', icon: 'cards' },
  { id: 'map', label: 'Map', icon: 'map' },
];

const URGENCY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const VolunteerRequestsView = ({
  requests, loading, error, onRetry, onInteract, interactingId, confirmations,
}) => {
  const [activeView, setActiveView] = useState('list');
  // Which rows the volunteer has checked in the List view.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // Sort toggle behind the filter icon: default (priority) vs. by urgency.
  const [sortByUrgency, setSortByUrgency] = useState(false);

  const rows = useMemo(() => {
    if (!sortByUrgency) return requests;
    return [...requests].sort(
      (a, b) => (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9)
    );
  }, [requests, sortByUrgency]);

  const allChecked = rows.length > 0 && selectedIds.size === rows.length;

  const toggleAll = () =>
    setSelectedIds(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const toggleOne = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      {/* View switcher */}
      <div className="bg-[#c3d3ae] dark:bg-[#1f3320] rounded-3xl px-4 sm:px-6 py-3 flex flex-wrap gap-2 transition-colors duration-300">
        {VIEWS.map((v) => {
          const isActive = v.id === activeView;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveView(v.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
                isActive
                  ? 'bg-white/80 dark:bg-[#0f1a0f] text-[#1C2A16] dark:text-white border-b-2 border-[#6ba3d3]'
                  : 'text-[#1C2A16] dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <ViewIcon name={v.icon} />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="text-[#1C2A16] dark:text-gray-300" role="status">Loading…</p>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4">
          <p className="font-semibold">{error}</p>
          <button onClick={onRetry} className="mt-2 text-sm font-semibold underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && activeView === 'list' && (
        <ListView
          rows={rows}
          allChecked={allChecked}
          selectedIds={selectedIds}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          sortByUrgency={sortByUrgency}
          onToggleSort={() => setSortByUrgency((s) => !s)}
        />
      )}

      {!loading && !error && activeView === 'cards' && (
        <>
          {rows.length === 0 ? (
            <EmptyPanel text="No open requests right now. Check back soon." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rows.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onInteract={onInteract}
                  interacting={interactingId === request.id}
                  confirmation={confirmations[request.id]}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && activeView === 'map' && (
        <div className="bg-white dark:bg-[#16233a] rounded-3xl p-6 shadow-md transition-colors duration-300">
          <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white text-center mb-3">
            Where help is needed
          </h2>
          <HeatMap caption="Interactive map coming soon" />
        </div>
      )}

      {!loading && !error && activeView === 'calendar' && (
        <EmptyPanel text="Calendar view is coming soon." />
      )}
    </div>
  );
};

// --- List view: the wireframe's default table ---
const ListView = ({
  rows, allChecked, selectedIds, onToggleAll, onToggleOne, sortByUrgency, onToggleSort,
}) => (
  <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-3xl shadow-md overflow-hidden transition-colors duration-300">
    {/* Header row */}
    <div className="grid grid-cols-[auto_1.4fr_1fr_1fr_1fr_auto] items-center gap-4 bg-[#bcd4f1] dark:bg-[#22304a] px-5 py-4 font-bold text-[#1C2A16] dark:text-white">
      <input
        type="checkbox"
        checked={allChecked}
        onChange={onToggleAll}
        aria-label="Select all requests"
        className="w-4 h-4 rounded accent-[#6ba3d3]"
      />
      <span>Name</span>
      <span>Category</span>
      <span>Urgency Level</span>
      <span>Time Submitted</span>
      <button
        type="button"
        onClick={onToggleSort}
        aria-pressed={sortByUrgency}
        title={sortByUrgency ? 'Sorting by urgency' : 'Sort by urgency'}
        className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
          sortByUrgency ? 'bg-[#6ba3d3] text-white' : 'text-[#1C2A16] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
        }`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
        </svg>
      </button>
    </div>

    {rows.length === 0 && (
      <p className="px-5 py-6 text-gray-500 dark:text-gray-400 text-sm">
        No open requests right now. Check back soon.
      </p>
    )}

    {rows.map((r) => {
      const when = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : '—';
      return (
        <div
          key={r.id}
          className="grid grid-cols-[auto_1.4fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-4 border-t border-white/70 dark:border-white/10 text-[#1C2A16] dark:text-gray-100"
        >
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={() => onToggleOne(r.id)}
            aria-label={`Select request from ${r.requesterName || r.name || 'help seeker'}`}
            className="w-4 h-4 rounded accent-[#6ba3d3]"
          />
          <span className="font-medium truncate">
            {r.requesterName || r.name || 'Help Seeker'}
          </span>
          <span className="truncate">{r.category || '—'}</span>
          <UrgencyBadge urgency={r.urgency} />
          <span className="text-sm text-gray-600 dark:text-gray-400">{when}</span>
          <span aria-hidden="true" />
        </div>
      );
    })}
  </div>
);

const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const UrgencyBadge = ({ urgency }) => {
  if (!urgency) return <span className="text-gray-400 italic text-sm">Not set</span>;
  const tone = URGENCY_STYLES[urgency] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-block w-fit text-xs font-semibold px-2.5 py-1 rounded-full ${tone}`}>
      {urgency}
    </span>
  );
};

const EmptyPanel = ({ text }) => (
  <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md transition-colors duration-300">
    <p className="text-gray-500 dark:text-gray-400">{text}</p>
  </div>
);

// Small inline glyphs for the view switcher.
const ViewIcon = ({ name }) => {
  const base = { className: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8 };
  const paths = {
    calendar: 'M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    list: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-7 6l2 2 4-4',
    cards: 'M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z',
    map: 'M9 20l-5.4 1.8A1 1 0 013 20.9V6.6a1 1 0 01.7-1L9 4m0 16l6-2m-6 2V4m6 14l5.4 1.8A1 1 0 0021 20.9V6.6a1 1 0 00-.7-1L15 4m0 14V4m0 0L9 6',
  };
  return (
    <svg {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || paths.list} />
    </svg>
  );
};

export default VolunteerRequestsView;
