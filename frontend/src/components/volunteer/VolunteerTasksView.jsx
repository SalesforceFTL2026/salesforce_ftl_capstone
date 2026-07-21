import RequestCard from '../RequestCard/RequestCard';

// Tasks view for a volunteer: the help requests they've signed up for. Each
// card has an "Un-sign up" button so the volunteer can withdraw. Reads from the
// same `interests` data as the dashboard (responses where they're the volunteer).
//
// @param {object[]} interests - requests the volunteer has signed up for
// @param {boolean} loading
// @param {string} error
// @param {() => void} onRetry
// @param {(request) => void} onWithdraw - withdraw interest in a request
// @param {string|null} withdrawingId - request id currently being withdrawn
// @param {(request) => void} onMarkHelped - mark a signed-up request as helped
// @param {string|null} markingId - request id currently being marked as helped
const VolunteerTasksView = ({ interests, loading, error, onRetry, onWithdraw, withdrawingId, onMarkHelped, markingId }) => {
  if (loading) {
    return <p className="text-[#1C2A16] dark:text-gray-300" role="status">Loading…</p>;
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4">
        <p className="font-semibold">{error}</p>
        <button onClick={onRetry} className="mt-2 text-sm font-semibold underline hover:no-underline">
          Try again
        </button>
      </div>
    );
  }
  if (interests.length === 0) {
    return (
      <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
        <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">
          No tasks yet
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Head to Requests to sign up for people who need help.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {interests.map((request) => {
        const isCompleted =
          request.status === 'completed' || request.responseStatus === 'completed';
        return (
          <div key={request.id} className="flex flex-col gap-2">
            <RequestCard request={request} />
            <div className="flex justify-end gap-2">
              {isCompleted ? (
                <span className="px-4 py-2 font-semibold text-sm text-green-700 dark:text-green-400" role="status">
                  ✓ Helped
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onMarkHelped(request)}
                  disabled={markingId === request.id}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {markingId === request.id ? 'Saving…' : 'Mark as helped'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onWithdraw(request)}
                disabled={withdrawingId === request.id}
                className="px-4 py-2 rounded-xl border-2 border-[#c84444] text-[#c84444] font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-[#c84444]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {withdrawingId === request.id ? 'Removing…' : 'Un-sign up'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VolunteerTasksView;
