import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalShell from '../components/portal/PortalShell';
import VolunteerDashboardView from '../components/volunteer/VolunteerDashboardView';
import VolunteerRequestsView from '../components/volunteer/VolunteerRequestsView';
import RequestCard from '../components/RequestCard/RequestCard';
import { getCurrentUser, logout } from '../utils/auth';
import {
  getPrioritizedRequests,
  getVolunteerInterests,
  expressInterest,
  requestErrorMessage,
} from '../utils/requests';

// Volunteer portal, built from the product wireframes. Shares the sidebar +
// top bar chrome with the help-seeker and organization portals (PortalShell).
// "Dashboard" and "Requests" are fully built; "My Interests" tracks requests
// the volunteer has offered to help with; other nav items land on a friendly
// placeholder. This change is front-end only — the same data calls are used.
const NAV_GROUPS = [
  {
    heading: 'General',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'requests', label: 'Requests', icon: 'requests' },
      { id: 'tasks', label: 'Tasks', icon: 'tasks' },
      { id: 'skills', label: 'Skills', icon: 'skills' },
      { id: 'groups', label: 'Groups', icon: 'groups' },
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
  requests: 'Active Help Requests',
  tasks: 'Tasks',
  skills: 'My Interests',
  groups: 'Groups',
  chat: 'Chat',
  documents: 'Documents',
  settings: 'Settings',
};

const VolunteerDashboard = () => {
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const [view, setView] = useState('dashboard');

  // The AI priority feed of open requests, and the requests this volunteer has
  // already offered to help with. Loaded once; both views read from them.
  const [feed, setFeed] = useState([]);
  const [interests, setInterests] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tracks the request id currently being submitted, so we can show a loading
  // state on just that card's button.
  const [interactingId, setInteractingId] = useState(null);
  // Maps request id -> confirmation message after a successful interaction.
  const [confirmations, setConfirmations] = useState({});

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Load the priority feed and (if signed in) the volunteer's interests. A
  // failure loading interests is treated as "none yet" so the feed still shows.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFeed(await getPrioritizedRequests());
      try {
        setInterests(await getVolunteerInterests());
      } catch {
        setInterests([]);
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

  // Headline dashboard stats. Where we have real data we compute it; the
  // people-helped / skillset figures are illustrative until those endpoints
  // exist, matching the wireframe's summary pills.
  const dashboardStats = useMemo(() => {
    const total = feed.length;
    const done = feed.filter((r) => ['fulfilled', 'closed'].includes(r.status)).length;
    const completedPct = total ? `${Math.round((done / total) * 100)}%` : '0%';
    return {
      completedPct,
      peopleHelped: '30k',
      skillWays: '10',
    };
  }, [feed]);

  // Surface the top open requests as upcoming "tasks" with dated chips.
  const tasks = useMemo(() => {
    return feed.slice(0, 2).map((r) => {
      const d = r.createdAt ? new Date(r.createdAt) : null;
      return {
        date: d ? d.getDate() : '—',
        month: d ? d.toLocaleString(undefined, { month: 'short' }) : '',
        title: r.category || r.description?.slice(0, 40) || 'Request',
      };
    });
  }, [feed]);

  return (
    <PortalShell
      personaLabel="Volunteer"
      navGroups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      title={VIEW_TITLES[view]}
      currentUser={currentUser}
      onSignOut={handleLogout}
    >
      {view === 'dashboard' && (
        <VolunteerDashboardView currentUser={currentUser} stats={dashboardStats} tasks={tasks} />
      )}

      {view === 'requests' && (
        <VolunteerRequestsView
          requests={feed}
          loading={loading}
          error={error}
          onRetry={loadData}
          onInteract={handleInteract}
          interactingId={interactingId}
          confirmations={confirmations}
        />
      )}

      {view === 'skills' && (
        <InterestsView interests={interests} loading={loading} error={error} onRetry={loadData} />
      )}

      {!['dashboard', 'requests', 'skills'].includes(view) && (
        <ComingSoonPanel title={VIEW_TITLES[view]} />
      )}
    </PortalShell>
  );
};

// The requests this volunteer has offered to help with.
const InterestsView = ({ interests, loading, error, onRetry }) => {
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
      <ComingSoonPanel
        title="No interests yet"
        subtitle="Head to Requests to find people who need help."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {interests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
};

// Placeholder for nav items not yet built (Skills, Groups, etc.).
const ComingSoonPanel = ({ title, subtitle }) => (
  <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
    <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">{title}</h2>
    <p className="text-gray-500 dark:text-gray-400">{subtitle || 'This section is coming soon.'}</p>
  </div>
);

export default VolunteerDashboard;
