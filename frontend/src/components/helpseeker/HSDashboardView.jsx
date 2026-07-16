// Help-seeker dashboard view, matching the wireframe: greeting + a list of the
// user's help requests (dated chips, expand, delete), a "Make New Request"
// button, a profile card, and a right column of nearby participating
// non-profits.
//
// @param {object} currentUser
// @param {object[]} requests - the user's requests
// @param {boolean} loading
// @param {string} error
// @param {string|null} deletingId
// @param {(request) => void} onDelete
// @param {() => void} onNewRequest
// @param {object[]} nonprofits - sample nearby orgs

const HSDashboardView = ({
  currentUser, requests, loading, error, deletingId, onDelete, onNewRequest, nonprofits,
}) => {
  const firstName = currentUser?.name?.split(' ')[0] || 'Name';

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(300px,400px)] gap-6">
      {/* Left column */}
      <div className="bg-[#dce8f7] dark:bg-[#16233a] rounded-3xl p-6 sm:p-8 transition-colors duration-300">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
          Hello, {firstName}!
        </h2>
        <h3 className="text-lg font-bold text-[#1C2A16] dark:text-white mt-4">Help Requests</h3>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 text-[10px] font-semibold uppercase tracking-wide text-[#3a4a30] dark:text-gray-400 mb-2 px-1">
          <span>Expected Fulfillment</span>
          <span>Type of Request</span>
        </div>

        {loading && <p className="text-gray-500 dark:text-gray-400" role="status">Loading your requests…</p>}
        {!loading && error && <p className="text-red-700 dark:text-red-300">{error}</p>}
        {!loading && !error && requests.length === 0 && (
          <p className="text-gray-600 dark:text-gray-300">You haven't submitted any requests yet.</p>
        )}

        {!loading && !error && requests.length > 0 && (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                deleting={deletingId === r.id}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}

        {/* Make New Request */}
        <div className="flex justify-center my-8">
          <button
            type="button"
            onClick={onNewRequest}
            className="px-12 py-4 bg-[#1a2740] text-white font-bold rounded-full text-lg hover:bg-[#14203a] focus:outline-none focus:ring-2 focus:ring-[#1a2740]/40 transition-colors shadow-md"
          >
            Make New Request
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-[#5b8bb0] dark:bg-[#1a3a52] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center gap-2">
              <span className="font-bold uppercase text-sm">Profile</span>
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center text-[#1a2740] text-xl font-bold">
                {(currentUser?.name?.[0] || '?').toUpperCase()}
              </div>
            </div>
            <div className="flex-1 space-y-2 text-sm min-w-0">
              <ProfileField label="Name" value={currentUser?.name} />
              <ProfileField label="Phone Number" placeholder="Not set yet" />
              <ProfileField label="# in Household" placeholder="Not set yet" />
            </div>
            <button className="self-end bg-[#c9d6a0] text-[#1C2A16] text-xs font-bold uppercase px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Right column: participating non-profits */}
      <div className="bg-[#5b8bb0] dark:bg-[#16233a] rounded-3xl p-6 transition-colors duration-300">
        <h2 className="text-2xl font-bold text-white text-center mb-6 leading-tight">
          Participating Non-Profits Near You
        </h2>
        <div className="space-y-4">
          {nonprofits.map((org) => (
            <div key={org.id} className="flex items-stretch gap-3">
              <div className="w-24 shrink-0 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500 text-center px-1">
                Organization Logo
              </div>
              <div className="flex-1 bg-[#bcd4f1] dark:bg-[#22304a] rounded-xl p-3 text-[#1C2A16] dark:text-gray-100 text-sm min-w-0">
                <p className="font-bold truncate">{org.name}</p>
                <p className="truncate">{org.type}</p>
                <p className="text-[#3a4a30] dark:text-gray-400">{org.distance}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-white/70 text-xs text-center mt-4 italic">
          Sample organizations — live listings coming soon.
        </p>
      </div>
    </div>
  );
};

// One dated request row with expand + delete, styled like the maroon pills.
const RequestRow = ({ request, deleting, onDelete }) => {
  const d = request.createdAt ? new Date(request.createdAt) : null;
  const day = d ? d.getDate() : '—';
  const month = d ? d.toLocaleString(undefined, { month: 'short' }) : '';
  return (
    <li className="flex items-center gap-3">
      <div className="flex-1 flex items-center gap-4 bg-[#7a2e2e] rounded-2xl px-4 py-3 text-white">
        <div className="w-14 h-14 rounded-xl bg-[#efe9dd] text-[#1C2A16] flex flex-col items-center justify-center leading-none shrink-0">
          <span className="text-lg font-bold">{day}</span>
          <span className="text-[10px] font-semibold uppercase">{month}</span>
        </div>
        <span className="flex-1 font-bold uppercase truncate">
          {request.category || 'Request'} Request
        </span>
        <span className="text-sm font-semibold uppercase opacity-80">Expand</span>
      </div>
      <button
        type="button"
        onClick={() => onDelete(request)}
        disabled={deleting}
        aria-label="Delete request"
        className="w-10 h-10 flex items-center justify-center text-[#1C2A16] dark:text-gray-200 hover:text-red-600 disabled:opacity-50 transition-colors"
      >
        {deleting ? (
          <span className="text-xs">…</span>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        )}
      </button>
    </li>
  );
};

const ProfileField = ({ label, value, placeholder }) => (
  <div className="flex items-center gap-3">
    <span className="font-bold uppercase text-xs w-28 shrink-0">{label}</span>
    {value ? (
      <span className="flex-1 bg-white/30 rounded px-2 py-1 truncate">{value}</span>
    ) : (
      <span className="flex-1 bg-white/30 rounded px-2 py-1 text-white/70 italic">{placeholder}</span>
    )}
  </div>
);

export default HSDashboardView;
