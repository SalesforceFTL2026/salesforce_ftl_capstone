import { useState, useEffect, useCallback } from 'react';
import TabNav from '../components/TabNav/TabNav';
import RequestCard from '../components/RequestCard/RequestCard';
import {
  getPrioritizedRequests,
  getVolunteerInterests,
  expressInterest,
  requestErrorMessage,
} from '../utils/requests';

// The two tabs a volunteer sees. "feed" is the AI priority feed of open
// requests; "interests" is the list they've already offered to help with.
const TABS = [
  { id: 'feed', label: 'Priority Feed' },
  { id: 'interests', label: 'My Interests' },
];

const VolunteerDashboard = () => {
  const [activeTab, setActiveTab] = useState('feed');

  // Each tab loads its own list. We keep them separate so switching tabs
  // doesn't refetch or clobber the other tab's data.
  const [feed, setFeed] = useState([]);
  const [interests, setInterests] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tracks the request id currently being submitted, so we can show a loading
  // state on just that card's button.
  const [interactingId, setInteractingId] = useState(null);
  // Maps request id -> confirmation message after a successful interaction.
  const [confirmations, setConfirmations] = useState({});

  // Load whichever tab is active. Wrapped in useCallback so the effect below
  // has a stable dependency.
  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'feed') {
        setFeed(await getPrioritizedRequests());
      } else {
        setInterests(await getVolunteerInterests());
      }
    } catch (err) {
      setError(requestErrorMessage(err, 'Something went wrong loading this view.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadActiveTab();
  }, [loadActiveTab]);

  // Volunteer clicked "I can help with this" on a feed card.
  const handleInteract = async (request) => {
    setInteractingId(request.id);
    setError('');
    try {
      const result = await expressInterest(request.id);
      setConfirmations((prev) => ({
        ...prev,
        [request.id]: result.message || 'Interest recorded. Thanks for helping!',
      }));
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not record your interest. Please try again.'));
    } finally {
      setInteractingId(null);
    }
  };

  const activeList = activeTab === 'feed' ? feed : interests;
  const emptyMessage =
    activeTab === 'feed'
      ? 'No open requests right now. Check back soon.'
      : "You haven't offered to help with any requests yet. Head to the Priority Feed to get started.";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Volunteer Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Find people who need help and track the requests you've offered to
            support.
          </p>
        </header>

        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        <section
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="mt-6"
        >
          {loading && (
            <p className="text-gray-500" role="status">
              Loading…
            </p>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={loadActiveTab}
                className="mt-2 text-sm font-semibold underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && activeList.length === 0 && (
            <p className="text-gray-500">{emptyMessage}</p>
          )}

          {!loading && !error && activeList.length > 0 && (
            <div className="flex flex-col gap-4">
              {activeList.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  // Only the Priority Feed shows the help button.
                  onInteract={activeTab === 'feed' ? handleInteract : undefined}
                  interacting={interactingId === request.id}
                  confirmation={confirmations[request.id]}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default VolunteerDashboard;
