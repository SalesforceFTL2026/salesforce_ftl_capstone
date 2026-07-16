import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalShell from '../components/portal/PortalShell';
import HSDashboardView from '../components/helpseeker/HSDashboardView';
import HSRequestsView from '../components/helpseeker/HSRequestsView';
import SafetyManual from '../components/SafetyManual/SafetyManual';
import HelpRequestForm from '../../components/HelpRequestForm/HelpRequestForm';
import api from '../utils/api';
import { getCurrentUser, logout } from '../utils/auth';

// Sidebar nav for the help-seeker portal, matching the wireframe.
const NAV_GROUPS = [
  {
    heading: 'General',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'requests', label: 'Requests', icon: 'requests' },
      { id: 'household', label: 'Household', icon: 'household' },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { id: 'chat', label: 'Chat', icon: 'chat' },
      { id: 'documents', label: 'Emergency Guide', icon: 'documents' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  requests: 'Requests',
  household: 'Household',
  chat: 'Chat',
  documents: 'Emergency Guide',
  settings: 'Settings',
};

// Placeholder data for "Participating Non-Profits Near You" — no endpoint yet.
const SAMPLE_NONPROFITS = [
  { id: 1, name: 'Sample Relief Org', type: 'Food & supplies', distance: '1.2 mi away' },
  { id: 2, name: 'Sample Shelter Network', type: 'Emergency shelter', distance: '2.8 mi away' },
  { id: 3, name: 'Sample Health Alliance', type: 'Medical aid', distance: '3.5 mi away' },
  { id: 4, name: 'Sample Community Fund', type: 'Financial assistance', distance: '4.0 mi away' },
];

// Help-Seeker portal. Shares the sidebar + top bar chrome with the organization
// portal (PortalShell), so both personas have the same background format.
const HelpSeekerDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState('dashboard');
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

  return (
    <PortalShell
      personaLabel="Help Seeker"
      navGroups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      title={VIEW_TITLES[view]}
      currentUser={currentUser}
      onSignOut={handleLogout}
    >
      {view === 'dashboard' && (
        <HSDashboardView
          currentUser={currentUser}
          requests={requests}
          loading={loading}
          error={error}
          deletingId={deletingId}
          onDelete={handleDelete}
          onNewRequest={() => setShowForm(true)}
          nonprofits={SAMPLE_NONPROFITS}
        />
      )}

      {view === 'requests' && (
        <HSRequestsView
          requests={requests}
          loading={loading}
          error={error}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
      )}

      {view === 'documents' && <SafetyManual />}

      {!['dashboard', 'requests', 'documents'].includes(view) && (
        <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
          <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">
            {VIEW_TITLES[view]}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">This section is coming soon.</p>
        </div>
      )}

      {/* Make New Request modal */}
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
    </PortalShell>
  );
};

export default HelpSeekerDashboard;
