// A single help-request card, reused by both dashboard tabs.
//
// In the "Priority Feed" tab it shows an "I can help with this" button.
// In the "My Interests" tab it shows the volunteer's response status instead.
//
// @param {object} request - request object from the API
// @param {(request) => void} [onInteract] - called when the help button is
//   clicked; if omitted, the button is hidden (e.g. on the My Interests tab)
// @param {boolean} [interacting] - true while this card's interact call is in
//   flight, so the button can show a loading state and stay disabled
// @param {string} [confirmation] - a short confirmation message to show after
//   a successful interaction on this card

// Map urgency to a badge color. Falls back to neutral for unknown values.
const URGENCY_STYLES = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',
};

const RequestCard = ({ request, onInteract, interacting, confirmation }) => {
  const urgencyStyle = URGENCY_STYLES[request.urgency] || 'bg-gray-100 text-gray-800';

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-block text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {request.category}
          </span>
          <p className="text-sm text-gray-500 mt-1">{request.location}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${urgencyStyle}`}
        >
          {request.urgency}
        </span>
      </div>

      <p className="text-gray-800 leading-relaxed">{request.description}</p>

      {/* AI reasoning, only shown when the prioritizer has explained the score */}
      {request.reasoning && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100">
          <span className="font-semibold">Why this is prioritized: </span>
          {request.reasoning}
        </p>
      )}

      {/* On the My Interests tab, show the volunteer's response status. */}
      {request.responseStatus && (
        <p className="text-sm font-medium text-[#6ba3d3]">
          Status: {request.responseStatus}
        </p>
      )}

      {/* On the Priority Feed tab, show the "I can help" button. */}
      {onInteract && (
        <div className="mt-auto">
          {confirmation ? (
            <p
              className="text-sm font-semibold text-green-700"
              role="status"
            >
              {confirmation}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onInteract(request)}
              disabled={interacting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#6ba3d3] text-white font-semibold hover:bg-[#5a92c2] focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
