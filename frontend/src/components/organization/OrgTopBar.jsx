import { useTheme } from '../../context/ThemeContext';
import lightModeToggle from '../../assets/light_mode_toggle.png';
import darkModeToggle from '../../assets/dark_mode_toggle.png';

// Top bar for the organization portal: page title on the left, a search box,
// theme toggle, notification bell, and the signed-in org's name on the right.
//
// @param {string} title - the current view's title (e.g. "Dashboard")
// @param {object} [currentUser] - signed-in user, for the org name + sign out
// @param {() => void} [onSignOut] - called when the org name menu signs out
const OrgTopBar = ({ title, currentUser, onSignOut }) => {
  const { isDark, toggleTheme } = useTheme();
  const orgName = currentUser?.name || 'Org Name';

  return (
    <header className="bg-[#7f9976] dark:bg-[#141d11] px-4 sm:px-6 py-4 flex items-center gap-4 transition-colors duration-300">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6ba3d3]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="Search..."
          className="w-full rounded-full bg-white/90 dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 pl-12 pr-4 py-2.5 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        />
      </div>

      {/* Page title — hidden on small screens where space is tight */}
      <h1 className="hidden md:block text-2xl font-bold text-[#1C2A16] dark:text-white flex-1">
        {title}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          aria-label="Toggle dark mode"
          className="rounded-full hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        >
          <img
            src={isDark ? darkModeToggle : lightModeToggle}
            alt={isDark ? 'Dark mode enabled' : 'Light mode enabled'}
            className="h-8 w-auto"
          />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-full bg-white dark:bg-[#1f2d18] flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity"
        >
          <svg className="w-5 h-5 text-[#1a2332] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#6ba3d3] text-white text-[10px] font-bold flex items-center justify-center">
            1
          </span>
        </button>

        {/* Org identity + sign out */}
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[#1a2332] dark:text-white font-bold">
            {orgName.charAt(0).toUpperCase()}
          </span>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[#1C2A16] dark:text-white font-semibold">{orgName}</span>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="text-left text-xs text-[#3a4a30] dark:text-gray-400 hover:underline"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default OrgTopBar;
