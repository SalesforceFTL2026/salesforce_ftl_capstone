import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalShell from '../components/portal/PortalShell';
import DashboardView from '../components/organization/DashboardView';
import RequestsView from '../components/organization/RequestsView';
import { getCurrentUser, logout } from '../utils/auth';
import {
  getPrioritizedRequests,
  getOrganizationResponses,
  updateRequestStatus,
  requestErrorMessage,
} from '../utils/requests';

// Organization portal, built from the product wireframes. Shares the sidebar +
// top bar chrome with the help-seeker portal (PortalShell). "Dashboard" and
// "Requests" are fully built; other nav items land on a friendly placeholder.
const NAV_GROUPS = [
  {
    heading: 'General',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'requests', label: 'Requests', icon: 'requests' },
      { id: 'metrics', label: 'Metrics', icon: 'metrics' },
      { id: 'resources', label: 'Resources', icon: 'resources' },
      { id: 'volunteers', label: 'Volunteers', icon: 'volunteers' },
    ],
  },
  {
    heading: 'Tools',
    items: [
      { id: 'chat', label: 'Chat', icon: 'chat' },
      { id: 'documents', label: 'Documents', icon: 'documents' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  requests: 'Requests',
  metrics: 'Metrics',
  resources: 'Resources',
  volunteers: 'Volunteers',
  chat: 'Chat',
  documents: 'Documents',
  settings: 'Settings',
};

// A request is "open" (unclaimed) while pending/in-progress with no org yet.
const OPEN_STATUSES = ['pending', 'in-progress'];

const OrganizationDashboard = () => {
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const [view, setView] = useState('dashboard');

  // Priority feed (all active requests) and this org's tracked responses.
  const [feed, setFeed] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Load both lists. The responses call needs auth and may 404 if the org has
  // none yet — we treat a failure there as "no responses" rather than a hard
  // error, so the dashboard still renders from the priority feed.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const feedData = await getPrioritizedRequests();
      setFeed(feedData);
      try {
        setResponses(await getOrganizationResponses());
      } catch {
        setResponses([]);
      }
    } catch (err) {
      setError(requestErrorMessage(err, 'Something went wrong loading requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Optimistically move a request through its lifecycle, then reconcile.
  const handleStatusChange = async (request, status) => {
    setUpdatingId(request.id);
    setError('');
    try {
      const updated = await updateRequestStatus(request.id, status);
      const apply = (list) =>
        list.map((r) => (r.id === request.id ? { ...r, ...updated } : r));
      setFeed(apply);
      setResponses(apply);
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not update the request status.'));
    } finally {
      setUpdatingId(null);
    }
  };

  // Requests the org is responding to vs. still-open ("unfiltered") ones.
  const respondingIds = useMemo(
    () => new Set(responses.map((r) => r.id)),
    [responses]
  );
  const unfiltered = useMemo(
    () =>
      feed.filter(
        (r) => !respondingIds.has(r.id) && OPEN_STATUSES.includes(r.status)
      ),
    [feed, respondingIds]
  );

  // Headline dashboard stats. Where we have real data we compute it; the
  // people-helped / resources figures are illustrative until those endpoints
  // exist, matching the wireframe's summary pills.
  const dashboardStats = useMemo(() => {
    const total = feed.length;
    const done = feed.filter((r) => ['fulfilled', 'closed'].includes(r.status)).length;
    const completedPct = total ? `${Math.round((done / total) * 100)}%` : '0%';
    return {
      completedPct,
      peopleHelped: '30k',
      resourcesAvailable: '95k',
    };
  }, [feed]);

  const tasks = useMemo(() => {
    // Surface the top open requests as upcoming "tasks" with dated chips.
    return unfiltered.slice(0, 2).map((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : null;
      return {
        date: d ? d.getDate() : '—',
        month: d ? d.toLocaleString(undefined, { month: 'short' }) : '',
        title: r.category || r.description?.slice(0, 40) || 'Request',
      };
    });
  }, [unfiltered]);

  return (
    <PortalShell
      personaLabel="Organization"
      navGroups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      title={VIEW_TITLES[view]}
      currentUser={currentUser}
      onSignOut={handleLogout}
    >
      {view === 'dashboard' && (
        <DashboardView currentUser={currentUser} stats={dashboardStats} tasks={tasks} />
      )}

      {view === 'requests' && (
        <RequestsView
          yourRequests={responses}
          unfiltered={unfiltered}
          loading={loading}
          error={error}
          onRetry={loadData}
          onStatusChange={handleStatusChange}
          updatingId={updatingId}
        />
      )}

      {!['dashboard', 'requests'].includes(view) && (
        <ComingSoonPanel title={VIEW_TITLES[view]} />
      )}
    </PortalShell>
  );
};

// Placeholder for nav items not yet built (Metrics, Resources, etc.).
const ComingSoonPanel = ({ title }) => (
  <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
    <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">{title}</h2>
    <p className="text-gray-500 dark:text-gray-400">This section is coming soon.</p>
  </div>
);

export default OrganizationDashboard;
