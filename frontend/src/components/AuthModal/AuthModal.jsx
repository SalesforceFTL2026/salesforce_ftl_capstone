import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RoleSelectionModal from '../RoleSelectionModal/RoleSelectionModal';
import SignInModal from '../SignInModal/SignInModal';
import GoogleSignInButton from '../GoogleSignInButton/GoogleSignInButton';
import { googleAuth, authErrorMessage } from '../../utils/auth';
import { useModalDismiss } from '../../hooks/useModalDismiss';

// Wraps signup + login in one popup with tabs. A role is REQUIRED before any
// auth option is shown, because one email can hold a separate account per role.
// The role is passed in from the entry point (landing card / header menu); if
// it's ever missing, the modal shows a role picker first (see below). The role
// is also passed to Google sign-in and to password login/signup so the backend
// knows which account to use.
const roleLabelKeys = {
  'help-seeker': 'auth.roles.helpSeeker',
  'volunteer': 'auth.roles.volunteer',
  'organization': 'auth.roles.organization',
};

const AuthModal = ({ role: initialRole = null, initialMode = 'signup', onClose, onAuthenticated }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState(initialMode);
  // Role may arrive as a prop; if not, the user picks it in this modal first.
  const [role, setRole] = useState(initialRole);
  const [googleError, setGoogleError] = useState('');
  useModalDismiss(true, onClose);

  // Complete Google sign-in: exchange the ID token for our session, scoped to
  // the chosen role, then hand the user up to the parent (which routes them).
  const handleGoogleCredential = async (idToken) => {
    setGoogleError('');
    try {
      const user = await googleAuth({ idToken, role });
      onAuthenticated?.(user);
    } catch (err) {
      setGoogleError(authErrorMessage(err, t('auth.google.error')));
    }
  };

  const roleName = role ? t(roleLabelKeys[role]) : '';
  const action = mode === 'signup' ? t('auth.titleAction.signUp') : t('auth.titleAction.login');
  const title = t('auth.modalTitle', { role: roleName, action }).trim();

  const tabClass = (active) =>
    `flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-colors ${
      active
        ? 'bg-[#1C2A16] text-white'
        : 'bg-transparent text-gray-500 hover:text-gray-800'
    }`;

  // Shown when the modal opens without a role: the user must pick one before
  // any sign-in option appears. Selecting a role reveals the tabs/forms below.
  const rolePicker = (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {t('auth.chooseRolePrompt')}
      </p>
      {Object.keys(roleLabelKeys).map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          className="block w-full text-left px-4 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-800 dark:text-white dark:border-[#3a5230] hover:border-[#6ba3d3] transition-colors"
        >
          {t(roleLabelKeys[r])}
        </button>
      ))}
    </div>
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
    >
      {/* Stop clicks inside the modal from bubbling up to the backdrop's close. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#273A20] rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Title + close */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-black dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-600 text-3xl leading-none -mt-2"
            aria-label={t('auth.close')}
          >
            ×
          </button>
        </div>

        {/* No role yet -> pick one first. Otherwise show the auth options. */}
        {!role ? (
          rolePicker
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-[#1a2f1a] p-1 rounded-xl">
              <button className={tabClass(mode === 'signup')} onClick={() => setMode('signup')}>
                {t('auth.tabs.signUp')}
              </button>
              <button className={tabClass(mode === 'login')} onClick={() => setMode('login')}>
                {t('auth.tabs.logIn')}
              </button>
            </div>

            {/* Active form (reuses existing components in embedded mode) */}
            {mode === 'signup' ? (
              <RoleSelectionModal embedded role={role} onClose={onClose} onSubmit={onAuthenticated} />
            ) : (
              <SignInModal embedded role={role} onClose={onClose} onSuccess={onAuthenticated} />
            )}

            {/* OR divider + Google sign-in (uses the role chosen above). */}
            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span className="h-px flex-1 bg-gray-200 dark:bg-[#3a5230]" />
              {t('auth.orDivider')}
              <span className="h-px flex-1 bg-gray-200 dark:bg-[#3a5230]" />
            </div>
            <GoogleSignInButton onCredential={handleGoogleCredential} />
            {googleError && (
              <p role="alert" className="mt-3 text-center text-sm font-medium text-red-600">
                {googleError}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
