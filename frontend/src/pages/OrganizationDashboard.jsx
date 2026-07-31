import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PortalShell from '../components/portal/PortalShell';
import DashboardView from '../components/organization/DashboardView';
import RequestsView from '../components/organization/RequestsView';
import ResourcesView from '../components/organization/ResourcesView';
import TasksView from '../components/organization/TasksView';
import AvatarUploader from '../components/portal/AvatarUploader';
import ChatAssistant from '../components/ChatAssistant/ChatAssistant';
import AccountSettings from '../components/portal/AccountSettings';
import Toast from '../components/Toast/Toast';
import { getCurrentUser, logout, updateProfile } from '../utils/auth';
import { usePolling } from '../hooks/usePolling';
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
  getVolunteerTasks,
  createVolunteerTask,
  updateVolunteerTask,
  deleteVolunteerTask,
  getTaskDateSuggestions,
  getTaskSuggestions,
  requestErrorMessage,
} from '../utils/requests';

// Organization portal, built from the product wireframes. Shares the sidebar +
// top bar chrome with the help-seeker portal (PortalShell). "Dashboard" and
// "Requests" are fully built; other nav items land on a friendly placeholder.

// Assumed people per household, used only as a fallback for completed requests
// that don't have a real householdSize recorded.
const AVG_HOUSEHOLD_SIZE = 3;

const OrganizationDashboard = () => {
  // t() looks up UI text in the active language; changing the language
  // re-renders this component with the translated strings.
  const { t } = useTranslation();
  // Kept in state (not a constant) so profile edits like location re-render.
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  // First name, used only for the assistant's friendly opening greeting.
  const firstName = currentUser?.name?.split(' ')[0] || 'there';

  // Sidebar nav, built from translations so the labels switch with the
  // language. Rebuilt each render — cheap, and keeps it always in sync.
  const NAV_GROUPS = [
    {
      heading: t('nav.general'),
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
        { id: 'requests', label: t('nav.requests'), icon: 'requests' },
        { id: 'tasks', label: t('org.nav.tasks'), icon: 'tasks' },
        { id: 'resources', label: t('org.nav.resources'), icon: 'resources' },
      ],
    },
    {
      heading: t('nav.tools'),
      items: [
        { id: 'settings', label: t('nav.settings'), icon: 'settings' },
      ],
    },
  ];

  const VIEW_TITLES = {
    dashboard: t('nav.dashboard'),
    requests: t('nav.requests'),
    tasks: t('org.nav.tasks'),
    resources: t('org.nav.resources'),
    settings: t('nav.settings'),
  };

  const [view, setView] = useState('dashboard');

  // Every request in the system (any status) and this org's assigned responses.
  const [feed, setFeed] = useState([]);
  const [responses, setResponses] = useState([]);
  const [assigningId, setAssigningId] = useState(null);
  // "Near me" geo-radius filter (issue #116): null = show everything, otherwise
  // { lat, lng, radiusMiles }. When set, the feed is re-fetched filtered to it.
  const [near, setNear] = useState(null);
  // Keyword / category / urgency filters (issues #81, #82). Changing these
  // re-fetches the feed, which the backend narrows via the shared contract.
  const [filters, setFilters] = useState({ search: '', category: '', urgency: '' });
  // The org's inventory of resources (food, wood, health care kits, ...).
  const [resources, setResources] = useState([]);
  // The org's volunteer tasks (help tasks volunteers can sign up for).
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  // `error` is only for load failures — it renders inline in the view (with a
  // Retry). Feedback from an action (a rejected status change, a failed
  // allocation, etc.) goes to `actionMessage` instead, shown as a small
  // temporary toast so it doesn't push the page content around.
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Load both lists. The responses call needs auth and may 404 if the org has
  // none yet — we treat a failure there as "no responses" rather than a hard
  // error, so the dashboard still renders from the priority feed.
  //
  // Pass { silent: true } for background polling refreshes so the feed updates
  // in place without flashing the loading spinner.
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // When "Near me" is on, ask the backend to geo-radius filter the feed;
      // the keyword/category/urgency filters compose with it server-side.
      const feedData = await getAllRequests(near, filters);
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
      try {
        setTasks(await getVolunteerTasks());
      } catch {
        setTasks([]);
      }
    } catch (err) {
      setError(requestErrorMessage(err, t('org.errors.loadRequests')));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [near, filters, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh the priority feed so new requests appear live (#157). Silent
  // so background refreshes don't flash the spinner.
  usePolling(useCallback(() => loadData({ silent: true }), [loadData]));

  // Re-fetch the feed whenever the "Near me" or keyword/category/urgency filters
  // change. loadData closes over `near` and `filters`, so it's a fresh callback
  // each time either moves, and the useEffect above re-runs it.

  // Optimistically move a request through its lifecycle, then reconcile.
  const handleStatusChange = async (request, status) => {
    setUpdatingId(request.id);
    setActionMessage('');
    try {
      const updated = await updateRequestStatus(request.id, status);
      const apply = (list) =>
        list.map((r) => (r.id === request.id ? { ...r, ...updated } : r));
      setFeed(apply);
      setResponses(apply);
    } catch (err) {
      // e.g. the backend rejecting an in-progress/fulfilled move because the
      // volunteers/resources/date conditions aren't met yet.
      setActionMessage(requestErrorMessage(err, t('org.errors.updateStatus')));
    } finally {
      setUpdatingId(null);
    }
  };

  // Save the org's location (the origin "nearest" measures from) and reflect it
  // in the session so the change sticks across the app and a page refresh.
  const handleOrgLocationChange = useCallback(async (location) => {
    const updated = await updateProfile({ location });
    setCurrentUser(updated);
  }, []);

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
      setActionMessage(requestErrorMessage(err, t('org.errors.updateResource')));
    }
  };

  const handleDeleteResource = async (id) => {
    try {
      await deleteOrganizationResource(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setActionMessage(requestErrorMessage(err, t('org.errors.removeResource')));
    }
  };

  // --- Volunteer task handlers ---
  // Each optimistically updates the local list after the API call succeeds.
  const handleCreateTask = async (task) => {
    const created = await createVolunteerTask(task);
    setTasks((prev) => [created, ...prev]);
    return created;
  };

  const handleUpdateTask = async (id, updates) => {
    const updated = await updateVolunteerTask(id, updates);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    return updated;
  };

  const handleDeleteTask = async (id) => {
    await deleteVolunteerTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Assign a request to this org (or remove that assignment). Assigning is what
  // lets the org allocate resources to the request; multiple orgs can assign
  // themselves to the same request. We reload responses afterward so the
  // "Your Requests" list and the allocation gating stay in sync.
  const handleToggleAssign = async (request, assign) => {
    setAssigningId(request.id);
    setActionMessage('');
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
      setActionMessage(requestErrorMessage(err, t('org.errors.updateAssignment')));
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

  // Headline dashboard stats, framed as progress toward a goal rather than bare
  // numbers — the org can see "X of Y" and the percentage, so a figure like
  // "3 people helped" reads as "3 of 40 (8%)" instead of standing alone.
  // Each metric is { done, total, pct } (pct is a rounded whole number):
  // - resolved: responses this org has completed, out of all it's handling.
  // - peopleReached: household members reached (completed responses) out of the
  //   total across every request this org is handling.
  // - resources: inventory marked available, out of the org's whole inventory.
  const dashboardStats = useMemo(() => {
    const isCompleted = (r) =>
      r.responseStatus === 'completed' || ['fulfilled', 'closed'].includes(r.status);
    const people = (r) => (r.householdSize > 0 ? r.householdSize : AVG_HOUSEHOLD_SIZE);
    const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

    const completed = responses.filter(isCompleted);
    const peopleReachedTotal = responses.reduce((sum, r) => sum + people(r), 0);
    const peopleReachedDone = completed.reduce((sum, r) => sum + people(r), 0);
    const resourcesAvailable = resources.filter((r) => r.available).length;

    return {
      resolved: {
        done: completed.length,
        total: responses.length,
        pct: pct(completed.length, responses.length),
      },
      peopleReached: {
        done: peopleReachedDone,
        total: peopleReachedTotal,
        pct: pct(peopleReachedDone, peopleReachedTotal),
      },
      resources: {
        done: resourcesAvailable,
        total: resources.length,
        pct: pct(resourcesAvailable, resources.length),
      },
    };
  }, [responses, resources]);

  // Coverage across active disaster locations. The org's core question isn't
  // just "how many requests" but "of all the places with active needs, which
  // are being handled and which still need attention?" We group every open
  // request (the whole feed, any status) by its location, and for each place
  // count the people needing help and how many requests are already being
  // handled (a status past "pending" means someone is on it). A location is
  // "covered" once every request there is being handled.
  const dashboardLocations = useMemo(() => {
    const isHandled = (r) =>
      r.responseStatus === 'completed' ||
      ['in-progress', 'matched', 'fulfilled', 'closed'].includes(r.status);
    const people = (r) => (r.householdSize > 0 ? r.householdSize : AVG_HOUSEHOLD_SIZE);

    const byLocation = new Map();
    for (const r of feed) {
      const name = (r.location || '').trim() || t('org.dashboard.unknownLocation');
      const group = byLocation.get(name) || { name, requests: 0, handled: 0, people: 0 };
      group.requests += 1;
      group.people += people(r);
      if (isHandled(r)) group.handled += 1;
      byLocation.set(name, group);
    }

    // Most people-in-need first, so the biggest gaps sit at the top.
    const list = [...byLocation.values()].sort((a, b) => b.people - a.people);
    const covered = list.filter((l) => l.requests > 0 && l.handled === l.requests).length;

    return {
      list,
      total: list.length,
      covered,
      needAttention: list.length - covered,
    };
  }, [feed, t]);

  const dashboardTasks = useMemo(() => {
    // Surface the org's own posted volunteer tasks as dated chips, newest first,
    // using each task's scheduled volunteer day for the chip. The view shows
    // about two at a time and scrolls the rest, so we pass them all through.
    return tasks.map((task) => {
      const d = task.volunteerDate ? new Date(task.volunteerDate) : null;
      return {
        date: d ? d.getDate() : '—',
        month: d ? d.toLocaleString(undefined, { month: 'short' }) : '',
        title: task.title || task.category || t('org.dashboard.taskFallback'),
      };
    });
  }, [tasks, t]);

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
        <DashboardView
          currentUser={currentUser}
          stats={dashboardStats}
          locations={dashboardLocations}
          requests={unfiltered}
          onViewRequests={() => setView('requests')}
          tasks={dashboardTasks}
        />
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
          orgLocation={currentUser?.location}
          onOrgLocationChange={handleOrgLocationChange}
          resources={resources}
          onAllocationsChanged={refreshResources}
          assignedIds={respondingIds}
          onToggleAssign={handleToggleAssign}
          assigningId={assigningId}
          near={near}
          onNearChange={setNear}
          filters={filters}
          onFiltersChange={setFilters}
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

      {view === 'tasks' && (
        <TasksView
          tasks={tasks}
          requests={responses}
          loading={loading}
          error={error}
          onRetry={loadData}
          onCreate={handleCreateTask}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onSuggestDates={getTaskDateSuggestions}
          onSuggestTasks={getTaskSuggestions}
        />
      )}

      {view === 'settings' && (
        <AccountSettings currentUser={currentUser} onUserChange={setCurrentUser} />
      )}

      {!['dashboard', 'requests', 'resources', 'tasks', 'settings'].includes(view) && (
        <ComingSoonPanel title={VIEW_TITLES[view]} />
      )}

      {/* AI assistant, available on every view as a floating icon in the
          bottom-right corner. The backend grounds replies in this org's claimed
          requests, the open request feed, its resource bank, and its posted
          tasks — so it can recommend tasks and allocations concretely. */}
      <ChatAssistant firstName={firstName} greetingKey="chat.orgGreeting" />

      {/* Temporary, corner-anchored feedback for actions (e.g. a status change
          the backend rejected). Auto-dismisses; never shifts page content. */}
      <Toast message={actionMessage} onDismiss={() => setActionMessage('')} />
    </PortalShell>
  );
};

// Placeholder for nav items not yet built (Metrics, Resources, etc.).
const ComingSoonPanel = ({ title }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
      <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400">{t('common.comingSoon')}</p>
    </div>
  );
};

export default OrganizationDashboard;
