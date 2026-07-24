import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RequestCard from '../RequestCard/RequestCard';
import { estimateFulfillment } from '../../utils/fulfillment';

// Help-seeker Requests view, matching the wireframe: a Calendar / List / Cards
// tab switcher over the user's requests. "List" renders a table; "Cards" reuses
// the shared RequestCard; "Calendar" plots each request on its estimated
// expected-fulfillment date (derived from urgency).
//
// @param {object[]} requests
// @param {boolean} loading
// @param {string} error
// @param {string|null} deletingId
// @param {(request) => void} onDelete
// @param {(request) => void} [onEdit] - open the edit form for a request
const SUB_TABS = [
  { id: 'calendar', labelKey: 'requests.hsRequests.tabs.calendar', icon: CalendarIcon },
  { id: 'list', labelKey: 'requests.hsRequests.tabs.list', icon: ListIcon },
  { id: 'cards', labelKey: 'requests.hsRequests.tabs.cards', icon: CardsIcon },
];

const HSRequestsView = ({ requests, loading, error, deletingId, onDelete, onEdit }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('list');

  return (
    <div>
      {/* Tab switcher pill */}
      <div className="bg-[#9db29a] dark:bg-[#1f3320] rounded-3xl px-4 py-3 flex gap-6 mb-6 transition-colors duration-300">
        {SUB_TABS.map(({ id, labelKey, icon: renderIcon }) => {
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
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-gray-600 dark:text-gray-300" role="status">{t('requests.hsRequests.loading')}</p>}
      {!loading && error && <p className="text-red-700 dark:text-red-300">{error}</p>}
      {!loading && !error && requests.length === 0 && (
        <p className="text-gray-600 dark:text-gray-300">{t('requests.hsRequests.empty')}</p>
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
          {tab === 'calendar' && <RequestsCalendar requests={requests} />}
        </>
      )}
    </div>
  );
};

// Urgency → dot color, so the calendar reads at a glance.
const URGENCY_DOT = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-green-500',
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// A month calendar that plots each request on its estimated expected-fulfillment
// date (derived from urgency). Users can page between months.
const RequestsCalendar = ({ requests }) => {
  const { t } = useTranslation();
  // Group requests by their fulfillment day, keyed "YYYY-M-D" for quick lookup.
  const byDay = {};
  for (const r of requests) {
    const date = estimateFulfillment(r);
    if (!date) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    (byDay[key] ||= []).push({ request: r, date });
  }

  // Start the calendar on the month of the soonest upcoming fulfillment, or the
  // current month if there are none.
  const allDates = requests.map(estimateFulfillment).filter(Boolean).sort((a, b) => a - b);
  const initial = allDates[0] || new Date();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const today = new Date();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build the grid cells: leading blanks for the first week, then each day.
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const changeMonth = (delta) => setCursor(new Date(year, month + delta, 1));

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-4 sm:p-6 transition-colors duration-300">
      {/* Month header + nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label={t('requests.calendar.previousMonth')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1C2A16] dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-bold text-[#1C2A16] dark:text-white">
          {t(`requests.calendar.months.${MONTH_KEYS[month]}`)} {year}
        </h3>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label={t('requests.calendar.nextMonth')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1C2A16] dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_KEYS.map((w) => (
          <div key={w} className="text-center text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 py-1">
            {t(`requests.calendar.weekdays.${w}`)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`blank-${i}`} className="min-h-[76px]" />;
          const items = byDay[`${year}-${month}-${d}`] || [];
          return (
            <div
              key={d}
              className={`min-h-[76px] rounded-xl border p-1.5 flex flex-col gap-1 ${
                isToday(d)
                  ? 'border-[#6ba3d3] bg-[#eef4fb] dark:bg-[#22304a]'
                  : 'border-gray-100 dark:border-white/10'
              }`}
            >
              <span className={`text-xs font-semibold ${isToday(d) ? 'text-[#1e3a5f] dark:text-[#6ba3d3]' : 'text-gray-500 dark:text-gray-400'}`}>
                {d}
              </span>
              {items.map(({ request }) => (
                <div
                  key={request.id}
                  title={t('requests.calendar.itemTitle', { category: request.category, urgency: request.urgency })}
                  className="flex items-center gap-1 text-[10px] leading-tight text-[#1C2A16] dark:text-gray-100 bg-gray-100 dark:bg-white/10 rounded px-1 py-0.5 truncate"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${URGENCY_DOT[request.urgency] || 'bg-gray-400'}`} />
                  <span className="truncate">{request.category}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend + note */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(URGENCY_DOT).map(([label, dot]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {t(`requests.urgencies.${label}`)}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 italic">
        {t('requests.calendar.estimateNote')}
      </p>
    </div>
  );
};

// The wireframe's List table.
const RequestTable = ({ requests, deletingId, onDelete }) => {
  const { t } = useTranslation();
  return (
  <div className="bg-[#eef4fb] dark:bg-[#16233a] rounded-3xl shadow-md overflow-hidden transition-colors duration-300">
    {/* Header row */}
    <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1.3fr_1fr_1fr_auto] gap-4 bg-[#c5d9ef] dark:bg-[#22304a] px-6 py-4 font-bold text-[#1C2A16] dark:text-white text-center">
      <span>{t('requests.table.name')}</span>
      <span>{t('requests.table.category')}</span>
      <span>{t('requests.table.urgencyLevel')}</span>
      <span>{t('requests.table.status')}</span>
      <span>{t('requests.table.dateSubmitted')}</span>
      <span>{t('requests.table.location')}</span>
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
          <span className="font-semibold">{r.submitterName || r.category || t('requests.table.requestFallback')}</span>
          <span>{r.category || '—'}</span>
          <span>{r.urgency || '—'}</span>
          <StatusCell request={r} />
          <span>{submitted}</span>
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-sky-200 to-green-200 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            </div>
            <span className="text-[10px] font-semibold uppercase text-[#3a4a30] dark:text-gray-400">
              {r.location || t('requests.table.location')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onDelete(r)}
            disabled={deletingId === r.id}
            aria-label={t('requests.table.deleteRequest')}
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
};

// "Soon to Be Fulfilled <date>" if we can infer it, else the raw status.
const StatusCell = ({ request }) => {
  const { t } = useTranslation();
  const { status } = request;
  if (status === 'matched' || status === 'in-progress') {
    return (
      <span>
        {t('requests.table.soonToBeFulfilled')}
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
