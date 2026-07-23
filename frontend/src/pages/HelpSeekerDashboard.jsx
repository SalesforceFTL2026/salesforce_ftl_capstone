import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PortalShell from '../components/portal/PortalShell';
import HSDashboardView from '../components/helpseeker/HSDashboardView';
import HSRequestsView from '../components/helpseeker/HSRequestsView';
import SafetyManual from '../components/SafetyManual/SafetyManual';
import ChatAssistant from '../components/ChatAssistant/ChatAssistant';
import HelpRequestForm from '../../components/HelpRequestForm/HelpRequestForm';
import VoiceIntakeFlow from '../components/VoiceIntake/VoiceIntakeFlow';
import api from '../utils/api';
import { getCurrentUser, logout, updateName, updateLanguage } from '../utils/auth';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { usePolling } from '../hooks/usePolling';

// Views that are actually built. Anything else shows the "coming soon" panel.
const BUILT_VIEWS = new Set(['dashboard', 'requests', 'household', 'documents', 'settings']);

// A request is "active" until it's been fulfilled or closed. The dashboard shows
// only these; the Requests tab shows every request the user has made.
const ACTIVE_STATUSES = ['pending', 'assigned', 'in-progress', 'matched'];

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
  // t() looks up UI text in the active language; changing the language
  // re-renders this component with the translated strings.
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  // Whether the voice intake modal (record → review → submit) is open.
  const [showVoice, setShowVoice] = useState(false);
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

  // Load the logged-in user's requests. useCallback so the form's onCreated
  // can re-run it after a new submission.
  //
  // Pass { silent: true } for background polling refreshes so the list updates
  // in place without flashing the loading spinner.
  const loadRequests = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/requests/my-requests');
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

  // Auto-refresh so newly submitted requests (including voice ones) appear
  // without a manual reload (#157). Silent so it doesn't flash the spinner.
  usePolling(useCallback(() => loadRequests({ silent: true }), [loadRequests]));

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
          requests={activeRequests}
          loading={loading}
          error={error}
          deletingId={deletingId}
          onDelete={handleDelete}
          onNewRequest={() => setShowForm(true)}
          onVoiceRequest={() => setShowVoice(true)}
          onChat={() => setChatOpen(true)}
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
          onEdit={setEditingRequest}
        />
      )}

      {view === 'household' && (
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
            {t('household.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('household.subtitle')}
          </p>

          {/* Account info card */}
          <div className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-[#5b8bb0] flex items-center justify-center text-white text-2xl font-bold shrink-0">
                {(currentUser?.name?.[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-[#1C2A16] dark:text-white truncate">
                  {currentUser?.name || t('household.yourAccount')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {currentUser?.role || 'help-seeker'}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { label: t('household.fieldName'), value: currentUser?.name },
                { label: t('household.fieldEmail'), value: currentUser?.email },
                { label: t('household.fieldPhone'), value: currentUser?.phoneNumber },
                { label: t('household.fieldLocation'), value: currentUser?.location },
                { label: t('household.fieldHouseholdSize'), value: currentUser?.householdSize },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4 py-3">
                  <dt className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-right min-w-0 truncate text-gray-800 dark:text-gray-100">
                    {row.value || (
                      <span className="text-gray-400 dark:text-gray-500 italic">{t('common.notSetYet')}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            {t('household.editNote')}
          </p>
        </div>
      )}

      {view === 'settings' && (
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C2A16] dark:text-white mb-1">
            {t('settings.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('settings.subtitle')}
          </p>

          <form
            onSubmit={handleSaveName}
            className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6"
          >
            <label
              htmlFor="displayName"
              className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2"
            >
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
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all"
            />

            {nameError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{nameError}</p>
            )}
            {nameSaved && (
              <p className="mt-3 text-sm text-green-700 dark:text-green-400">
                {t('settings.nameUpdated')}
              </p>
            )}

            <button
              type="submit"
              disabled={savingName || !nameInput.trim() || nameInput.trim() === currentUser?.name}
              className="mt-5 px-8 py-3 bg-[#1a2740] text-white font-bold rounded-full hover:bg-[#14203a] focus:outline-none focus:ring-2 focus:ring-[#1a2740]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingName ? t('settings.saving') : t('settings.saveChanges')}
            </button>
          </form>

          {/* Language preference: switching this instantly re-renders the UI in
              the chosen language and saves the choice to the user's profile so
              it follows them across devices. Serves accessibility for
              non-English-speaking help-seekers. */}
          <div className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6 mt-6">
            <label
              htmlFor="language"
              className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2"
            >
              {t('settings.language')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('settings.languageHelp')}
            </p>
            <select
              id="language"
              value={currentUser?.languagePreference || 'en'}
              onChange={handleChangeLanguage}
              disabled={savingLanguage}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-[#3a4f30] bg-white dark:bg-[#1a2f1a] text-gray-900 dark:text-white focus:outline-none focus:border-[#6ba3d3] focus:ring-2 focus:ring-[#6ba3d3]/30 transition-all disabled:opacity-50"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(`languages.${lang}`)}
                </option>
              ))}
            </select>

            {languageError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{languageError}</p>
            )}
            {languageSaved && (
              <p className="mt-3 text-sm text-green-700 dark:text-green-400">
                {t('settings.languageUpdated')}
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'documents' && <SafetyManual />}

      {!BUILT_VIEWS.has(view) && (
        <div className="bg-white dark:bg-[#16233a] rounded-3xl p-12 text-center shadow-md">
          <h2 className="text-2xl font-bold text-[#1C2A16] dark:text-white mb-2">
            {VIEW_TITLES[view]}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">{t('common.comingSoon')}</p>
        </div>
      )}

      {/* AI chat assistant (context-aware), opened from the inline
          "Chat with Assistant" button in the dashboard view. */}
      <ChatAssistant
        firstName={firstName}
        open={chatOpen}
        onOpenChange={setChatOpen}
        hideLauncher
      />

      {/* Make New Request / Edit Request modal */}
      {(showForm || editingRequest) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg relative">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingRequest(null);
              }}
              aria-label={t('common.close')}
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

      {/* Voice intake modal: record → review → submit */}
      {showVoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg relative">
            <button
              type="button"
              onClick={() => setShowVoice(false)}
              aria-label={t('common.close')}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white text-gray-600 hover:text-gray-900 shadow-md text-2xl leading-none"
            >
              ×
            </button>
            <VoiceIntakeFlow
              onSubmitted={() => {
                loadRequests();
                setShowVoice(false);
              }}
              onCancel={() => setShowVoice(false)}
            />
          </div>
        </div>
      )}
    </PortalShell>
  );
};

export default HelpSeekerDashboard;
