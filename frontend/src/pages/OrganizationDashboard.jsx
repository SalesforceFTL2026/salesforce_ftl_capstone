import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalShell from '../components/portal/PortalShell';
import DashboardView from '../components/organization/DashboardView';
import RequestsView from '../components/organization/RequestsView';
import ResourcesView from '../components/organization/ResourcesView';
import { getCurrentUser, logout } from '../utils/auth';
import {
  getAllRequests,
  getOrganizationResponses,
  getOrganizationResources,
  addOrganizationResource,
  setResourceAvailability,
  deleteOrganizationResource,
  updateRequestStatus,
  assignRequest,
  unassignRequest,
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

// Assumed people per household, used only as a fallback for completed requests
// that don't have a real householdSize recorded.
const AVG_HOUSEHOLD_SIZE = 3;

const OrganizationDashboard = () => {
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const [view, setView] = useState('dashboard');

  // Every request in the system (any status) and this org's assigned responses.
  const [feed, setFeed] = useState([]);
  const [responses, setResponses] = useState([]);
  const [assigningId, setAssigningId] = useState(null);
  // The org's inventory of resources (food, wood, health care kits, ...).
  const [resources, setResources] = useState([]);
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
      const feedData = await getAllRequests();
      setFeed(feedData);
      try {
        setResponses(await getOrganizationResponses());
      } catch {
        setResponses([]);
      }
      try {
        setResources(await getOrganizationResources());
      } catch {
        setResources([]);
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

  // Reload just the resource inventory (used after allocations change on-hand
  // quantities, so the list and the "Resources Available" pill stay accurate).
  const refreshResources = useCallback(async () => {
    try {
      setResources(await getOrganizationResources());
    } catch {
      // A failed refresh shouldn't blow away what's already on screen.
    }
  }, []);

  // --- Resource inventory handlers ---
  // Each optimistically updates the local list after the API call succeeds.
  const handleAddResource = async (resource) => {
    const created = await addOrganizationResource(resource);
    setResources((prev) => [created, ...prev]);
    return created;
  };

  const handleToggleResource = async (id, available) => {
    try {
      const updated = await setResourceAvailability(id, available);
      setResources((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not update the resource.'));
    }
  };

  const handleDeleteResource = async (id) => {
    try {
      await deleteOrganizationResource(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not remove the resource.'));
    }
  };

  // Assign a request to this org (or remove that assignment). Assigning is what
  // lets the org allocate resources to the request; multiple orgs can assign
  // themselves to the same request. We reload responses afterward so the
  // "Your Requests" list and the allocation gating stay in sync.
  const handleToggleAssign = async (request, assign) => {
    setAssigningId(request.id);
    setError('');
    try {
      if (assign) {
        await assignRequest(request.id);
      } else {
        await unassignRequest(request.id);
      }
      try {
        setResponses(await getOrganizationResponses());
      } catch {
        setResponses([]);
      }
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not update the assignment.'));
    } finally {
      setAssigningId(null);
    }
  };

  // Requests this org has assigned to itself vs. everything else it can browse
  // (any status — pending or fulfilled). Orgs can view all requests, but only
  // allocate resources to the ones they've assigned to themselves.
  const respondingIds = useMemo(
    () => new Set(responses.map((r) => r.id)),
    [responses]
  );
  const unfiltered = useMemo(
    () => feed.filter((r) => !respondingIds.has(r.id)),
    [feed, respondingIds]
  );

  // Headline dashboard stats, all derived from the org's own data:
  // - Requests Completed: % of the requests this org is tracking that are done
  //   (the request is fulfilled/closed, or the org's response is completed).
  // - People Helped: sum of household sizes across those completed requests,
  //   falling back to an assumed average where no household size was recorded.
  // - Resources Available: count of resources the org has marked available.
  const dashboardStats = useMemo(() => {
    const isCompleted = (r) =>
      r.responseStatus === 'completed' || ['fulfilled', 'closed'].includes(r.status);
    const completed = responses.filter(isCompleted);

    const total = responses.length;
    const completedPct = total ? `${Math.round((completed.length / total) * 100)}%` : '0%';

    const peopleHelped = completed.reduce(
      (sum, r) => sum + (r.householdSize > 0 ? r.householdSize : AVG_HOUSEHOLD_SIZE),
      0,
    );

    const resourcesAvailable = resources.filter((r) => r.available).length;

    return {
      completedPct,
      peopleHelped: String(peopleHelped),
      resourcesAvailable: String(resourcesAvailable),
    };
  }, [responses, resources]);

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
          resources={resources}
          onAllocationsChanged={refreshResources}
          assignedIds={respondingIds}
          onToggleAssign={handleToggleAssign}
          assigningId={assigningId}
        />
      )}

      {view === 'resources' && (
        <ResourcesView
          resources={resources}
          loading={loading}
          error={error}
          onRetry={loadData}
          onAdd={handleAddResource}
          onToggle={handleToggleResource}
          onDelete={handleDeleteResource}
        />
      )}

      {!['dashboard', 'requests', 'resources'].includes(view) && (
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
