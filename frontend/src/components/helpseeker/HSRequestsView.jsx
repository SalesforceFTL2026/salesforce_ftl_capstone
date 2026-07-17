import { useState } from 'react';
import RequestCard from '../RequestCard/RequestCard';

// Help-seeker Requests view, matching the wireframe: a Calendar / List / Cards
// tab switcher over the user's requests. "List" renders a table; "Cards" reuses
// the shared RequestCard; "Calendar" is a friendly placeholder for now.
//
// @param {object[]} requests
// @param {boolean} loading
// @param {string} error
// @param {string|null} deletingId
// @param {(request) => void} onDelete
// @param {(request) => void} [onEdit] - open the edit form for a request
const SUB_TABS = [
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'list', label: 'List', icon: ListIcon },
  { id: 'cards', label: 'Cards', icon: CardsIcon },
];

const HSRequestsView = ({ requests, loading, error, deletingId, onDelete, onEdit }) => {
  const [tab, setTab] = useState('list');

  return (
    <div>
      {/* Tab switcher pill */}
      <div className="bg-[#9db29a] dark:bg-[#1f3320] rounded-3xl px-4 py-3 flex gap-6 mb-6 transition-colors duration-300">
        {SUB_TABS.map(({ id, label, icon: renderIcon }) => {
          const isActive = id === tab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 font-bold text-lg transition-colors ${
                isActive
                  ? 'text-[#1C2A16] dark:text-white border-b-2 border-[#6ba3d3]'
                  : 'text-[#1C2A16]/70 dark:text-gray-300 hover:text-[#1C2A16] dark:hover:text-white'
              }`}
            >
              {renderIcon()}
              {label}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-gray-600 dark:text-gray-300" role="status">Loading your requests…</p>}
      {!loading && error && <p className="text-red-700 dark:text-red-300">{error}</p>}
      {!loading && !error && requests.length === 0 && (
        <p className="text-gray-600 dark:text-gray-300">You haven't submitted any requests yet.</p>
      )}

      {!loading && !error && requests.length > 0 && (
        <>
          {tab === 'list' && (
            <RequestTable requests={requests} deletingId={deletingId} onDelete={onDelete} />
          )}
          {tab === 'cards' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {requests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onDelete={onDelete}
                  deleting={deletingId === r.id}
                  onEdit={onEdit}
                />
              ))}
            </div>
          )}
          {tab === 'calendar' && (
            <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center text-gray-500 dark:text-gray-400">
              Calendar view is coming soon.
            </div>
          )}
        </>
      )}
    </div>
  );
};

// The wireframe's List table.
const RequestTable = ({ requests, deletingId, onDelete }) => (
  <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-3xl shadow-md overflow-hidden transition-colors duration-300">
    {/* Header row */}
    <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1.3fr_1fr_1fr_auto] gap-4 bg-[#c5d9ef] dark:bg-[#22304a] px-6 py-4 font-bold text-[#1C2A16] dark:text-white text-center">
      <span>Name</span>
      <span>Category</span>
      <span>Urgency Level</span>
      <span>Status</span>
      <span>Date Submitted</span>
      <span>Location</span>
      <span className="w-8" />
    </div>

    {requests.map((r) => {
      const submitted = r.createdAt
        ? new Date(r.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';
      return (
        <div
          key={r.id}
          className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1.3fr_1fr_1fr_auto] gap-4 px-6 py-5 border-t border-white/70 dark:border-white/10 items-center text-center text-[#1C2A16] dark:text-gray-100"
        >
          <span className="font-semibold">{r.submitterName || r.category || 'Request'}</span>
          <span>{r.category || '—'}</span>
          <span>{r.urgency || '—'}</span>
          <StatusCell request={r} />
          <span>{submitted}</span>
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-sky-200 to-green-200 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            </div>
            <span className="text-[10px] font-semibold uppercase text-[#3a4a30] dark:text-gray-400">
              {r.location || 'Location'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onDelete(r)}
            disabled={deletingId === r.id}
            aria-label="Delete request"
            className="justify-self-center text-[#1C2A16] dark:text-gray-300 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      );
    })}
  </div>
);

// "Soon to Be Fulfilled <date>" if we can infer it, else the raw status.
const StatusCell = ({ request }) => {
  const { status } = request;
  if (status === 'matched' || status === 'in-progress') {
    return (
      <span>
        Soon to Be Fulfilled
        {request.fulfillmentDate && (
          <>
            <br />
            {new Date(request.fulfillmentDate).toLocaleDateString(undefined, {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </>
        )}
      </span>
    );
  }
  return <span className="capitalize">{status || 'pending'}</span>;
};

// --- Tab icons ---
const iconProps = { className: 'w-6 h-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8 };
function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
function CardsIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z" />
    </svg>
  );
}

export default HSRequestsView;
