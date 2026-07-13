// A single help-request card for the "My Requests" list.
// Color-codes the status badge per the Week 2 sprint plan.
const STATUS_STYLES = {
  pending:       'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  matched:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  fulfilled:     'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  closed:        'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// Urgency accent color (a small dot), so critical items stand out.
const URGENCY_DOT = {
  Low: 'bg-gray-400',
  Medium: 'bg-blue-500',
  High: 'bg-orange-500',
  Critical: 'bg-[#c84444]',
};

const RequestCard = ({ request }) => {
  const { category, urgency, location, description, status, createdAt } = request;

  const statusClass = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const dotClass = URGENCY_DOT[urgency] || 'bg-gray-400';
  const when = new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-5 transition-colors duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
          <h3 className="font-bold text-black dark:text-white">{category}</h3>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusClass}`}>
          {status}
        </span>
      </div>

      <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">{description}</p>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>📍 {location}</span>
        <span>{urgency} · {when}</span>
      </div>
    </div>
  );
};

export default RequestCard;
