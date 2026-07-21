import { useState, useMemo } from 'react';
import RequestCard from '../RequestCard/RequestCard';
import RequestMap from '../map/RequestMap';
import NearMeToggle from '../map/NearMeToggle';
import HeatMap from '../organization/HeatMap';

// Active Help Requests view for a volunteer, built from the product wireframe.
// A view switcher (Calendar / List / Cards / Map) sits above the requests. The
// List view is the wireframe's default: a table of Name / Category / Urgency /
// AI Priority / Time Submitted, plus a per-row action to express interest and a
// "Why?" toggle that expands the AI prioritizer's full reasoning inline. The
// AI Priority column surfaces the prioritization pipeline's score. Cards reuses
// the shared RequestCard so a volunteer can still express interest there too.
// Map plots geocoded requests on a Leaflet map (RequestMap) where a volunteer
// can also express interest from a pin's popup. Calendar buckets requests by
// submission date. This is a front-end presentation layer over the same
// priority-feed data the dashboard already loads.
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
  { id: 'heat', label: 'Heat', icon: 'heat' },
];

const URGENCY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const VolunteerRequestsView = ({
  requests, loading, error, onRetry, onInteract, interactingId, confirmations,
  near, onNearChange,
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

  // "I can help with selected" — express interest in every checked row that the
  // volunteer hasn't already responded to (and isn't mid-flight), then clear the
  // selection. Reuses the same onInteract the Cards view uses, so one request at
  // a time flows through the existing POST /api/requests/:id/interact handler.
  const helpWithSelected = async () => {
    const targets = rows.filter(
      (r) => selectedIds.has(r.id) && !confirmations[r.id] && interactingId !== r.id
    );
    for (const request of targets) {
      await onInteract(request);
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col gap-5">
      {/* View switcher + "Near me" geo-radius filter (issue #116). */}
      <div className="bg-[#c3d3ae] dark:bg-[#1f3320] rounded-3xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors duration-300">
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => {
            const isActive = v.id === activeView;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
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
        {onNearChange && (
          <NearMeToggle
            onChange={onNearChange}
            active={Boolean(near)}
            count={near ? requests.length : null}
          />
        )}
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
          onInteract={onInteract}
          interactingId={interactingId}
          confirmations={confirmations}
          onHelpWithSelected={helpWithSelected}
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
          <RequestMap
            requests={rows}
            onInteract={onInteract}
            interactingId={interactingId}
            confirmations={confirmations}
          />
        </div>
      )}

      {!loading && !error && activeView === 'heat' && (
        <div className="bg-white dark:bg-[#16233a] rounded-3xl p-6 shadow-md transition-colors duration-300">
          <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white text-center mb-3">
            Where needs are concentrated
          </h2>
          <HeatMap requests={rows} caption="Shaded by where requests cluster" />
        </div>
      )}

      {!loading && !error && activeView === 'calendar' && (
        <CalendarView
          rows={rows}
          onInteract={onInteract}
          interactingId={interactingId}
          confirmations={confirmations}
        />
      )}
    </div>
  );
};

// --- Calendar view: requests bucketed by their submission date ---
// A month grid where each day shows how many requests came in, with small dots
// colored by urgency. Selecting a day lists its requests below (reusing the
// shared RequestCard so "I can help" works here too). Navigating starts on the
// month of the most recent request so the demo data is visible immediately.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const URGENCY_DOT = {
  Critical: 'bg-[#c84444]',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-green-500',
};

// Local YYYY-M-D key so requests bucket by calendar day in the user's timezone.
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const CalendarView = ({ rows, onInteract, interactingId, confirmations }) => {
  // Group requests by the day they were submitted.
  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!r.createdAt) continue;
      const key = dayKey(new Date(r.createdAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  }, [rows]);

  // Start on the month of the most recent request (falls back to today).
  const latest = useMemo(() => {
    const times = rows
      .map((r) => (r.createdAt ? new Date(r.createdAt).getTime() : null))
      .filter((t) => t !== null);
    return times.length ? new Date(Math.max(...times)) : new Date();
  }, [rows]);

  const [cursor, setCursor] = useState(() => new Date(latest.getFullYear(), latest.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(() => dayKey(latest));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  // Build the cells: leading blanks to align the 1st, then each day of the month.
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goMonth = (delta) => {
    setCursor(new Date(year, month + delta, 1));
  };

  const selected = selectedKey ? byDay.get(selectedKey) || [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-3xl shadow-md p-5 transition-colors duration-300">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            className="p-2 rounded-lg text-[#1C2A16] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-[#1C2A16] dark:text-white">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            className="p-2 rounded-lg text-[#1C2A16] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {w}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            if (d === null) return <div key={`blank-${i}`} />;
            const key = `${year}-${month}-${d}`;
            const dayRows = byDay.get(key) || [];
            const isSelected = key === selectedKey;
            const hasRequests = dayRows.length > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-pressed={isSelected}
                className={`min-h-[64px] rounded-xl p-2 flex flex-col items-start gap-1 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
                  isSelected
                    ? 'bg-[#6ba3d3] text-white'
                    : hasRequests
                      ? 'bg-white dark:bg-[#22304a] text-[#1C2A16] dark:text-white hover:bg-[#dce8f7] dark:hover:bg-[#2b3b55]'
                      : 'bg-white/40 dark:bg-[#0f1a2e]/40 text-gray-500 dark:text-gray-500'
                }`}
              >
                <span className="text-sm font-semibold">{d}</span>
                {hasRequests && (
                  <div className="flex flex-wrap gap-1">
                    {dayRows.slice(0, 4).map((r) => (
                      <span
                        key={r.id}
                        className={`w-2 h-2 rounded-full ${URGENCY_DOT[r.urgency] || 'bg-gray-400'}`}
                        aria-hidden="true"
                      />
                    ))}
                    {dayRows.length > 4 && (
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        +{dayRows.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected-day detail */}
      <div>
        <h3 className="font-bold text-[#1C2A16] dark:text-white mb-3">
          {selectedKey
            ? new Date(year, month, Number(selectedKey.split('-')[2])).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })
            : 'Select a day'}
        </h3>
        {selected.length === 0 ? (
          <EmptyPanel text="No requests submitted on this day." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {selected.map((request) => (
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
      </div>
    </div>
  );
};

// --- List view: the wireframe's default table ---
// Columns: select · Name · Category · Urgency · AI Priority · Time · Actions.
// Each row can express interest inline ("I can help") and expand the AI
// prioritizer's full reasoning ("Why?"). A bulk bar appears when rows are
// selected so a volunteer can offer to help with several at once.
// select · Name · Category · Urgency · AI Priority · Time · Actions.
// Fixed-ish tracks keep the headers aligned with the content and avoid the
// wide gap the earlier `auto` tracks produced between Urgency and AI Priority.
const COLS = 'grid-cols-[2.5rem_minmax(8rem,1.5fr)_1fr_1fr_7rem_1.3fr_12rem]';

const ListView = ({
  rows, allChecked, selectedIds, onToggleAll, onToggleOne, sortByUrgency, onToggleSort,
  onInteract, interactingId, confirmations, onHelpWithSelected,
}) => {
  // Which rows have their AI reasoning expanded.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk action bar — only when at least one row is selected. */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#dce8f7] dark:bg-[#22304a] rounded-2xl px-5 py-3">
          <span className="font-semibold text-[#1C2A16] dark:text-white text-lg">
            {selectedCount} request{selectedCount === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={onHelpWithSelected}
            className="px-5 py-2.5 rounded-xl bg-[#6ba3d3] text-white font-semibold text-base hover:bg-[#5a92c2] focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 transition-colors"
          >
            I can help with selected
          </button>
        </div>
      )}

      <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-3xl shadow-md overflow-hidden transition-colors duration-300">
        {/* Header row */}
        <div className={`grid ${COLS} items-center gap-4 bg-[#bcd4f1] dark:bg-[#22304a] px-5 py-4 font-bold text-lg text-[#1C2A16] dark:text-white`}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={onToggleAll}
            aria-label="Select all requests"
            className="w-5 h-5 rounded accent-[#6ba3d3]"
          />
          <span>Name</span>
          <span>Category</span>
          <span>Urgency Level</span>
          <span title="AI-calculated priority score (0–100)">AI Priority</span>
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
          <p className="px-5 py-6 text-gray-500 dark:text-gray-400 text-lg">
            No open requests right now. Check back soon.
          </p>
        )}

        {rows.map((r) => {
          const when = r.createdAt
            ? new Date(r.createdAt).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : '—';
          const expanded = expandedIds.has(r.id);
          const confirmation = confirmations[r.id];
          const interacting = interactingId === r.id;
          return (
            <div key={r.id} className="border-t border-white/70 dark:border-white/10">
              <div className={`grid ${COLS} items-center gap-4 px-5 py-5 text-lg text-[#1C2A16] dark:text-gray-100`}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => onToggleOne(r.id)}
                  aria-label={`Select request from ${r.submitterName || r.requesterName || r.name || 'help seeker'}`}
                  className="w-5 h-5 rounded accent-[#6ba3d3]"
                />
                <span className="font-semibold truncate">
                  {r.submitterName || r.requesterName || r.name || 'Help Seeker'}
                </span>
                <span className="truncate">{r.category || '—'}</span>
                <UrgencyBadge urgency={r.urgency} />
                <PriorityBadge score={r.priorityScore} />
                <span className="text-base text-gray-600 dark:text-gray-400">{when}</span>
                <RowActions
                  request={r}
                  expanded={expanded}
                  onToggleExpanded={() => toggleExpanded(r.id)}
                  onInteract={onInteract}
                  interacting={interacting}
                  confirmation={confirmation}
                />
              </div>

              {/* Expanded AI reasoning — the prioritizer's explanation in full. */}
              {expanded && (
                <div className="px-5 pb-4 -mt-1">
                  <div className="rounded-xl bg-white dark:bg-[#0f1a2e] border border-[#bcd4f1] dark:border-white/10 p-4 text-base text-gray-700 dark:text-gray-200">
                    <p className="font-semibold text-lg text-[#1C2A16] dark:text-white mb-1">
                      🤖 Why the AI prioritized this
                    </p>
                    <p>{r.reasoning || 'This request has not been scored by the AI prioritizer yet.'}</p>
                    {r.description && (
                      <p className="mt-2 text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Request: </span>{r.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Per-row actions: a "Why?" toggle for the AI reasoning and an "I can help"
// button (which becomes a confirmation once interest is recorded).
const RowActions = ({ request, expanded, onToggleExpanded, onInteract, interacting, confirmation }) => (
  <div className="flex items-center gap-2 justify-end">
    {request.reasoning && (
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        title="Show why the AI prioritized this request"
        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
          expanded
            ? 'bg-[#6ba3d3] text-white'
            : 'text-[#6ba3d3] hover:bg-[#6ba3d3]/10 dark:hover:bg-[#6ba3d3]/20'
        }`}
      >
        Why?
      </button>
    )}
    {confirmation ? (
      <span className="text-sm font-semibold text-green-700 dark:text-green-400 whitespace-nowrap" role="status">
        ✓ Helping
      </span>
    ) : (
      onInteract && (
        <button
          type="button"
          onClick={() => onInteract(request)}
          disabled={interacting}
          className="px-4 py-2 rounded-lg bg-[#6ba3d3] text-white text-sm font-semibold hover:bg-[#5a92c2] focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {interacting ? 'Saving…' : 'I can help'}
        </button>
      )
    )}
  </div>
);

const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const UrgencyBadge = ({ urgency }) => {
  if (!urgency) return <span className="text-gray-400 italic text-base">Not set</span>;
  const tone = URGENCY_STYLES[urgency] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-block w-fit text-sm font-semibold px-3 py-1.5 rounded-full ${tone}`}>
      {urgency}
    </span>
  );
};

// Color the AI priority score by severity, matching RequestCard's scale so the
// number reads the same in the List view and the Cards view.
const PRIORITY_STYLES = (score) => {
  if (score >= 80) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (score >= 60) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

// The AI-calculated priority score, surfaced from the prioritization pipeline.
// Only shown once a request has actually been scored (score > 0); unscored
// requests show a muted dash. The Claude reasoning rides along as a tooltip.
const PriorityBadge = ({ score, reasoning }) => {
  const hasScore = typeof score === 'number' && score > 0;
  if (!hasScore) return <span className="text-gray-400 italic text-base">—</span>;
  return (
    <span
      className={`inline-block w-fit text-base font-bold px-3 py-1.5 rounded-full ${PRIORITY_STYLES(score)}`}
      title={reasoning || 'AI-calculated priority score (0–100)'}
    >
      {Math.round(score)}
    </span>
  );
};

const EmptyPanel = ({ text }) => (
  <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md transition-colors duration-300">
    <p className="text-gray-500 dark:text-gray-400 text-lg">{text}</p>
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
    heat: 'M4 6h4v4H4V6zm0 8h4v4H4v-4zm6-8h4v4h-4V6zm0 8h4v4h-4v-4zm6-8h4v4h-4V6zm0 8h4v4h-4v-4z',
  };
  return (
    <svg {...base}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || paths.list} />
    </svg>
  );
};

export default VolunteerRequestsView;
