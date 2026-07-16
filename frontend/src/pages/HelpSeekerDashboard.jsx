import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import RequestCard from '../components/RequestCard/RequestCard';
import HelpRequestForm from '../../components/HelpRequestForm/HelpRequestForm';
import SafetyManual from '../components/SafetyManual/SafetyManual';
import api from '../utils/api';
import { getCurrentUser, logout } from '../utils/auth';

// Sidebar navigation from the wireframe. "Dashboard" and "Requests" switch the
// center view; the rest are placeholders for pages teammates will build and
// show a "coming soon" panel when selected.
const NAV_SECTIONS = [
  {
    heading: 'General',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'requests', label: 'Requests' },
      { id: 'household', label: 'Household' },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { id: 'chat', label: 'Chat' },
      { id: 'documents', label: 'Emergency Guide' },
      { id: 'settings', label: 'Settings' },
    ],
  },
];

// Views that are actually built. Anything else shows the "coming soon" panel.
const BUILT_VIEWS = new Set(['dashboard', 'requests', 'documents']);

// A request is "active" until it's been fulfilled or closed.
const ACTIVE_STATUSES = ['pending', 'in-progress', 'matched'];

// Placeholder data for the "Participating Non-Profits Near You" column. There
// is no backend endpoint for this yet, so these are clearly-labeled samples.
// Swap for a real GET once the API exists.
const SAMPLE_NONPROFITS = [
  { id: 1, name: 'Sample Relief Org', type: 'Food & supplies', distance: '1.2 mi away' },
  { id: 2, name: 'Sample Shelter Network', type: 'Emergency shelter', distance: '2.8 mi away' },
  { id: 3, name: 'Sample Health Alliance', type: 'Medical aid', distance: '3.5 mi away' },
  { id: 4, name: 'Sample Community Fund', type: 'Financial assistance', distance: '4.0 mi away' },
];

// Help-Seeker Dashboard. Matches the project wireframe: a left sidebar, a
// center column with the user's help requests + a "Make New Request" action,
// a profile card, and a right column of nearby participating non-profits.
const HelpSeekerDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tracks the request id currently being deleted, to disable just that card.
  const [deletingId, setDeletingId] = useState(null);
  // Controls the "Make New Request" modal.
  const [showForm, setShowForm] = useState(false);
  // Which sidebar view is selected.
  const [activeView, setActiveView] = useState('dashboard');
  // Who is signed in, so we can greet them and show their profile.
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Load the logged-in user's requests. useCallback so the form's onCreated
  // can re-run it after a new submission.
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/requests/my-requests');
      setRequests(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Delete a request, then drop it from the list without a full refetch.
  const handleDelete = async (request) => {
    setDeletingId(request.id);
    setError('');
    try {
      await api.delete(`/api/requests/${request.id}`);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete that request.');
    } finally {
      setDeletingId(null);
    }
  };

  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const activeRequests = requests.filter((r) => ACTIVE_STATUSES.includes(r.status));

  // Renders a request list with shared loading / error / empty handling, so
  // the Dashboard and Requests views stay consistent.
  const renderRequestList = (list, emptyText) => {
    if (loading) {
      return <p className="text-gray-500 dark:text-gray-400">Loading your requests…</p>;
    }
    if (error) {
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="bg-white dark:bg-[#273A20] rounded-2xl p-8 text-center transition-colors duration-300">
          <p className="text-gray-600 dark:text-gray-300">{emptyText}</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {list.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            onDelete={handleDelete}
            deleting={deletingId === r.id}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f6f1] dark:bg-[#0f1a0f] transition-colors duration-300">
      <Header currentUser={currentUser} onSignOutClick={handleLogout} />

      <div className="pt-[90px] pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left sidebar ─────────────────────────────────────────── */}
          <aside className="lg:col-span-3 xl:col-span-2">
            <div className="bg-[#9db08c] dark:bg-[#1f2d18] rounded-2xl p-5 lg:sticky lg:top-[90px] lg:min-h-[calc(100vh-90px-2.5rem)]">
              <p className="text-lg font-bold text-[#1C2A16] dark:text-white mb-6 uppercase tracking-wide">
                Help Seeker
              </p>
              {NAV_SECTIONS.map((section) => (
                <div key={section.heading} className="mb-6 last:mb-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#1C2A16]/60 dark:text-gray-400 mb-2">
                    {section.heading}
                  </p>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = activeView === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setActiveView(item.id)}
                            className={`w-full text-left px-4 py-2 rounded-xl font-semibold transition-colors ${
                              isActive
                                ? 'bg-[#79A7ED] text-[#1C2A16]'
                                : 'text-[#1C2A16]/70 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/10'
                            }`}
                          >
                            {item.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* ── Content region ───────────────────────────────────────── */}
          <div className="lg:col-span-9 xl:col-span-10 min-w-0">
            {/* Placeholder views for sections that aren't built yet. */}
            {!BUILT_VIEWS.has(activeView) && (
              <div className="bg-white dark:bg-[#273A20] rounded-2xl p-12 text-center transition-colors duration-300">
                <h1 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2 capitalize">
                  {activeView}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  This section is coming soon.
                </p>
              </div>
            )}

            {/* Requests view: just the user's active requests. */}
            {activeView === 'requests' && (
              <div>
                <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
                  Active Requests
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Requests that are still open and awaiting help.
                </p>
                {renderRequestList(
                  activeRequests,
                  'You have no active requests right now.'
                )}
              </div>
            )}

            {/* Documents view: the help-seeker safety manual. */}
            {activeView === 'documents' && <SafetyManual />}

            {/* Dashboard view: requests + profile + nearby non-profits. */}
            {activeView === 'dashboard' && (
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Center column */}
                <div className="xl:col-span-3 min-w-0">
                  <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-6">
                    Hello, {firstName}!
                  </h1>

                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
                    Help Requests
                  </h2>

                  {renderRequestList(
                    requests,
                    "You haven't submitted any requests yet."
                  )}

                  {/* Make New Request */}
                  <div className="flex justify-center my-6">
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="px-10 py-4 bg-[#1e3a5f] text-white font-bold rounded-full text-lg hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 transition-colors shadow-md"
                    >
                      Make New Request
                    </button>
                  </div>

                  {/* Profile card. Name comes from the session; phone number and
                      household size aren't in the data model yet, so they show
                      as placeholders until those fields exist. */}
                  <div className="bg-[#6ba3d3] dark:bg-[#1a3a52] rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center text-[#1e3a5f] text-2xl font-bold shrink-0">
                        {(currentUser?.name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 space-y-2 text-sm min-w-0">
                        <div className="flex justify-between gap-4">
                          <span className="font-bold uppercase tracking-wide">Name</span>
                          <span className="truncate">{currentUser?.name || '—'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="font-bold uppercase tracking-wide">Phone Number</span>
                          <span className="text-white/70 italic">Not set yet</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="font-bold uppercase tracking-wide"># In Household</span>
                          <span className="text-white/70 italic">Not set yet</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column: participating non-profits */}
                <aside className="xl:col-span-2 min-w-0">
                  <div className="bg-[#6ba3d3] dark:bg-[#1a3a52] rounded-2xl p-6 xl:sticky xl:top-[90px] xl:min-h-[calc(100vh-90px-2.5rem)]">
                    <h2 className="text-xl font-bold text-white text-center mb-5">
                      Participating Non-Profits Near You
                    </h2>
                    <div className="space-y-4">
                      {SAMPLE_NONPROFITS.map((org) => (
                        <div
                          key={org.id}
                          className="flex items-center gap-4 bg-white/95 dark:bg-[#273A20] rounded-xl p-4"
                        >
                          <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500 text-center shrink-0">
                            LOGO
                          </div>
                          <div className="text-sm min-w-0">
                            <p className="font-bold text-[#1C2A16] dark:text-white truncate">{org.name}</p>
                            <p className="text-gray-600 dark:text-gray-300 truncate">{org.type}</p>
                            <p className="text-gray-400 dark:text-gray-500">{org.distance}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-white/70 text-xs text-center mt-4 italic">
                      Sample organizations — live listings coming soon.
                    </p>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />

      {/* ── Make New Request modal ─────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg relative">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              aria-label="Close"
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-600 hover:text-gray-900 shadow-md text-2xl leading-none"
            >
              ×
            </button>
            <HelpRequestForm
              compact
              onCreated={() => {
                loadRequests();
                setShowForm(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSeekerDashboard;
