import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PortalShell from '../components/portal/PortalShell';
import HSDashboardView from '../components/helpseeker/HSDashboardView';
import HSRequestsView from '../components/helpseeker/HSRequestsView';
import SafetyManual from '../components/SafetyManual/SafetyManual';
import ChatAssistant from '../components/ChatAssistant/ChatAssistant';
import HelpRequestForm from '../../components/HelpRequestForm/HelpRequestForm';
// Request by Voice — temporarily disabled for demo (do not remove)
// import VoiceIntakeFlow from '../components/VoiceIntake/VoiceIntakeFlow';
import VoiceCallFlow from '../components/VoiceIntake/VoiceCallFlow';
import Toast from '../components/Toast/Toast';
import api from '../utils/api';
import { getCurrentUser, logout, updateName, updatePhone, updateHousehold, updateLanguage } from '../utils/auth';
import AvatarUploader from '../components/portal/AvatarUploader';
import { isAdminSession } from '../utils/previewMode';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { usePolling } from '../hooks/usePolling';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { useDebounce } from '../hooks/useDebounce';
import { useTheme } from '../context/ThemeContext';

// Shared form field styling — one source of truth so every Settings input,
// label, help line, and Save button matches the dashboard's token-based look.
const FIELD_LABEL = 'block font-display text-lg tracking-wide text-ink mb-1';
const FIELD_HELP = 'text-sm text-ink-muted mb-3';
const FIELD_INPUT =
  'w-full px-4 py-3 rounded-xl bg-surface ring-1 ring-hairline text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-pin-500/40 transition-shadow';
const FIELD_CARD = 'bg-surface-2 rounded-2xl ring-1 ring-hairline shadow-card p-6';
const SAVE_BUTTON =
  'mt-5 px-8 py-3 bg-pin-500 text-white font-bold rounded-full hover:bg-pin-600 focus:outline-none focus:ring-2 focus:ring-pin-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const FIELD_ERROR = 'mt-3 text-sm text-pin-600 dark:text-pin-400';
const FIELD_SUCCESS = 'mt-3 text-sm text-forest-700 dark:text-forest-300';

// Views that are actually built. Anything else shows the "coming soon" panel.
const BUILT_VIEWS = new Set(['dashboard', 'requests', 'household', 'documents', 'settings']);

// A request is "active" until it's been fulfilled or closed. The dashboard shows
// only these; the Requests tab shows every request the user has made.
const ACTIVE_STATUSES = ['pending', 'assigned', 'in-progress', 'matched'];

// Fallback list for "Participating Non-Profits Near You" until the live
// organizations endpoint returns real, geolocated partners. These are real
// disaster-relief non-profits under consideration for the network; the panel
// labels them as sample data (sampleOrgsNote) and the distances are
// illustrative, so nothing here is presented as a confirmed live listing.
// logoUrl is served from each org's own domain via Clearbit's logo endpoint, so
// we don't bundle image files. If a logo fails to load, the view falls back to
// the lettered placeholder (see HSDashboardView), so the panel never breaks.
const SAMPLE_NONPROFITS = [
  { id: 1, name: 'American Red Cross', type: 'Shelter & emergency relief', distance: '1.2 mi away', logoUrl: 'https://logo.clearbit.com/redcross.org' },
  { id: 2, name: 'The Salvation Army', type: 'Food, shelter & recovery', distance: '2.1 mi away', logoUrl: 'https://logo.clearbit.com/salvationarmyusa.org' },
  { id: 3, name: 'Team Rubicon', type: 'Disaster response & cleanup', distance: '2.8 mi away', logoUrl: 'https://logo.clearbit.com/teamrubiconusa.org' },
  { id: 4, name: 'World Central Kitchen', type: 'Meals & food relief', distance: '3.4 mi away', logoUrl: 'https://logo.clearbit.com/wck.org' },
  { id: 5, name: 'Direct Relief', type: 'Medical aid & supplies', distance: '4.0 mi away', logoUrl: 'https://logo.clearbit.com/directrelief.org' },
  { id: 6, name: 'Feeding America', type: 'Food assistance', distance: '4.6 mi away', logoUrl: 'https://logo.clearbit.com/feedingamerica.org' },
];

// Help-Seeker portal. Shares the sidebar + top bar chrome with the organization
// portal (PortalShell), so both personas have the same background format.
const HelpSeekerDashboard = () => {
  // t() looks up UI text in the active language; changing the language
  // re-renders this component with the translated strings.
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // `error` is only for load failures — it renders inline in the view. Feedback
  // from an action (e.g. a failed delete) goes to `actionMessage` instead, shown
  // as a small temporary toast so it doesn't push the page content around.
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  // Whether the voice intake modal (record → review → submit) is open.
  // Request by Voice — temporarily disabled for demo (do not remove)
  // const [showVoice, setShowVoice] = useState(false);
  // Whether the conversational voice agent modal (talk → review → submit) is open.
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  // Requests-tab keyword/category/urgency filters via shared RequestFilterBar.
  const [requestFilters, setRequestFilters] = useState({ search: '', category: '', urgency: '' });
  // Global top-bar search query. Debounced so we only recompute results after
  // the user pauses typing (see searchResults below).
  const [topSearch, setTopSearch] = useState('');
  const debouncedTopSearch = useDebounce(topSearch, 200);
  // When set, the modal shows the form in edit mode for this request.
  const [editingRequest, setEditingRequest] = useState(null);
  // Controls the AI chat assistant panel (opened from the inline button).
  const [chatOpen, setChatOpen] = useState(false);
  // Which sidebar view is selected.
  const [view, setView] = useState('dashboard');
  // Who is signed in, so we can greet them and show their profile. Stateful so
  // the greeting/profile update live when the user edits their name in Settings.
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  // Settings form: the editable name, plus save state and feedback messages.
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  // Settings form: the editable phone number, plus save state and feedback.
  const [phoneInput, setPhoneInput] = useState(currentUser?.phoneNumber || '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSaved, setPhoneSaved] = useState(false);
  // Settings form: the editable household size, plus save state and feedback.
  const [householdInput, setHouseholdInput] = useState(
    currentUser?.householdSize != null ? String(currentUser.householdSize) : '',
  );
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [householdError, setHouseholdError] = useState('');
  const [householdSaved, setHouseholdSaved] = useState(false);
  // Participating organizations for the dashboard sidebar. Loaded from the API;
  // falls back to SAMPLE_NONPROFITS when the DB has none (see loadOrganizations).
  const [organizations, setOrganizations] = useState(null);
  // Settings: language save state and feedback.
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState('');
  const [languageSaved, setLanguageSaved] = useState(false);
  const navigate = useNavigate();

  // Sidebar nav, built from translations so the labels switch with the
  // language. Rebuilt each render — cheap, and keeps it always in sync.
  const NAV_GROUPS = [
    {
      heading: t('nav.general'),
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
        { id: 'requests', label: t('nav.requests'), icon: 'requests' },
        { id: 'household', label: t('nav.household'), icon: 'household' },
      ],
    },
    {
      heading: t('nav.tools'),
      items: [
        { id: 'documents', label: t('nav.documents'), icon: 'documents' },
        { id: 'settings', label: t('nav.settings'), icon: 'settings' },
      ],
    },
  ];

  const VIEW_TITLES = {
    dashboard: t('nav.dashboard'),
    requests: t('nav.requests'),
    household: t('nav.household'),
    documents: t('nav.documents'),
    settings: t('nav.settings'),
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Close the New Request / Edit modal and return to the dashboard. Used by the
  // × button, a backdrop click, and the Escape key so a user who changes their
  // mind mid-form can always back out without submitting.
  const closeRequestModal = () => {
    setShowForm(false);
    setEditingRequest(null);
  };

  // Save the chosen UI language to the user's profile and switch the live UI.
  const handleChangeLanguage = async (e) => {
    const lang = e.target.value;
    setLanguageError('');
    setLanguageSaved(false);
    setSavingLanguage(true);
    try {
      const updated = await updateLanguage(lang);
      setCurrentUser(updated);
      setLanguageSaved(true);
    } catch (err) {
      setLanguageError(
        err.response?.data?.message || err.message || t('settings.languageUpdateError'),
      );
    } finally {
      setSavingLanguage(false);
    }
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

  // Save the edited phone number, then update the live session so the Household
  // tab reflects it immediately. An empty value clears the saved number.
  const handleSavePhone = async (e) => {
    e.preventDefault();
    const trimmed = phoneInput.trim();
    setPhoneError('');
    setPhoneSaved(false);

    if (trimmed === (currentUser?.phoneNumber || '')) {
      return; // nothing changed
    }

    setSavingPhone(true);
    try {
      const updated = await updatePhone(trimmed);
      setCurrentUser(updated);
      setPhoneSaved(true);
    } catch (err) {
      setPhoneError(
        err.response?.data?.message || err.message || t('settings.phoneUpdateError'),
      );
    } finally {
      setSavingPhone(false);
    }
  };

  // Save the edited household size, then update the live session so the profile
  // card and Household tab reflect it immediately. An empty value clears it.
  const handleSaveHousehold = async (e) => {
    e.preventDefault();
    const trimmed = householdInput.trim();
    setHouseholdError('');
    setHouseholdSaved(false);

    const currentValue = currentUser?.householdSize != null ? String(currentUser.householdSize) : '';
    if (trimmed === currentValue) {
      return; // nothing changed
    }

    setSavingHousehold(true);
    try {
      // Send '' to clear; otherwise the numeric value. Backend validates range.
      const updated = await updateHousehold(trimmed === '' ? '' : Number(trimmed));
      setCurrentUser(updated);
      setHouseholdSaved(true);
    } catch (err) {
      setHouseholdError(
        err.response?.data?.message || err.message || t('settings.householdUpdateError'),
      );
    } finally {
      setSavingHousehold(false);
    }
  };

  // Save the profile fields edited inline on the dashboard home card. Only the
  // fields that actually changed are sent, so a partial edit never clears the
  // rest. Returns nothing on success; throws so the card can show an error.
  const handleSaveProfile = async ({ name, phoneNumber, householdSize }) => {
    const trimmedName = (name ?? '').trim();
    const trimmedPhone = (phoneNumber ?? '').trim();
    const trimmedHousehold = (householdSize ?? '').trim();
    const currentHousehold =
      currentUser?.householdSize != null ? String(currentUser.householdSize) : '';

    if (!trimmedName) {
      throw new Error(t('dashboardView.editNameRequired'));
    }

    let updated = currentUser;
    if (trimmedName !== (currentUser?.name || '')) {
      updated = await updateName(trimmedName);
    }
    if (trimmedPhone !== (currentUser?.phoneNumber || '')) {
      updated = await updatePhone(trimmedPhone);
    }
    if (trimmedHousehold !== currentHousehold) {
      updated = await updateHousehold(trimmedHousehold === '' ? '' : Number(trimmedHousehold));
    }
    setCurrentUser(updated);
  };

  // Load the logged-in user's requests. useCallback so the form's onCreated
  // can re-run it after a new submission.
  //
  // Pass { silent: true } for background polling refreshes so the list updates
  // in place without flashing the loading spinner.
  //
  // When the demo admin is viewing this dashboard, load ALL requests across
  // users (the global endpoint) instead of just the account's own, so the
  // Active Requests list is populated for a demo. Real help-seekers always see
  // only their own requests.
  const loadRequests = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const endpoint = isAdminSession() ? '/api/requests' : '/api/requests/my-requests';
      const { data } = await api.get(endpoint);
      setRequests(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your requests.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Load participating organizations for the sidebar. If the API returns none
  // (the DB can be sparse), fall back to the sample list so the panel is never
  // empty during a demo. On error we also fall back rather than show nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/api/organizations');
        if (cancelled) return;
        const orgs = data.data || [];
        setOrganizations(orgs.length > 0 ? orgs : SAMPLE_NONPROFITS);
      } catch {
        if (!cancelled) setOrganizations(SAMPLE_NONPROFITS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Let Escape close each modal while it's open, so backing out of a form is as
  // easy as opening it.
  useModalDismiss(showForm || Boolean(editingRequest), closeRequestModal);
  // Request by Voice — temporarily disabled for demo (do not remove)
  // useModalDismiss(showVoice, () => setShowVoice(false));
  useModalDismiss(showVoiceCall, () => setShowVoiceCall(false));

  // Auto-refresh so newly submitted requests (including voice ones) appear
  // without a manual reload (#157). Silent so it doesn't flash the spinner.
  usePolling(useCallback(() => loadRequests({ silent: true }), [loadRequests]));

  // Delete a request, then drop it from the list without a full refetch.
  const handleDelete = async (request) => {
    setDeletingId(request.id);
    setActionMessage('');
    try {
      await api.delete(`/api/requests/${request.id}`);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      setActionMessage(err.response?.data?.message || 'Could not delete that request.');
    } finally {
      setDeletingId(null);
    }
  };

  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const activeRequests = requests.filter((r) => ACTIVE_STATUSES.includes(r.status));

  // What to show in the organizations panel: real orgs once loaded, the sample
  // list while loading or as the fallback. `orgsAreSample` lets the view label
  // placeholder data honestly and skip the fake distance on real orgs.
  const displayOrganizations = organizations ?? SAMPLE_NONPROFITS;
  const orgsAreSample = organizations === null || organizations === SAMPLE_NONPROFITS;

  // Jump to the Requests tab with the top-bar query pre-loaded into the shared
  // RequestFilterBar, so selecting a request reuses the existing filter view.
  const openRequestsFiltered = useCallback((term) => {
    setRequestFilters({ search: term, category: '', urgency: '' });
    setView('requests');
  }, []);

  // Grouped results for the top-bar search: the user's own requests, nearby
  // organizations, and quick actions. Recomputed only when the debounced query
  // or the underlying data changes. Each item carries an onSelect that navigates
  // to the right place — the top bar just renders and invokes it.
  const searchResults = useMemo(() => {
    const q = debouncedTopSearch.trim().toLowerCase();
    if (!q) return [];

    // Matching requests (same fields the Requests-tab filter searches).
    const requestItems = requests
      .filter((r) =>
        [r.submitterName, r.description, r.location, r.category, r.urgency, r.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 5)
      .map((r) => ({
        id: `request-${r.id}`,
        title: r.description || r.category || t('requests.table.requestFallback'),
        subtitle: [r.category, r.urgency, r.status].filter(Boolean).join(' · '),
        onSelect: () => openRequestsFiltered(debouncedTopSearch.trim()),
      }));

    // Matching organizations. Real orgs use organizationName/resourceTypes;
    // the sample fallback uses name/type — support both shapes.
    const orgItems = displayOrganizations
      .filter((o) => {
        const types = Array.isArray(o.resourceTypes) ? o.resourceTypes.join(' ') : o.type;
        return [o.organizationName || o.name, o.description, types]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 5)
      .map((o) => ({
        id: `org-${o.id}`,
        title: o.organizationName || o.name,
        subtitle: Array.isArray(o.resourceTypes) ? o.resourceTypes.join(', ') : o.type,
        onSelect: () => setView('dashboard'),
      }));

    // Quick actions — always offer the most useful jumps, filtered by the query.
    const actionItems = [
      {
        id: 'action-new-request',
        title: t('hsSearch.actions.newRequest'),
        keywords: 'new request help create add',
        onSelect: () => setShowForm(true),
      },
      {
        id: 'action-view-requests',
        title: t('hsSearch.actions.viewRequests'),
        keywords: 'requests list my',
        onSelect: () => setView('requests'),
      },
      {
        id: 'action-safety',
        title: t('hsSearch.actions.safetyManual'),
        keywords: 'safety manual documents guide',
        onSelect: () => setView('documents'),
      },
    ].filter((a) => a.title.toLowerCase().includes(q) || a.keywords.includes(q));

    return [
      { key: 'requests', heading: t('hsSearch.groups.requests'), items: requestItems },
      { key: 'organizations', heading: t('hsSearch.groups.organizations'), items: orgItems },
      { key: 'actions', heading: t('hsSearch.groups.actions'), items: actionItems },
    ].filter((g) => g.items.length > 0);
  }, [debouncedTopSearch, requests, displayOrganizations, t, openRequestsFiltered]);

  return (
    <PortalShell
      personaLabel="Help Seeker"
      navGroups={NAV_GROUPS}
      activeView={view}
      onNavigate={setView}
      title={VIEW_TITLES[view]}
      currentUser={currentUser}
      onSignOut={handleLogout}
      searchValue={topSearch}
      onSearchChange={setTopSearch}
      searchPlaceholder={t('hsSearch.placeholder')}
      searchResults={searchResults}
    >
      {view === 'dashboard' && (
        // Request by Voice — temporarily disabled for demo (do not remove).
        // onVoiceRequest prop intentionally omitted so the voice button in
        // HSDashboardView does not render: onVoiceRequest={() => setShowVoice(true)}
        <HSDashboardView
          currentUser={currentUser}
          requests={activeRequests}
          loading={loading}
          error={error}
          deletingId={deletingId}
          onDelete={handleDelete}
          onNewRequest={() => setShowForm(true)}
          onVoiceCall={() => setShowVoiceCall(true)}
          onChat={() => setChatOpen(true)}
          onSaveProfile={handleSaveProfile}
          nonprofits={displayOrganizations}
          nonprofitsAreSample={orgsAreSample}
        />
      )}

      {view === 'requests' && (
        <HSRequestsView
          requests={requests}
          loading={loading}
          error={error}
          deletingId={deletingId}
          onDelete={handleDelete}
          onEdit={setEditingRequest}
          filters={requestFilters}
          onFiltersChange={setRequestFilters}
        />
      )}

      {view === 'household' && (
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-ink mb-1">
            {t('household.title')}
          </h2>
          <p className="text-ink-muted mb-6">
            {t('household.subtitle')}
          </p>

          {/* Account info card */}
          <div className="bg-surface-2 rounded-3xl ring-1 ring-hairline shadow-card p-6 mb-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-hairline">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser?.name || t('household.yourAccount')}
                  className="w-16 h-16 rounded-full object-cover bg-forest-100 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-forest-800 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                  {(currentUser?.name?.[0] || '?').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-display text-2xl tracking-wide text-ink truncate">
                  {currentUser?.name || t('household.yourAccount')}
                </p>
                <p className="text-sm text-ink-muted capitalize">
                  {currentUser?.role || 'help-seeker'}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-hairline">
              {[
                { label: t('household.fieldName'), value: currentUser?.name },
                { label: t('household.fieldEmail'), value: currentUser?.email },
                { label: t('household.fieldPhone'), value: currentUser?.phoneNumber },
                { label: t('household.fieldLocation'), value: currentUser?.location },
                { label: t('household.fieldHouseholdSize'), value: currentUser?.householdSize },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4 py-3">
                  <dt className="text-sm font-bold uppercase tracking-wide text-ink-muted">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-right min-w-0 truncate text-ink">
                    {row.value || (
                      <span className="text-ink-muted/70 italic">{t('common.notSetYet')}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-xs text-ink-muted italic">
            {t('household.editNote')}
          </p>
        </div>
      )}

      {view === 'settings' && (
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-ink mb-1 text-center">
            {t('settings.title')}
          </h2>
          <p className="text-ink-muted mb-8 text-center">
            {t('settings.subtitle')}
          </p>

          {/* --- Profile: photo + display name --- */}
          <SettingsSection
            title={t('settings.sectionProfile')}
            help={t('settings.sectionProfileHelp')}
          >
            {/* Profile picture: uploaded to S3, displayed via a short-lived signed URL. */}
            <AvatarUploader
              currentUser={currentUser}
              onUploaded={(url) => setCurrentUser({ ...currentUser, avatarUrl: url })}
            />

            <form onSubmit={handleSaveName} className={FIELD_CARD}>
              <label htmlFor="displayName" className={FIELD_LABEL}>
                {t('settings.displayName')}
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
                placeholder={t('settings.namePlaceholder')}
                className={FIELD_INPUT}
              />

              {nameError && <p className={FIELD_ERROR}>{nameError}</p>}
              {nameSaved && <p className={FIELD_SUCCESS}>{t('settings.nameUpdated')}</p>}

              <button
                type="submit"
                disabled={savingName || !nameInput.trim() || nameInput.trim() === currentUser?.name}
                className={SAVE_BUTTON}
              >
                {savingName ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </form>
          </SettingsSection>

          {/* --- Contact & Household --- */}
          <SettingsSection
            title={t('settings.sectionContact')}
            help={t('settings.sectionContactHelp')}
          >
            {/* Phone number: shown to responders (via the linked request) so they
                can reach the household. Optional — clearing the field removes it. */}
            <form onSubmit={handleSavePhone} className={FIELD_CARD}>
              <label htmlFor="phoneNumber" className={FIELD_LABEL}>
                {t('settings.phoneNumber')}
              </label>
              <p className={FIELD_HELP}>{t('settings.phoneHelp')}</p>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhoneError('');
                  setPhoneSaved(false);
                }}
                placeholder={t('settings.phonePlaceholder')}
                className={FIELD_INPUT}
              />

              {phoneError && <p className={FIELD_ERROR}>{phoneError}</p>}
              {phoneSaved && <p className={FIELD_SUCCESS}>{t('settings.phoneUpdated')}</p>}

              <button
                type="submit"
                disabled={savingPhone || phoneInput.trim() === (currentUser?.phoneNumber || '')}
                className={SAVE_BUTTON}
              >
                {savingPhone ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </form>

            {/* Household size: the number of people in the user's household. Shown
                on the profile card and used as the default for new requests.
                Optional — clearing the field removes it. */}
            <form onSubmit={handleSaveHousehold} className={FIELD_CARD}>
              <label htmlFor="householdSize" className={FIELD_LABEL}>
                {t('settings.householdSize')}
              </label>
              <p className={FIELD_HELP}>{t('settings.householdHelp')}</p>
              <input
                id="householdSize"
                type="number"
                min="1"
                max="100"
                value={householdInput}
                onChange={(e) => {
                  setHouseholdInput(e.target.value);
                  setHouseholdError('');
                  setHouseholdSaved(false);
                }}
                placeholder={t('settings.householdPlaceholder')}
                className={FIELD_INPUT}
              />

              {householdError && <p className={FIELD_ERROR}>{householdError}</p>}
              {householdSaved && <p className={FIELD_SUCCESS}>{t('settings.householdUpdated')}</p>}

              <button
                type="submit"
                disabled={
                  savingHousehold ||
                  householdInput.trim() ===
                    (currentUser?.householdSize != null ? String(currentUser.householdSize) : '')
                }
                className={SAVE_BUTTON}
              >
                {savingHousehold ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </form>
          </SettingsSection>

          {/* --- Preferences: appearance + language --- */}
          <SettingsSection
            title={t('settings.sectionPreferences')}
            help={t('settings.sectionPreferencesHelp')}
          >
            {/* Appearance: light / dark mode. Reads and writes the global theme
                (persisted to localStorage by ThemeProvider), so this segmented
                control stays in sync with the top-bar toggle. */}
            <div className={FIELD_CARD}>
              <p className={FIELD_LABEL}>{t('settings.appearance')}</p>
              <p className={FIELD_HELP}>{t('settings.appearanceHelp')}</p>
              <div
                role="radiogroup"
                aria-label={t('settings.appearance')}
                className="inline-flex rounded-full bg-surface-3 ring-1 ring-hairline p-1"
              >
                <AppearanceOption
                  active={!isDark}
                  onClick={() => { if (isDark) toggleTheme(); }}
                  label={t('settings.lightMode')}
                >
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
                </AppearanceOption>
                <AppearanceOption
                  active={isDark}
                  onClick={() => { if (!isDark) toggleTheme(); }}
                  label={t('settings.darkMode')}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                </AppearanceOption>
              </div>
            </div>

            {/* Language preference: switching this instantly re-renders the UI in
                the chosen language and saves the choice to the user's profile so
                it follows them across devices. Serves accessibility for
                non-English-speaking help-seekers. */}
            <div className={FIELD_CARD}>
              <label htmlFor="language" className={FIELD_LABEL}>
                {t('settings.language')}
              </label>
              <p className={FIELD_HELP}>{t('settings.languageHelp')}</p>
              <select
                id="language"
                value={currentUser?.languagePreference || 'en'}
                onChange={handleChangeLanguage}
                disabled={savingLanguage}
                className={`${FIELD_INPUT} disabled:opacity-50`}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(`languages.${lang}`)}
                  </option>
                ))}
              </select>

              {languageError && <p className={FIELD_ERROR}>{languageError}</p>}
              {languageSaved && <p className={FIELD_SUCCESS}>{t('settings.languageUpdated')}</p>}
            </div>
          </SettingsSection>
        </div>
      )}

      {view === 'documents' && <SafetyManual />}

      {!BUILT_VIEWS.has(view) && (
        <div className="bg-surface-2 rounded-3xl ring-1 ring-hairline shadow-card p-12 text-center">
          <h2 className="font-display text-3xl tracking-wide text-ink mb-2">
            {VIEW_TITLES[view]}
          </h2>
          <p className="text-ink-muted">{t('common.comingSoon')}</p>
        </div>
      )}

      {/* AI chat assistant (context-aware), opened from the inline
          "Chat with Assistant" button in the dashboard view. */}
      <ChatAssistant
        firstName={firstName}
        open={chatOpen}
        onOpenChange={setChatOpen}
        hideLauncher
        onRequestCreated={loadRequests}
      />

      {/* Make New Request / Edit Request modal. Clicking the dark backdrop
          closes it (returns to the dashboard); clicking inside the form does
          not, so a stray click while filling it in won't discard the form. */}
      {(showForm || editingRequest) && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-20"
          onClick={closeRequestModal}
        >
          <div
            className="w-full max-w-lg relative max-h-[calc(100vh-7rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeRequestModal}
              aria-label={t('common.close')}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-600 hover:text-gray-900 shadow-md text-2xl leading-none"
            >
              ×
            </button>
            {/* Top-aligned with clearance (pt-20) so the modal sits below the
                admin bar rather than being covered by it, and capped to the
                visible height with internal scroll for a tall form. */}
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl">
              <HelpRequestForm
                compact
                request={editingRequest}
                onClose={closeRequestModal}
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
        </div>
      )}

      {/* Voice agent modal: talk → review → submit. Speech recognition and
          playback both run in the browser, so this needs a mic permission but no
          audio upload. Not dismissed by a backdrop click while a call is in
          progress — Escape and the in-panel Cancel button are the ways out, so a
          stray click can't drop someone mid-sentence. */}
      {showVoiceCall && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-20">
          <div className="w-full max-w-lg relative max-h-[calc(100vh-7rem)]">
            <button
              type="button"
              onClick={() => setShowVoiceCall(false)}
              aria-label={t('common.close')}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-600 hover:text-gray-900 shadow-md text-2xl leading-none"
            >
              ×
            </button>
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl">
              <VoiceCallFlow
                onSubmitted={() => {
                  loadRequests();
                  setShowVoiceCall(false);
                }}
                onCancel={() => setShowVoiceCall(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Voice intake modal: record → review → submit.
          Request by Voice — temporarily disabled for demo (do not remove).
      {showVoice && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-20"
          onClick={() => setShowVoice(false)}
        >
          <div
            className="w-full max-w-lg relative max-h-[calc(100vh-7rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowVoice(false)}
              aria-label={t('common.close')}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-600 hover:text-gray-900 shadow-md text-2xl leading-none"
            >
              ×
            </button>
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl">
              <VoiceIntakeFlow
                onSubmitted={() => {
                  loadRequests();
                  setShowVoice(false);
                }}
                onCancel={() => setShowVoice(false)}
              />
            </div>
          </div>
        </div>
      )}
      */}

      {/* Temporary, corner-anchored feedback for actions (e.g. a failed delete).
          Auto-dismisses; never shifts page content. */}
      <Toast message={actionMessage} onDismiss={() => setActionMessage('')} />
    </PortalShell>
  );
};

// A titled group of Settings cards. The display-face heading + hairline rule
// gives the page a clear structure (Profile · Contact · Preferences) instead of
// a flat stack of look-alike cards.
const SettingsSection = ({ title, help, children }) => (
  <section className="mb-10">
    <div className="mb-4 pb-2 border-b border-hairline text-center">
      <h3 className="font-display text-2xl tracking-wide text-ink">{title}</h3>
      {help && <p className="text-sm text-ink-muted mt-0.5">{help}</p>}
    </div>
    <div className="space-y-6">{children}</div>
  </section>
);

// One segment of the light/dark appearance control. Children are the <path>/
// <circle> elements for the leading icon. The active segment gets the coral
// accent so the current mode reads at a glance.
const AppearanceOption = ({ active, onClick, label, children }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-pin-500/40 ${
      active ? 'bg-pin-500 text-white shadow-card' : 'text-ink-muted hover:text-ink'
    }`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {children}
    </svg>
    {label}
  </button>
);

export default HelpSeekerDashboard;
