import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// A full-details modal for a single help request, opened when a volunteer taps a
// row in the List view. It renders as a centered overlay that fits the screen —
// its height is capped at the viewport and the body scrolls when the content is
// tall — so long descriptions or AI reasoning never push it off-screen.
//
// Closing: the ✕ button, clicking the dimmed backdrop, or pressing Escape.
//
// @param {object|null} request - the request to show; when null the modal is
//   closed and nothing renders
// @param {() => void} onClose - called on any of the three close paths

const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const RequestDetailsModal = ({ request, onClose }) => {
  const { t } = useTranslation();

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!request) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request, onClose]);

  if (!request) return null;

  const {
    category, urgency, location, description, status, createdAt, reasoning,
    priorityScore, submitterName, requesterName, name, volunteerInterestCount,
    organizationRespondingCount, householdSize,
  } = request;

  const who = submitterName || requesterName || name || t('volunteer.requests.helpSeeker');
  const hasScore = typeof priorityScore === 'number' && priorityScore > 0;
  const urgencyTone = URGENCY_STYLES[urgency] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  const when = createdAt
    ? new Date(createdAt).toLocaleString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  // A single labeled field, shown only when it has a value.
  const Field = ({ label, value }) =>
    value === null || value === undefined || value === '' ? null : (
      <div>
        <dt className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className="mt-0.5 text-base text-[#1C2A16] dark:text-gray-100">{value}</dd>
      </div>
    );

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('volunteer.requests.detail.title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-[#16233a] rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header — pinned so the ✕ stays reachable while the body scrolls. */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-black/10 dark:border-white/10">
          <div>
            <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white">{who}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('volunteer.requests.detail.title')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('volunteer.requests.detail.close')}
            className="p-2 -mr-2 rounded-lg text-gray-500 hover:text-[#1C2A16] dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-5">
          {/* Badges: urgency, AI priority, status */}
          <div className="flex flex-wrap items-center gap-2">
            {urgency && (
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${urgencyTone}`}>{urgency}</span>
            )}
            {hasScore && (
              <span className="text-sm font-bold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {t('requests.card.priority', { score: Math.round(priorityScore) })}
              </span>
            )}
            {status && (
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full capitalize bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {status}
              </span>
            )}
          </div>

          {description && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('volunteer.requests.detail.description')}
              </dt>
              <dd className="mt-0.5 text-base text-[#1C2A16] dark:text-gray-100 whitespace-pre-wrap">{description}</dd>
            </div>
          )}

          {/* AI reasoning */}
          {reasoning && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
              <p className="text-sm font-semibold text-[#1C2A16] dark:text-white mb-1">
                {t('volunteer.requests.whyPrioritized')}
              </p>
              <p className="text-base text-gray-700 dark:text-gray-200">{reasoning}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4">
            <Field label={t('volunteer.requests.columns.category')} value={category} />
            <Field label={t('volunteer.requests.detail.location')} value={location} />
            <Field label={t('volunteer.requests.detail.submitted')} value={when} />
            {typeof householdSize === 'number' && householdSize > 0 && (
              <Field label={t('volunteer.requests.detail.householdSize')} value={householdSize} />
            )}
            {typeof volunteerInterestCount === 'number' && (
              <Field label={t('volunteer.requests.detail.volunteersInterested')} value={volunteerInterestCount} />
            )}
            {typeof organizationRespondingCount === 'number' && (
              <Field label={t('volunteer.requests.detail.orgsResponding')} value={organizationRespondingCount} />
            )}
          </dl>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;
