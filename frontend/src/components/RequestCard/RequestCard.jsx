// A single help-request card, reused by both dashboards.
//
// Help-seeker "My Requests" list: pass only `request` (with `status` +
//   `createdAt`); the card color-codes a status badge.
// Volunteer "Priority Feed": pass `onInteract` to show the "I can help"
//   button; "My Interests" shows `request.responseStatus` instead.
//
// @param {object} request - request object from the API
// @param {(request) => void} [onInteract] - called when the help button is
//   clicked; if omitted, the button is hidden (e.g. on the My Interests tab)
// @param {boolean} [interacting] - true while this card's interact call is in
//   flight, so the button can show a loading state and stay disabled
// @param {string} [confirmation] - a short confirmation message to show after
//   a successful interaction on this card
// @param {(request) => void} [onDelete] - called when the delete (trash) button
//   is clicked; if omitted, the button is hidden (e.g. on the volunteer views)
// @param {boolean} [deleting] - true while this card's delete call is in flight
// @param {(request) => void} [onEdit] - called when the edit (pencil) button is
//   clicked; if omitted, the button is hidden (e.g. on the volunteer views)
//
// Organization dashboard: pass `onStatusChange` to show a status dropdown so an
//   org can move a request through its lifecycle. `updating` disables it while
//   the change is in flight. Interaction counts (volunteerInterestCount /
//   organizationRespondingCount) are shown automatically when present.

// The lifecycle states an organization can move a request through. Mirrors the
// backend's validStatuses in updateRequestStatus.
const STATUS_OPTIONS = ['pending', 'assigned', 'in-progress', 'matched', 'completed', 'fulfilled', 'closed'];

// Status badge colors for the help-seeker list.
const STATUS_STYLES = {
  pending:       'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  assigned:      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  matched:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  completed:     'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  fulfilled:     'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  closed:        'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// Urgency badge colors (used when there's no status to show).
const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

// Urgency accent dot, so critical items stand out.
const URGENCY_DOT = {
  Low: 'bg-gray-400',
  Medium: 'bg-blue-500',
  High: 'bg-orange-500',
  Critical: 'bg-[#c84444]',
};

// Color the priority score by how urgent the AI ranked it, so the highest
// scores read as the most pressing at a glance.
const priorityScoreClass = (score) => {
  if (score >= 80) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (score >= 60) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

const RequestCard = ({ request, onInteract, interacting, confirmation, onDelete, deleting, onEdit, onStatusChange, updating, onMarkHelped, marking }) => {
  const {
    category, urgency, location, description, status, createdAt, reasoning,
    responseStatus, priorityScore, volunteerInterestCount, organizationRespondingCount,
  } = request;

  // Only show the AI priority score once the request has actually been scored
  // (score > 0). Help-seeker "My Requests" cards stay unscored and hide it.
  const hasPriorityScore = typeof priorityScore === 'number' && priorityScore > 0;

  const dotClass = URGENCY_DOT[urgency] || 'bg-gray-400';
  // Help-seeker cards carry a status; volunteer cards fall back to urgency.
  const badgeClass = status
    ? (STATUS_STYLES[status] || STATUS_STYLES.pending)
    : (URGENCY_STYLES[urgency] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300');
  const when = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <article className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-5 flex flex-col gap-4 transition-colors duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${dotClass}`} aria-hidden="true" />
          <h3 className="font-bold text-xl text-black dark:text-white">{category}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* AI priority score — the headline signal on the volunteer feed. */}
          {hasPriorityScore && (
            <span
              className={`text-sm font-bold px-3 py-1.5 rounded-full ${priorityScoreClass(priorityScore)}`}
              title="AI-calculated priority score (0–100)"
            >
              Priority {Math.round(priorityScore)}
            </span>
          )}
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full capitalize ${badgeClass}`}>
            {status || urgency}
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(request)}
              disabled={deleting}
              aria-label="Edit request"
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#6ba3d3] hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(request)}
              disabled={deleting}
              aria-label="Delete request"
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#c84444] hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-700 dark:text-gray-300 text-base">{description}</p>

      {/* AI reasoning, only shown when the prioritizer has explained the score */}
      {reasoning && (
        <p className="text-base text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
          <span className="font-semibold">Why this is prioritized: </span>
          {reasoning}
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>📍 {location}</span>
        {when && <span>{urgency} · {when}</span>}
      </div>

      {/* Interaction counts — how much attention a request has already drawn.
          Helps organizations spot needs that still have no coverage. */}
      {(typeof volunteerInterestCount === 'number' ||
        typeof organizationRespondingCount === 'number') && (
        <div className="flex flex-wrap gap-2 text-sm">
          {typeof volunteerInterestCount === 'number' && (
            <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
              🙋 {volunteerInterestCount} volunteer{volunteerInterestCount === 1 ? '' : 's'} interested
            </span>
          )}
          {typeof organizationRespondingCount === 'number' && (
            <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">
              🏢 {organizationRespondingCount} org{organizationRespondingCount === 1 ? '' : 's'} responding
            </span>
          )}
        </div>
      )}

      {/* Organization control: move a request through its lifecycle. */}
      {onStatusChange && (
        <div className="mt-auto flex items-center gap-2">
          <label
            htmlFor={`status-${request.id}`}
            className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Status
          </label>
          <select
            id={`status-${request.id}`}
            value={status || 'pending'}
            disabled={updating}
            onChange={(e) => onStatusChange(request, e.target.value)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 capitalize"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {updating && (
            <span className="text-xs text-gray-500 dark:text-gray-400" role="status">
              Saving…
            </span>
          )}
        </div>
      )}

      {/* On the My Interests tab, show the volunteer's response status. */}
      {responseStatus && (
        <p className="text-base font-medium text-[#6ba3d3]">
          Status: {responseStatus}
        </p>
      )}

      {/* On the My Interests tab, let the volunteer mark a claimed request as
          helped — unless it's already been completed. */}
      {onMarkHelped && (
        <div className="mt-auto">
          {status === 'completed' || responseStatus === 'completed' ? (
            <p className="text-base font-semibold text-green-700 dark:text-green-400" role="status">
              ✓ Helped
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onMarkHelped(request)}
              disabled={marking}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-green-600 text-white font-semibold text-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {marking ? 'Saving…' : 'Mark as helped'}
            </button>
          )}
        </div>
      )}

      {/* On the Priority Feed tab, show the "I can help" button. */}
      {onInteract && (
        <div className="mt-auto">
          {confirmation ? (
            <p className="text-base font-semibold text-green-700" role="status">
              {confirmation}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onInteract(request)}
              disabled={interacting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#6ba3d3] text-white font-semibold text-lg hover:bg-[#5a92c2] focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {interacting ? 'Saving…' : 'I can help with this'}
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default RequestCard;
