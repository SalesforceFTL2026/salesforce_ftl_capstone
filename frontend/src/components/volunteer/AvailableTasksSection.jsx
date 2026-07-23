// The "Available volunteer tasks" section on the volunteer Tasks tab. Lists the
// open, org-created tasks a volunteer can sign up for (each tied to a help
// request), with a Sign up / Withdraw button per card. This is separate from the
// requests-the-volunteer-offered-to-help-with list above it.
//
// @param {object[]} tasks - available tasks (each with request, organization,
//                           signedUp, hasRoom, and volunteer-count fields)
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(task) => void} onSignUp
// @param {(task) => void} onWithdraw
// @param {string|null} busyId - task id whose button is mid-request

// Parse the JSON-encoded skillsNeeded string into an array of names.
const parseSkills = (json) => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Format an ISO date for display (date only). Returns null when unset/invalid.
const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const AvailableTasksSection = ({
  tasks = [],
  loading,
  error,
  onRetry,
  onSignUp,
  onWithdraw,
  busyId,
}) => {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white text-center mb-1">
        Available volunteer tasks
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
        Tasks assigned to the help requests you registered for. Sign up for the
        ones best suited for your skillset.
      </p>

      {loading && (
        <p className="text-[#1C2A16] dark:text-gray-300" role="status">
          Loading…
        </p>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4">
          <p className="font-semibold">{error}</p>
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-semibold underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-[#7f9976] dark:bg-[#1f3320] rounded-3xl p-5 transition-colors duration-300">
          {tasks.length === 0 ? (
            <p className="text-white text-center py-8">
              No open tasks right now. Check back soon.
            </p>
          ) : (
            // Horizontal carousel: cards scroll sideways within the band.
            <ul className="flex gap-4 overflow-x-auto pb-1 snap-x">
              {tasks.map((task) => (
                <AvailableTaskCard
                  key={task.id}
                  task={task}
                  onSignUp={onSignUp}
                  onWithdraw={onWithdraw}
                  busy={busyId === task.id}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

// A single available task in card view.
const AvailableTaskCard = ({ task, onSignUp, onWithdraw, busy }) => {
  const skills = parseSkills(task.skillsNeeded);
  const scheduledDate = formatDate(task.volunteerDate);
  const orgName = task.organization?.organizationName || 'An organization';
  const spotsLeft =
    task.maxVolunteers != null
      ? Math.max(0, task.maxVolunteers - task.volunteersConfirmed)
      : null;

  return (
    <li className="bg-white dark:bg-[#16233a] rounded-2xl shadow-md p-5 flex flex-col shrink-0 w-[320px] snap-start">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-[#1C2A16] dark:text-white">{task.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {task.category || 'Uncategorized'} · {task.urgency} urgency
          </p>
        </div>
        {task.signedUp && (
          <span className="shrink-0 text-xs font-semibold uppercase px-3 py-1.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
            Signed up
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {task.description}
      </p>

      {/* Which help request + organization this task serves */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Posted by <span className="font-semibold">{orgName}</span>
        {task.request?.location ? ` · ${task.request.location}` : ''}
      </p>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {skills.map((s) => (
            <span
              key={s}
              className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#e3ecd9] text-[#3a4a30] dark:bg-[#2b3b22] dark:text-[#c3d4b0]"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 space-y-0.5">
        <p>
          <span className="font-semibold text-[#1C2A16] dark:text-white">
            {task.volunteersConfirmed}
          </span>{' '}
          / {task.minVolunteers} min
          {task.maxVolunteers != null ? ` · ${task.maxVolunteers} max` : ''}{' '}
          volunteers
          {spotsLeft != null && spotsLeft > 0 && !task.signedUp && (
            <span className="text-gray-500 dark:text-gray-400">
              {' '}
              ({spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left)
            </span>
          )}
        </p>
        {scheduledDate && (
          <p>
            Volunteer day:{' '}
            <span className="font-semibold text-[#1C2A16] dark:text-white">
              {scheduledDate}
            </span>
          </p>
        )}
      </div>

      {/* Sign up / Withdraw action, pinned to the bottom of the card */}
      <div className="mt-auto">
        {task.signedUp ? (
          <button
            type="button"
            onClick={() => onWithdraw(task)}
            disabled={busy}
            className="w-full px-4 py-2 rounded-xl border-2 border-[#c84444] text-[#c84444] font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-[#c84444]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Removing…' : 'Withdraw'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSignUp(task)}
            disabled={busy}
            className="w-full px-4 py-2 rounded-xl bg-[#1C2A16] dark:bg-[#7F9764] text-white font-semibold text-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#7F9764]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {busy ? 'Signing up…' : 'Sign up'}
          </button>
        )}
      </div>
    </li>
  );
};

export default AvailableTasksSection;
