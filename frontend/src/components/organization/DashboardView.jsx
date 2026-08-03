import { useTranslation } from 'react-i18next';
import RequestMap from '../map/RequestMap';

// Dashboard landing view for an organization. Styled to match the landing page,
// help-seeker, and volunteer dashboards: shared design tokens (surface/ink/
// hairline/forest/pin), the Alumni Sans display face on headings, soft card
// shadows, and the coral map-pin accent reserved for urgency and the primary CTA.
//
// The org's core jobs (PRODUCT.md): monitor incoming requests, prioritize
// crises, and allocate resources efficiently. So the metrics are framed the way
// an org actually reasons about progress — not bare tallies but "X of Y, we're
// P% there" — and a coverage panel answers the org's real question: of all the
// places with active needs, how many are being handled and how many still need
// attention? The right column pairs the request map (where to deploy) with the
// org's own posted volunteer tasks.
//
// @param {object} [currentUser] - to greet the org by name
// @param {object} stats - progress metrics, each { done, total, pct }:
//   { resolved, peopleReached, resources }
// @param {object} locations - { list: {name, requests, handled, people}[],
//   total, covered, needAttention } — coverage across disaster locations
// @param {object[]} requests - open requests the org can browse (for the map)
// @param {() => void} [onViewRequests] - jump to the full Requests view
// @param {{date: string, month: string, title: string}[]} tasks - posted tasks
const DashboardView = ({
  currentUser, stats, locations = { list: [], total: 0, covered: 0, needAttention: 0 },
  requests = [], onViewRequests, tasks = [],
}) => {
  const { t } = useTranslation();
  const orgName = currentUser?.name?.split(' ')[0] || 'org';

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(320px,420px)] gap-6">
      {/* ---- Left column: greeting, progress metrics, location coverage ---- */}
      <div className="bg-surface-2 dark:bg-surface-2 rounded-3xl p-5 sm:p-6 ring-1 ring-hairline shadow-card transition-colors duration-300">
        <h2 className="font-display text-4xl sm:text-5xl text-ink tracking-wide leading-none">
          {t('org.dashboard.greeting', { name: orgName })}
        </h2>

        {/* Progress metrics — each shows how far along we are toward the goal,
            not just a bare count, so the number reads with context. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <ProgressStat
            metric={stats.resolved}
            label={t('org.dashboard.requestsResolved')}
            caption={t('org.dashboard.resolvedCaption', { pct: stats.resolved.pct })}
          />
          <ProgressStat
            metric={stats.peopleReached}
            label={t('org.dashboard.peopleReached')}
            caption={t('org.dashboard.peopleReachedCaption', { pct: stats.peopleReached.pct })}
          />
          <ProgressStat
            metric={stats.resources}
            label={t('org.dashboard.resourcesReady')}
            caption={t('org.dashboard.resourcesCaption', { pct: stats.resources.pct })}
          />
        </div>

        {/* Location coverage — the org's "where are we staffed / where do we
            still need to respond?" view across every active disaster location. */}
        <div className="flex items-center justify-between mt-5 mb-1">
          <h3 className="font-display text-2xl text-ink tracking-wide">
            {t('org.dashboard.coverageTitle')}
          </h3>
          {locations.list.length > 0 && onViewRequests && (
            <button
              type="button"
              onClick={onViewRequests}
              className="text-forest-700 dark:text-forest-300 text-sm font-bold uppercase tracking-wide hover:underline focus:outline-none focus:ring-2 focus:ring-forest-400/50 rounded"
            >
              {t('org.dashboard.viewAll')}
            </button>
          )}
        </div>
        <p className="text-ink-muted text-base mb-4">
          {t('org.dashboard.coverageSummary', {
            total: locations.total,
            covered: locations.covered,
            needAttention: locations.needAttention,
          })}
        </p>

        {locations.list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline p-6 text-center">
            <p className="text-ink font-semibold">{t('org.dashboard.noOpenRequests')}</p>
          </div>
        ) : (
          /* Show every active disaster location, sized to reveal about one at a
             time so the rest scroll into view — the org can scan the full list
             without the panel growing unbounded. pr-1 keeps the scrollbar off
             the cards. */
          <ul className="flex flex-col gap-3 max-h-[9.5rem] overflow-y-auto pr-1">
            {locations.list.map((loc) => (
              <LocationCoverageRow key={loc.name} location={loc} onView={onViewRequests} t={t} />
            ))}
          </ul>
        )}

        {/* Primary CTA — browse the full priority feed (the org's flow). */}
        {onViewRequests && (
          <div className="flex justify-center mt-5">
            <button
              type="button"
              onClick={onViewRequests}
              className="px-7 py-3 bg-pin-500 text-white font-bold rounded-full text-base hover:bg-pin-600 focus:outline-none focus:ring-2 focus:ring-pin-500/40 transition-colors shadow-card"
            >
              {t('org.dashboard.browseAllRequests')}
            </button>
          </div>
        )}
      </div>

      {/* ---- Right column: data-driven request map + posted tasks ---- */}
      <div className="bg-forest-800 dark:bg-surface-2 rounded-3xl p-5 ring-1 ring-hairline shadow-card transition-colors duration-300">
        <h2 className="font-display text-2xl sm:text-3xl text-white dark:text-forest-300 text-center mb-3 tracking-wide">
          {t('org.dashboard.whereHelpNeeded')}
        </h2>
        {/* The real interactive request map — geocoded requests drop urgency
            pins, and the Heatmap toggle renders the county-level choropleth so
            the org sees where demand actually clusters.

            RequestMap styles its own toggle/legend text for a light card (it's
            shared with the Requests view). This panel's background is deep
            forest green, so we seat the map in a light inset — otherwise those
            dark controls would be dark-on-dark and fail contrast. */}
        <div className="bg-white dark:bg-surface-3 rounded-2xl p-3">
          <RequestMap requests={requests} height="15rem" />
        </div>

        <div className="flex items-center justify-between mt-4 mb-2">
          <h3 className="font-display text-white tracking-wide text-lg">{t('org.dashboard.openTasks')}</h3>
        </div>
        {/* Show about two tasks at a time and scroll the rest, so a long list
            doesn't stretch the panel. pr-1 keeps the scrollbar off the cards. */}
        <ul className="flex flex-col gap-3 max-h-[11rem] overflow-y-auto pr-1">
          {tasks.length === 0 && (
            <li className="text-white/90 text-base">{t('org.dashboard.noOpenTasks')}</li>
          )}
          {tasks.map((task, i) => (
            <li
              key={i}
              className="flex items-center gap-4 bg-forest-900/60 dark:bg-surface-3 rounded-2xl p-3 text-white"
            >
              <div className="w-14 h-14 rounded-xl bg-forest-100 text-forest-900 flex flex-col items-center justify-center leading-none shrink-0">
                <span className="text-xl font-bold">{task.date}</span>
                <span className="text-sm font-semibold uppercase">{task.month}</span>
              </div>
              <span className="font-semibold text-lg">{task.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// One progress metric, styled as a quiet forest card. Instead of a lone number
// it shows "done / total", the big coral percentage the eye lands on, a slim
// progress bar, and a one-line caption — so the figure reads as "how far toward
// the goal are we?" rather than a bare tally. total = 0 shows a friendly "—".
const ProgressStat = ({ metric, label, caption }) => {
  const { done, total, pct } = metric;
  const hasData = total > 0;
  return (
    <div className="bg-forest-800 dark:bg-surface-3 rounded-2xl px-5 py-5 text-white shadow-card">
      <p className="text-sm font-bold uppercase tracking-wide text-forest-100 dark:text-ink-muted">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-pin-400">{hasData ? `${pct}%` : '—'}</span>
        <span className="text-base font-semibold text-forest-100">{done} / {total}</span>
      </p>
      {/* Progress bar toward the goal (100% = every item handled). */}
      <div className="mt-3 h-1.5 rounded-full bg-forest-900/60 dark:bg-black/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-pin-500 transition-all duration-500"
          style={{ width: `${hasData ? pct : 0}%` }}
        />
      </div>
      <p className="text-xs text-forest-100 mt-2 leading-snug">{caption}</p>
    </div>
  );
};

// One disaster location's coverage. Shows how many people need help there and
// how much of the location is being handled (staffed) — a slim bar plus a
// status chip: fully covered vs. still needs attention. Links into Requests.
const LocationCoverageRow = ({ location, onView, t }) => {
  const { name, requests, handled, people } = location;
  const pct = requests ? Math.round((handled / requests) * 100) : 0;
  const covered = requests > 0 && handled === requests;

  return (
    <li>
      <button
        type="button"
        onClick={onView}
        className="w-full text-left bg-forest-800 dark:bg-surface-3 rounded-2xl px-4 py-3 text-white hover:bg-forest-700 dark:hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-forest-400/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg tracking-wide truncate">{name}</span>
          <span
            className={`shrink-0 px-2.5 py-0.5 rounded-full text-sm font-bold uppercase tracking-wide ${
              covered ? 'bg-forest-100 text-forest-900' : 'bg-pin-500 text-white'
            }`}
          >
            {covered ? t('org.dashboard.covered') : t('org.dashboard.needsAttention')}
          </span>
        </div>
        <p className="text-forest-100 text-base mt-1">
          {t('org.dashboard.locationNeed', { people })}
        </p>
        {/* Coverage bar — how many of this location's requests are being handled. */}
        <div className="mt-2 h-1.5 rounded-full bg-forest-900/60 dark:bg-black/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-pin-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-forest-100 mt-1">
          {t('org.dashboard.locationHandled', { handled, requests })}
        </p>
      </button>
    </li>
  );
};

export default DashboardView;
