import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import RequestCard from '../components/RequestCard/RequestCard';
import HelpRequestForm from '../../components/HelpRequestForm/HelpRequestForm';
import SafetyManual from '../components/SafetyManual/SafetyManual';
import ChatAssistant from '../components/ChatAssistant/ChatAssistant';
import api from '../utils/api';
import { getCurrentUser, logout, updateName } from '../utils/auth';

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
      { id: 'documents', label: 'Emergency Guide' },
      { id: 'settings', label: 'Settings' },
    ],
  },
];

// Views that are actually built. Anything else shows the "coming soon" panel.
const BUILT_VIEWS = new Set(['dashboard', 'requests', 'household', 'documents', 'settings']);

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
  // When set, the modal shows the form in edit mode for this request.
  const [editingRequest, setEditingRequest] = useState(null);
  // Controls the AI chat assistant panel (opened from the inline button).
  const [chatOpen, setChatOpen] = useState(false);
  // Which sidebar view is selected.
  const [activeView, setActiveView] = useState('dashboard');
  // Who is signed in, so we can greet them and show their profile. Stateful so
  // the greeting/profile update live when the user edits their name in Settings.
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  // Settings form: the editable name, plus save state and feedback messages.
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Save the edited display name, then update the live session so the greeting
  // and profile card reflect it immediately.
  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    setNameError('');
    setNameSaved(false);

    if (!trimmed) {
      setNameError('Name must not be empty.');
      return;
    }
    if (trimmed === currentUser?.name) {
      return; // nothing changed
    }

    setSavingName(true);
    try {
      const updated = await updateName(trimmed);
      setCurrentUser(updated);
      setNameSaved(true);
    } catch (err) {
      setNameError(err.response?.data?.message || err.message || 'Could not update your name.');
    } finally {
      setSavingName(false);
    }
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
  // the Dashboard and Requests views stay consistent. Pass `editable` to show
  // the per-card edit button (used on the Requests tab).
  const renderRequestList = (list, emptyText, editable = false) => {
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
            onEdit={editable ? setEditingRequest : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f6f1] dark:bg-[#0f1a0f] transition-colors duration-300">
      <Header currentUser={currentUser} onSignOutClick={handleLogout} />

      <div className="pt-[140px] pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── Left sidebar ─────────────────────────────────────────── */}
          <aside className="lg:col-span-3 xl:col-span-2">
            <div className="bg-[#9db08c] dark:bg-[#1f2d18] rounded-2xl p-5 lg:sticky lg:top-[140px] lg:min-h-[calc(100vh-140px-2.5rem)]">
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
                  'You have no active requests right now.',
                  true
                )}
              </div>
            )}

            {/* Household view: the user's account + household information. */}
            {activeView === 'household' && (
              <div className="max-w-2xl">
                <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
                  Household
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Your account details and household information.
                </p>

                {/* Account info card */}
                <div className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-6 mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#6ba3d3] flex items-center justify-center text-white text-2xl font-bold shrink-0">
                      {(currentUser?.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-[#1C2A16] dark:text-white truncate">
                        {currentUser?.name || 'Your account'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {currentUser?.role || 'help-seeker'}
                      </p>
                    </div>
                  </div>

                  <dl className="divide-y divide-gray-100 dark:divide-gray-700">
                    {[
                      { label: 'Name', value: currentUser?.name },
                      { label: 'Email', value: currentUser?.email },
                      { label: 'Phone Number', value: currentUser?.phoneNumber },
                      { label: 'Location', value: currentUser?.location },
                      { label: '# In Household', value: currentUser?.householdSize },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between gap-4 py-3">
                        <dt className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {row.label}
                        </dt>
                        <dd className="text-sm text-right min-w-0 truncate text-gray-800 dark:text-gray-100">
                          {row.value || (
                            <span className="text-gray-400 dark:text-gray-500 italic">Not set yet</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Phone number, location, and household size can't be edited here yet —
                  those fields are coming soon.
                </p>
              </div>
            )}

            {/* Settings view: edit account details (currently the name). */}
            {activeView === 'settings' && (
              <div className="max-w-2xl">
                <h1 className="text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
                  Settings
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Manage your account details.
                </p>

                <form
                  onSubmit={handleSaveName}
                  className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-6"
                >
                  <label
                    htmlFor="displayName"
                    className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2"
                  >
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setNameError('');
                      setNameSaved(false);
                    }}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all"
                  />

                  {nameError && (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">{nameError}</p>
                  )}
                  {nameSaved && (
                    <p className="mt-3 text-sm text-green-700 dark:text-green-400">
                      ✓ Your name has been updated.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={savingName || !nameInput.trim() || nameInput.trim() === currentUser?.name}
                    className="mt-5 px-8 py-3 bg-[#1e3a5f] text-white font-bold rounded-full hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingName ? 'Saving…' : 'Save Changes'}
                  </button>
                </form>
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

                  {/* Profile card. Name comes from the session; phone number and
                      household size aren't in the data model yet, so they show
                      as placeholders until those fields exist. */}
                  <div className="bg-[#6ba3d3] dark:bg-[#1a3a52] rounded-2xl p-6 text-white mb-6">
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

                  {/* Primary actions: make a request, or chat with the
                      assistant. Styled as a consistent pair. */}
                  <div className="flex flex-col sm:flex-row justify-center items-stretch gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="px-8 py-4 bg-[#1e3a5f] text-white font-bold rounded-full text-lg hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 transition-colors shadow-md"
                    >
                      Make New Request
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatOpen(true)}
                      className="px-8 py-4 bg-[#1e3a5f] text-white font-bold rounded-full text-lg hover:bg-[#182f4d] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 transition-colors shadow-md inline-flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a8 8 0 01-8 8 8.5 8.5 0 01-3.5-.75L3 21l1.5-4A8 8 0 1121 12z" />
                      </svg>
                      Chat with Assistant
                    </button>
                  </div>
                </div>

                {/* Right column: participating non-profits */}
                <aside className="xl:col-span-2 min-w-0">
                  <div className="bg-[#6ba3d3] dark:bg-[#1a3a52] rounded-2xl p-6 xl:sticky xl:top-[140px] xl:min-h-[calc(100vh-140px-2.5rem)]">
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

      {/* ── AI chat assistant (context-aware), opened from the inline
          "Chat with Assistant" button in the dashboard view ────────── */}
      <ChatAssistant
        firstName={firstName}
        open={chatOpen}
        onOpenChange={setChatOpen}
        hideLauncher
      />

      {/* ── Make New Request / Edit Request modal ──────────────────── */}
      {(showForm || editingRequest) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg relative">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingRequest(null);
              }}
              aria-label="Close"
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-600 hover:text-gray-900 shadow-md text-2xl leading-none"
            >
              ×
            </button>
            <HelpRequestForm
              compact
              request={editingRequest}
              onCreated={() => {
                loadRequests();
                setShowForm(false);
              }}
              onSaved={() => {
                loadRequests();
                setEditingRequest(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSeekerDashboard;
