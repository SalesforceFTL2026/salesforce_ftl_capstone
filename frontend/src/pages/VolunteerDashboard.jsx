import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalShell from '../components/portal/PortalShell';
import VolunteerDashboardView from '../components/volunteer/VolunteerDashboardView';
import VolunteerRequestsView from '../components/volunteer/VolunteerRequestsView';
import RequestCard from '../components/RequestCard/RequestCard';
import { getCurrentUser, logout } from '../utils/auth';
import { usePolling } from '../hooks/usePolling';
import { DISASTER_SKILLS } from '../utils/skills';
import {
  getPrioritizedRequests,
  getVolunteerInterests,
  getVolunteerSkills,
  expressInterest,
  markRequestHelped,
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

// Canonical skill areas (DISASTER_SKILLS) are shared with the signup form and
// live in utils/skills.js. We use the list here to estimate how many *new*
// skill areas a volunteer could still pick up, based on the categories of
// requests they've helped with.

// Which skill areas each request category exercises. Lets us mark a skill as
// "already practiced" once a volunteer has engaged a request in that category.
const CATEGORY_SKILLS = {
  Food: ['Food & Water Distribution'],
  Shelter: ['Shelter Management', 'Damage Assessment'],
  Medical: ['First Aid & CPR', 'Medical Support'],
  Transport: ['Transportation & Logistics'],
  Other: ['Emergency Communications'],
};

// Match a skill string from the volunteer's profile to a canonical skill area.
// Profiles store free-form skills (e.g. "medical", "cpr", "translation"), so we
// match loosely by keyword. Returns the canonical name, or null if none fits.
const canonicalizeSkill = (raw) => {
  const s = String(raw).toLowerCase();
  return (
    DISASTER_SKILLS.find((skill) => {
      const name = skill.toLowerCase();
      return name.includes(s) || s.includes(name.split(' ')[0]);
    }) || null
  );
};

// Assumed people per household, used only as a fallback for completed requests
// that don't have a real householdSize recorded.
const AVG_HOUSEHOLD_SIZE = 3;

const VolunteerDashboard = () => {
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const [view, setView] = useState('dashboard');

  // The AI priority feed of open requests, and the requests this volunteer has
  // already offered to help with. Loaded once; both views read from them.
  const [feed, setFeed] = useState([]);
  const [interests, setInterests] = useState([]);
  // "Near me" geo-radius filter (issue #116): null = show everything, otherwise
  // { lat, lng, radiusMiles }. When set, the feed is re-fetched filtered to it.
  const [near, setNear] = useState(null);
  // Skill areas this volunteer lists on their profile (from the Volunteer row).
  const [skills, setSkills] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tracks the request id currently being submitted, so we can show a loading
  // state on just that card's button.
  const [interactingId, setInteractingId] = useState(null);
  // Maps request id -> confirmation message after a successful interaction.
  const [confirmations, setConfirmations] = useState({});
  // Tracks the interest currently being marked as helped, for its button state.
  const [markingId, setMarkingId] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Load the priority feed and (if signed in) the volunteer's interests. A
  // failure loading interests is treated as "none yet" so the feed still shows.
  //
  // Pass { silent: true } for background polling refreshes so the feed updates
  // in place without flashing the loading spinner.
  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // When "Near me" is on, ask the backend to geo-radius filter the feed.
      setFeed(await getPrioritizedRequests(near));
      try {
        setInterests(await getVolunteerInterests());
      } catch {
        setInterests([]);
      }
      try {
        setSkills(await getVolunteerSkills());
      } catch {
        setSkills([]);
      }
    } catch (err) {
      setError(requestErrorMessage(err, 'Something went wrong loading requests.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [near]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh the priority feed so new requests appear live (#157). Silent
  // so background refreshes don't flash the spinner.
  usePolling(useCallback(() => loadData({ silent: true }), [loadData]));

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

  // Volunteer clicked "Mark as helped" on a My Interests card. Completes the
  // request, then reloads so the card reflects its new completed status.
  const handleMarkHelped = async (request) => {
    setMarkingId(request.id);
    setError('');
    try {
      await markRequestHelped(request.id);
      await loadData({ silent: true });
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not mark the request as helped. Please try again.'));
    } finally {
      setMarkingId(null);
    }
  };

  // Headline dashboard stats, derived from the volunteer's own activity
  // (the requests they've offered to help with — `interests`) plus their
  // profile skills.
  //
  // - Requests Completed: interests the volunteer finished, or whose underlying
  //   request has been fulfilled/closed.
  // - People Helped: sum of each completed request's householdSize, falling
  //   back to an assumed average for requests with no household size recorded.
  // - Ways to Expand your Skillset: disaster-volunteer skill areas the
  //   volunteer hasn't covered yet — counting both skills they list on their
  //   profile and skills implied by the request categories they've engaged with.
  const dashboardStats = useMemo(() => {
    const isCompleted = (r) =>
      r.responseStatus === 'completed' || ['fulfilled', 'closed'].includes(r.status);
    const completed = interests.filter(isCompleted);
    const completedCount = completed.length;

    // Real people helped: sum household sizes, using the average where unknown.
    const peopleHelped = completed.reduce(
      (sum, r) => sum + (r.householdSize > 0 ? r.householdSize : AVG_HOUSEHOLD_SIZE),
      0,
    );

    // Skill areas the volunteer has already covered: those listed on their
    // profile, plus those implied by the categories they've engaged with.
    const covered = new Set();
    skills.forEach((raw) => {
      const skill = canonicalizeSkill(raw);
      if (skill) covered.add(skill);
    });
    interests.forEach((r) => {
      (CATEGORY_SKILLS[r.category] || []).forEach((skill) => covered.add(skill));
    });
    const skillWays = DISASTER_SKILLS.filter((skill) => !covered.has(skill)).length;

    return {
      completedCount: String(completedCount),
      peopleHelped: String(peopleHelped),
      skillWays: String(skillWays),
    };
  }, [interests, skills]);

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
          near={near}
          onNearChange={setNear}
        />
      )}

      {view === 'skills' && (
        <InterestsView
          interests={interests}
          loading={loading}
          error={error}
          onRetry={loadData}
          onMarkHelped={handleMarkHelped}
          markingId={markingId}
        />
      )}

      {!['dashboard', 'requests', 'skills'].includes(view) && (
        <ComingSoonPanel title={VIEW_TITLES[view]} />
      )}
    </PortalShell>
  );
};

// The requests this volunteer has offered to help with.
const InterestsView = ({ interests, loading, error, onRetry, onMarkHelped, markingId }) => {
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
        <RequestCard
          key={request.id}
          request={request}
          onMarkHelped={onMarkHelped}
          marking={markingId === request.id}
        />
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
