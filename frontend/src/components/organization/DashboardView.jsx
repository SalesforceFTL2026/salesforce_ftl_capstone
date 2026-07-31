import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import RequestMap from '../map/RequestMap';

// Dashboard landing view for an organization. Styled to match the landing page,
// help-seeker, and volunteer dashboards: shared design tokens (surface/ink/
// hairline/forest/pin), the Alumni Sans display face on headings, soft card
// shadows, and the coral map-pin accent reserved for urgency and the primary CTA.
//
// The org's core jobs (PRODUCT.md): monitor incoming requests, prioritize
// crises, and allocate resources. So the left column previews the AI-ranked
// priority feed — the requests that need a response most — over the old filler
// line chart, and the right column pairs the real request map (where to deploy)
// with the org's own posted volunteer tasks.
//
// @param {object} [currentUser] - to greet the org by name
// @param {object} stats - { completedPct, peopleHelped, resourcesAvailable }
// @param {object[]} requests - open requests the org can browse (any status)
// @param {() => void} [onViewRequests] - jump to the full Requests view
// @param {{date: string, month: string, title: string}[]} tasks - posted tasks
const DashboardView = ({ currentUser, stats, requests = [], onViewRequests, tasks = [] }) => {
  const { t } = useTranslation();
  const orgName = currentUser?.name?.split(' ')[0] || 'org';

  // The few highest-priority open requests, so the org sees where a response is
  // needed most the moment they land. Sort by the AI priority score (desc); the
  // full, filterable feed lives one click away in the Requests view.
  const topRequests = useMemo(() => {
    return [...requests]
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 4);
  }, [requests]);

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(320px,420px)] gap-6">
      {/* ---- Left column: greeting, impact stats, top priority requests ---- */}
      <div className="bg-surface-2 dark:bg-surface-2 rounded-3xl p-6 sm:p-8 ring-1 ring-hairline shadow-card transition-colors duration-300">
        <h2 className="font-display text-4xl sm:text-5xl text-ink tracking-wide leading-none">
          {t('org.dashboard.greeting', { name: orgName })}
        </h2>

        {/* Impact stat pills — the org's own activity. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <StatPill value={stats.completedPct} label={t('org.dashboard.requestsCompleted')} />
          <StatPill value={stats.peopleHelped} label={t('org.dashboard.peopleHelped')} />
          <StatPill value={stats.resourcesAvailable} label={t('org.dashboard.resourcesAvailable')} />
        </div>

        {/* Top priority requests — the AI priority feed, previewed. */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h3 className="font-display text-2xl text-ink tracking-wide">
            {t('org.dashboard.topPriority')}
          </h3>
          {topRequests.length > 0 && onViewRequests && (
            <button
              type="button"
              onClick={onViewRequests}
              className="text-forest-700 dark:text-forest-300 text-xs font-bold uppercase tracking-wide hover:underline focus:outline-none focus:ring-2 focus:ring-forest-400/50 rounded"
            >
              {t('org.dashboard.viewAll')}
            </button>
          )}
        </div>
        <p className="text-ink-muted text-sm mb-4">
          {t('org.dashboard.topPrioritySubtitle')}
        </p>

        {topRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline p-6 text-center">
            <p className="text-ink font-semibold">{t('org.dashboard.noOpenRequests')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {topRequests.map((request) => (
              <PriorityRequestRow key={request.id} request={request} onView={onViewRequests} t={t} />
            ))}
          </ul>
        )}

        {/* Primary CTA — browse the full priority feed (the org's flow). */}
        {onViewRequests && (
          <div className="flex justify-center mt-8">
            <button
              type="button"
              onClick={onViewRequests}
              className="px-8 py-4 bg-pin-500 text-white font-bold rounded-full text-lg hover:bg-pin-600 focus:outline-none focus:ring-2 focus:ring-pin-500/40 transition-colors shadow-card"
            >
              {t('org.dashboard.browseAllRequests')}
            </button>
          </div>
        )}
      </div>

      {/* ---- Right column: data-driven request map + posted tasks ---- */}
      <div className="bg-forest-800 dark:bg-surface-2 rounded-3xl p-6 ring-1 ring-hairline shadow-card transition-colors duration-300">
        <h2 className="font-display text-2xl sm:text-3xl text-white dark:text-forest-300 text-center mb-4 tracking-wide">
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
          <RequestMap requests={requests} height="20rem" />
        </div>

        <div className="flex items-center justify-between mt-6 mb-2">
          <h3 className="font-display text-white tracking-wide text-lg">{t('org.dashboard.openTasks')}</h3>
        </div>
        <ul className="flex flex-col gap-3">
          {tasks.length === 0 && (
            <li className="text-white/90 text-sm">{t('org.dashboard.noOpenTasks')}</li>
          )}
          {tasks.map((task, i) => (
            <li
              key={i}
              className="flex items-center gap-4 bg-forest-900/60 dark:bg-surface-3 rounded-2xl p-3 text-white"
            >
              <div className="w-14 h-14 rounded-xl bg-forest-100 text-forest-900 flex flex-col items-center justify-center leading-none shrink-0">
                <span className="text-xl font-bold">{task.date}</span>
                <span className="text-xs font-semibold uppercase">{task.month}</span>
              </div>
              <span className="font-semibold text-lg">{task.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// One impact stat, styled as a quiet forest card with the number in the coral
// accent so the figure is what the eye lands on.
const StatPill = ({ value, label }) => (
  <div className="bg-forest-800 dark:bg-surface-3 rounded-2xl px-5 py-5 text-center text-white shadow-card">
    <p className="text-3xl font-bold text-pin-400">{value}</p>
    <p className="text-xs font-bold uppercase tracking-wide text-forest-100 dark:text-ink-muted mt-1">
      {label}
    </p>
  </div>
);

// One preview row for a top-priority request. Shows the category, an urgency
// badge, the AI priority score, and a one-line reasoning snippet — the core
// prioritization signals — and links into the full Requests view on click.
const PriorityRequestRow = ({ request, onView, t }) => {
  const typeLabel = request.category
    ? t(`requests.categories.${request.category}`, { defaultValue: request.category })
    : t('org.dashboard.requestFallback');
  const hasScore = typeof request.priorityScore === 'number' && request.priorityScore > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onView}
        className="w-full text-left bg-forest-800 dark:bg-surface-3 rounded-2xl px-4 py-3 text-white hover:bg-forest-700 dark:hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-forest-400/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg tracking-wide truncate">{typeLabel}</span>
          {hasScore && (
            <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-forest-100 text-forest-900 text-xs font-bold uppercase tracking-wide">
              {t('org.dashboard.priorityLabel')} {Math.round(request.priorityScore)}
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-2 mt-1">
          <UrgencyBadge urgency={request.urgency} t={t} />
          {request.location && (
            <span className="text-forest-100 text-xs truncate">{request.location}</span>
          )}
        </div>
        {request.reasoning && (
          <p className="text-forest-100 text-sm mt-2 line-clamp-2">{request.reasoning}</p>
        )}
      </button>
    </li>
  );
};

// Urgency badge — coral for the two urgent levels (the brand's one accent),
// quiet neutral for the rest. Renders nothing when urgency is unknown.
const UrgencyBadge = ({ urgency, t }) => {
  if (!urgency) return null;
  const urgent = urgency === 'Critical' || urgency === 'High';
  const cls = urgent ? 'bg-pin-500 text-white' : 'bg-white/15 text-forest-100';
  const label = t(`requests.urgencies.${urgency}`, { defaultValue: urgency });
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
};

export default DashboardView;
