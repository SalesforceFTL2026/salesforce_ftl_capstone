import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PortalShell from '../components/portal/PortalShell';
import VolunteerDashboardView from '../components/volunteer/VolunteerDashboardView';
import VolunteerRequestsView from '../components/volunteer/VolunteerRequestsView';
import VolunteerTasksView from '../components/volunteer/VolunteerTasksView';
import AvailableTasksSection from '../components/volunteer/AvailableTasksSection';
import VolunteerSkillsView from '../components/volunteer/VolunteerSkillsView';
import { getCurrentUser, logout } from '../utils/auth';
import { usePolling } from '../hooks/usePolling';
import { DISASTER_SKILLS } from '../utils/skills';
import {
  getPrioritizedRequests,
  getVolunteerInterests,
  getVolunteerSkills,
  getVolunteerSkillsDetailed,
  updateVolunteerSkills,
  expressInterest,
  markRequestHelped,
  withdrawInterest,
  getAvailableTasks,
  signUpForTask,
  withdrawFromTask,
  requestErrorMessage,
} from '../utils/requests';

// Volunteer portal, built from the product wireframes. Shares the sidebar +
// top bar chrome with the help-seeker and organization portals (PortalShell).
// "Dashboard" and "Requests" are fully built; "My Interests" tracks requests
// the volunteer has offered to help with; other nav items land on a friendly
// placeholder. This change is front-end only — the same data calls are used.

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
  const { t } = useTranslation();
  const [currentUser] = useState(getCurrentUser);
  const navigate = useNavigate();

  const [view, setView] = useState('dashboard');

  // Sidebar nav + view titles, built from translations so the labels switch
  // with the language. Rebuilt each render — cheap, and always in sync.
  const NAV_GROUPS = [
    {
      heading: t('volunteer.nav.general'),
      items: [
        { id: 'dashboard', label: t('volunteer.nav.dashboard'), icon: 'dashboard' },
        { id: 'requests', label: t('volunteer.nav.requests'), icon: 'requests' },
        { id: 'tasks', label: t('volunteer.nav.tasks'), icon: 'tasks' },
        { id: 'skills', label: t('volunteer.nav.skills'), icon: 'skills' },
        { id: 'groups', label: t('volunteer.nav.groups'), icon: 'groups' },
      ],
    },
    {
      heading: t('volunteer.nav.tools'),
      items: [
        { id: 'chat', label: t('volunteer.nav.chat'), icon: 'chat' },
        { id: 'documents', label: t('volunteer.nav.documents'), icon: 'documents' },
        { id: 'settings', label: t('volunteer.nav.settings'), icon: 'settings' },
      ],
    },
  ];

  const VIEW_TITLES = {
    dashboard: t('volunteer.nav.dashboard'),
    requests: t('volunteer.viewTitles.requests'),
    tasks: t('volunteer.nav.tasks'),
    skills: t('volunteer.viewTitles.skills'),
    groups: t('volunteer.nav.groups'),
    chat: t('volunteer.nav.chat'),
    documents: t('volunteer.nav.documents'),
    settings: t('volunteer.nav.settings'),
  };

  // The AI priority feed of open requests, and the requests this volunteer has
  // already offered to help with. Loaded once; both views read from them.
  const [feed, setFeed] = useState([]);
  const [interests, setInterests] = useState([]);
  // Open org-created tasks the volunteer can sign up for (separate from the
  // requests they've offered to help with, tracked in `interests`).
  const [availableTasks, setAvailableTasks] = useState([]);
  // Task id whose sign-up / withdraw button is mid-request.
  const [taskBusyId, setTaskBusyId] = useState(null);
  // "Near me" geo-radius filter (issue #116): null = show everything, otherwise
  // { lat, lng, radiusMiles }. When set, the feed is re-fetched filtered to it.
  const [near, setNear] = useState(null);
  // Category / urgency / keyword filters (issues #81, #82, #85). Empty strings
  // mean "no filter"; when any is set the feed is re-fetched narrowed to it.
  const [filters, setFilters] = useState({ search: '', category: '', urgency: '' });
  // Skill areas this volunteer lists on their profile (from the Volunteer row).
  // `skills` is the flat list of names used by dashboard stats; `skillsDetailed`
  // holds the { name, level } objects the Skills view edits.
  const [skills, setSkills] = useState([]);
  const [skillsDetailed, setSkillsDetailed] = useState([]);
  const [savingSkills, setSavingSkills] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tracks the request id currently being submitted, so we can show a loading
  // state on just that card's button.
  const [interactingId, setInteractingId] = useState(null);
  // Request id currently being withdrawn ("un-sign up") from the Tasks list.
  const [withdrawingId, setWithdrawingId] = useState(null);
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
      // When "Near me" is on, ask the backend to geo-radius filter the feed;
      // category/urgency/keyword filters (issues #81, #82) narrow it further.
      setFeed(await getPrioritizedRequests(near, filters));
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
      try {
        setSkillsDetailed(await getVolunteerSkillsDetailed());
      } catch {
        setSkillsDetailed([]);
      }
      try {
        setAvailableTasks(await getAvailableTasks());
      } catch {
        setAvailableTasks([]);
      }
    } catch (err) {
      setError(requestErrorMessage(err, t('volunteer.errors.loadRequests')));
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

  // Volunteer clicked "I can help with this" on a feed card.
  const handleInteract = async (request) => {
    setInteractingId(request.id);
    setError('');
    try {
      const result = await expressInterest(request.id);
      setConfirmations((prev) => ({
        ...prev,
        [request.id]: result.message || t('volunteer.confirmations.interestRecorded'),
      }));
      // Refresh so the request stays in the feed as "signed up" (offering to
      // help moves it to "assigned", which would otherwise drop it) and the
      // card flips to a Withdraw action.
      await loadData({ silent: true });
    } catch (err) {
      setError(requestErrorMessage(err, t('volunteer.errors.recordInterest')));
    } finally {
      setInteractingId(null);
    }
  };

  // Volunteer clicked "Mark as helped" on a task. Completes the request, then
  // reloads so the card reflects its new completed status.
  const handleMarkHelped = async (request) => {
    setMarkingId(request.id);
    setError('');
    try {
      await markRequestHelped(request.id);
      await loadData({ silent: true });
    } catch (err) {
      setError(requestErrorMessage(err, t('volunteer.errors.markHelped')));
    } finally {
      setMarkingId(null);
    }
  };

  // Volunteer clicked "Un-sign up" on a task. Withdraw interest, then drop it
  // from the local interests list so the Tasks view updates immediately.
  const handleWithdraw = async (request) => {
    setWithdrawingId(request.id);
    setError('');
    try {
      await withdrawInterest(request.id);
      setInterests((prev) => prev.filter((r) => r.id !== request.id));
      // Also clear any "interest recorded" confirmation so the feed card resets.
      setConfirmations((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      // Reload so the request reappears in the feed as sign-up-able (the backend
      // rolls it back to pending when no volunteers remain) and any of its tasks
      // this volunteer was signed up for drop off the available-tasks list.
      await loadData({ silent: true });
    } catch (err) {
      setError(requestErrorMessage(err, t('volunteer.errors.withdraw')));
    } finally {
      setWithdrawingId(null);
    }
  };

  // Volunteer clicked "Sign up" on an available org task. On success, reload so
  // the card flips to "Signed up" and the volunteer count updates.
  const handleSignUpTask = async (task) => {
    setTaskBusyId(task.id);
    setError('');
    try {
      await signUpForTask(task.id);
      await loadData({ silent: true });
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not sign up for the task. Please try again.'));
    } finally {
      setTaskBusyId(null);
    }
  };

  // Volunteer clicked "Withdraw" on a task they'd signed up for.
  const handleWithdrawTask = async (task) => {
    setTaskBusyId(task.id);
    setError('');
    try {
      await withdrawFromTask(task.id);
      await loadData({ silent: true });
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not withdraw from the task. Please try again.'));
    } finally {
      setTaskBusyId(null);
    }
  };

  // Save the volunteer's edited skills (names + 1–5 proficiency). On success we
  // update both the detailed list and the flat name list the stats use.
  const handleSaveSkills = async (nextSkills) => {
    setSavingSkills(true);
    try {
      const saved = await updateVolunteerSkills(nextSkills);
      setSkillsDetailed(saved);
      setSkills(saved.map((s) => s.name));
    } finally {
      setSavingSkills(false);
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

  // The Active Help Requests feed a volunteer sees. The prioritized feed only
  // returns pending/in-progress requests, so a request drops off it the moment
  // this volunteer offers to help (their interest moves it to "assigned"). To
  // keep signed-up requests visible — with a Withdraw action instead of vanishing
  // — we merge the volunteer's still-active interests back into the feed and tag
  // every request with a `signedUp` flag.
  const activeFeed = useMemo(() => {
    // Requests the volunteer is currently signed up for (exclude finished ones).
    const isFinished = (r) =>
      r.responseStatus === 'completed' || ['fulfilled', 'closed'].includes(r.status);
    const signedUpInterests = interests.filter((r) => !isFinished(r));
    const signedUpIds = new Set(signedUpInterests.map((r) => r.id));

    const feedIds = new Set(feed.map((r) => r.id));
    // Interests that have left the prioritized feed (now "assigned") still belong
    // in the volunteer's view so they can withdraw.
    const extras = signedUpInterests.filter((r) => !feedIds.has(r.id));

    return [...feed, ...extras].map((r) => ({
      ...r,
      signedUp: signedUpIds.has(r.id),
    }));
  }, [feed, interests]);

  // The dashboard "Tasks" bar shows the org-created tasks this volunteer has
  // signed up for, with a dated chip from each task's scheduled volunteer day.
  const tasks = useMemo(() => {
    return availableTasks
      .filter((task) => task.signedUp)
      .map((task) => {
        const d = task.volunteerDate ? new Date(task.volunteerDate) : null;
        return {
          date: d ? d.getDate() : '—',
          month: d ? d.toLocaleString(undefined, { month: 'short' }) : '',
          title: task.title || task.category || 'Task',
        };
      });
  }, [availableTasks]);

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
          requests={activeFeed}
          loading={loading}
          error={error}
          onRetry={loadData}
          onInteract={handleInteract}
          interactingId={interactingId}
          confirmations={confirmations}
          onWithdraw={handleWithdraw}
          withdrawingId={withdrawingId}
          near={near}
          onNearChange={setNear}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {view === 'tasks' && (
        <>
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#1C2A16] dark:text-white text-center mb-1">
              Your requests
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
              Help requests you offered to help with.
            </p>
            <VolunteerTasksView
              interests={interests}
              loading={loading}
              error={error}
              onRetry={loadData}
              onWithdraw={handleWithdraw}
              withdrawingId={withdrawingId}
              onMarkHelped={handleMarkHelped}
              markingId={markingId}
            />
          </section>

          <AvailableTasksSection
            tasks={availableTasks}
            loading={loading}
            error={error}
            onRetry={loadData}
            onSignUp={handleSignUpTask}
            onWithdraw={handleWithdrawTask}
            busyId={taskBusyId}
          />
        </>
      )}

      {view === 'skills' && (
        <VolunteerSkillsView
          skills={skillsDetailed}
          loading={loading}
          error={error}
          onRetry={loadData}
          onSave={handleSaveSkills}
          saving={savingSkills}
        />
      )}

      {!['dashboard', 'requests', 'tasks', 'skills'].includes(view) && (
        <ComingSoonPanel title={VIEW_TITLES[view]} />
      )}
    </PortalShell>
  );
};

// Placeholder for nav items not yet built (Groups, etc.).
const ComingSoonPanel = ({ title, subtitle }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
      <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">{title}</h2>
      <p className="text-gray-500 dark:text-gray-400">{subtitle || t('volunteer.comingSoon')}</p>
    </div>
  );
};

export default VolunteerDashboard;
