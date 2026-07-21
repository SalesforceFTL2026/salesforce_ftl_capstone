import { useState } from 'react';
import RoleSelectionModal from '../RoleSelectionModal/RoleSelectionModal';
import SignInModal from '../SignInModal/SignInModal';

// Wraps signup + login in one popup with tabs. The role (from the landing
// page card) labels the title and is passed to signup. Login ignores role —
// the account's stored role decides where the user lands.
const roleLabels = {
  'help-seeker': 'Help Seeker',
  'volunteer': 'Volunteer',
  'organization': 'Organization',
};

const AuthModal = ({ role, initialMode = 'signup', onClose, onAuthenticated }) => {
  const [mode, setMode] = useState(initialMode);

  const roleName = role ? roleLabels[role] : '';
  const title = `${roleName} ${mode === 'signup' ? 'Sign Up' : 'Login'}`.trim();

  const tabClass = (active) =>
    `flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-colors ${
      active
        ? 'bg-[#1C2A16] text-white'
        : 'bg-transparent text-gray-500 hover:text-gray-800'
    }`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
    >
      {/* Stop clicks inside the modal from bubbling up to the backdrop's close. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#273A20] rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-full overflow-y-auto"
      >
        {/* Title + close */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-black dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none -mt-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-[#1a2f1a] p-1 rounded-xl">
          <button className={tabClass(mode === 'signup')} onClick={() => setMode('signup')}>
            Sign Up
          </button>
          <button className={tabClass(mode === 'login')} onClick={() => setMode('login')}>
            Log In
          </button>
        </div>

        {/* Active form (reuses existing components in embedded mode) */}
        {mode === 'signup' ? (
          <RoleSelectionModal embedded role={role} onClose={onClose} onSubmit={onAuthenticated} />
        ) : (
          <SignInModal embedded onClose={onClose} onSuccess={onAuthenticated} />
        )}
      </div>
    </div>
  );
};

export default AuthModal;
