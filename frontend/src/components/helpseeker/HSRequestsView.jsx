import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RequestCard from '../RequestCard/RequestCard';
import RequestFilterBar from '../RequestFilterBar/RequestFilterBar';
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

const HSRequestsView = ({
  requests,
  loading,
  error,
  deletingId,
  onDelete,
  onEdit,
  filters = { search: '', category: '', urgency: '' },
  onFiltersChange,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState('list');
  const filteredRequests = useMemo(() => {
    const search = (filters.search || '').trim().toLowerCase();
    const category = filters.category || '';
    const urgency = filters.urgency || '';

    return requests.filter((r) => {
      if (category && r.category !== category) return false;
      if (urgency && r.urgency !== urgency) return false;
      if (!search) return true;

      const haystack = [
        r.submitterName,
        r.description,
        r.location,
        r.category,
        r.urgency,
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [requests, filters]);

  return (
    <div>
      {onFiltersChange && (
        <div className="mb-6">
          <RequestFilterBar
            value={filters}
            onChange={onFiltersChange}
            resultCount={loading ? undefined : filteredRequests.length}
          />
        </div>
      )}

      {/* Tab switcher pill */}
      <div className="bg-surface-2 ring-1 ring-hairline rounded-3xl px-4 py-3 flex flex-wrap gap-2 sm:gap-4 mb-6 transition-colors duration-300">
        {SUB_TABS.map(({ id, labelKey, icon: renderIcon }) => {
          const isActive = id === tab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-display text-lg tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-pin-500/40 ${
                isActive
                  ? 'bg-pin-500 text-white shadow-card'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-3'
              }`}
            >
              {renderIcon()}
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-ink-muted" role="status">{t('requests.hsRequests.loading')}</p>}
      {!loading && error && <p className="text-pin-600 dark:text-pin-400">{error}</p>}
      {!loading && !error && filteredRequests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-hairline p-8 text-center">
          <p className="text-ink-muted">{t('requests.hsRequests.empty')}</p>
        </div>
      )}

      {!loading && !error && filteredRequests.length > 0 && (
        <>
          {tab === 'list' && (
            <RequestTable requests={filteredRequests} deletingId={deletingId} onDelete={onDelete} />
          )}
          {tab === 'cards' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredRequests.map((r) => (
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
          {tab === 'calendar' && <RequestsCalendar requests={filteredRequests} />}
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
    <div className="bg-surface-2 rounded-3xl ring-1 ring-hairline shadow-card p-4 sm:p-6 transition-colors duration-300">
      {/* Month header + nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label={t('requests.calendar.previousMonth')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-ink hover:bg-surface-3 transition-colors focus:outline-none focus:ring-2 focus:ring-pin-500/40"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-display text-xl tracking-wide text-ink">
          {t(`requests.calendar.months.${MONTH_KEYS[month]}`)} {year}
        </h3>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label={t('requests.calendar.nextMonth')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-ink hover:bg-surface-3 transition-colors focus:outline-none focus:ring-2 focus:ring-pin-500/40"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_KEYS.map((w) => (
          <div key={w} className="text-center text-xs font-bold uppercase tracking-wide text-ink-muted py-1">
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
                  ? 'border-pin-500 bg-pin-500/5'
                  : 'border-hairline'
              }`}
            >
              <span className={`text-sm font-semibold ${isToday(d) ? 'text-pin-600 dark:text-pin-400' : 'text-ink-muted'}`}>
                {d}
              </span>
              {items.map(({ request }) => (
                <div
                  key={request.id}
                  title={t('requests.calendar.itemTitle', { category: request.category, urgency: request.urgency })}
                  className="flex items-center gap-1 text-xs leading-tight text-ink bg-surface-3 rounded px-1 py-0.5 truncate"
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
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-ink-muted">
        {Object.entries(URGENCY_DOT).map(([label, dot]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {t(`requests.urgencies.${label}`)}
          </span>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-2 italic">
        {t('requests.calendar.estimateNote')}
      </p>
    </div>
  );
};

// The wireframe's List table.
const RequestTable = ({ requests, deletingId, onDelete }) => {
  const { t } = useTranslation();
  return (
  <div className="bg-surface-2 rounded-3xl ring-1 ring-hairline shadow-card overflow-hidden transition-colors duration-300">
    {/* Header row */}
    <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1.3fr_1fr_1fr_auto] gap-4 bg-surface-3 px-6 py-4 font-display text-lg tracking-wide text-ink text-center">
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
        <div key={r.id} className="border-t border-hairline px-6 py-5 text-ink">
          <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1.3fr_1fr_1fr_auto] gap-4 items-center text-center">
            <span className="font-semibold">{r.submitterName || r.category || t('requests.table.requestFallback')}</span>
            <span>{r.category || '—'}</span>
            <span>{r.urgency || '—'}</span>
            <StatusCell request={r} />
            <span>{submitted}</span>
            <LocationCell request={r} />
            <button
              type="button"
              onClick={() => onDelete(r)}
              disabled={deletingId === r.id}
              aria-label={t('requests.table.deleteRequest')}
              className="justify-self-center text-ink-muted hover:text-pin-600 disabled:opacity-50 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Description in an inset panel beneath the row, so it reads as a
              distinct detail block rather than loose text under the columns. */}
          <div className="mt-3 rounded-xl bg-surface-3 px-4 py-3 text-left">
            <p className="font-bold uppercase text-xs tracking-wide text-ink-muted mb-1">
              {t('requests.table.description')}
            </p>
            <p className={r.description ? 'text-ink text-base leading-relaxed' : 'text-ink-muted text-base italic'}>
              {r.description || t('requests.table.noDescription')}
            </p>
          </div>
        </div>
      );
    })}
  </div>
  );
};

// Web-Mercator tile math: for a lat/lng at a zoom level, which OSM tile holds
// it, and where inside that 256px tile does the point fall (as 0–1 fractions).
// Lets us drop a single static tile image with an accurately-placed pin — a
// real map picture of the request's location, no map library or API key.
const MAP_ZOOM = 13;
const tilePlacement = (lat, lng) => {
  const n = 2 ** MAP_ZOOM;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const xt = Math.floor(x);
  const yt = Math.floor(y);
  return {
    url: `https://tile.openstreetmap.org/${MAP_ZOOM}/${xt}/${yt}.png`,
    left: (x - xt) * 100, // pin position within the tile, as a percentage
    top: (y - yt) * 100,
  };
};

// The Location column: a static map thumbnail pinned to the request's exact
// coordinates when we have them, falling back to the location text (or a "not
// set" note) for requests that were never geocoded.
const LocationCell = ({ request }) => {
  const { t } = useTranslation();
  const lat = Number(request.latitude);
  const lng = Number(request.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const label = request.location || t('requests.table.location');

  if (!hasCoords) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-20 h-14 rounded-lg bg-surface-3 flex items-center justify-center">
          <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
        <span className="text-xs font-semibold uppercase text-ink-muted">
          {request.location || t('requests.table.noLocation')}
        </span>
      </div>
    );
  }

  const { url, left, top } = tilePlacement(lat, lng);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative w-20 h-14 rounded-lg overflow-hidden ring-1 ring-hairline"
        role="img"
        aria-label={
          request.location
            ? t('requests.table.mapAlt', { location: request.location })
            : t('requests.table.mapAltGeneric')
        }
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Coral map-pin marker at the request's exact point in the tile. */}
        <span
          className="absolute -translate-x-1/2 -translate-y-full drop-shadow"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <svg className="w-4 h-4 text-pin-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
          </svg>
        </span>
      </div>
      <span className="text-xs font-semibold uppercase text-ink-muted truncate max-w-[6rem]">
        {label}
      </span>
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
