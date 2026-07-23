import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import lightModeToggle from '../../assets/light_mode_toggle.png';
import darkModeToggle from '../../assets/dark_mode_toggle.png';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../utils/notifications';

// How often to re-check for new notifications while the portal is open.
const POLL_INTERVAL_MS = 30000;

// Short relative time like "just now" / "5m" / "3h" / "2d".
const formatRelativeTime = (iso) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

// Shared top bar for both portals: page title, search, theme toggle,
// notification bell, and the signed-in user's name/avatar.
//
// @param {string} title - the current view's title (e.g. "Dashboard")
// @param {object} [currentUser] - signed-in user, for the name + sign out
// @param {() => void} [onSignOut]
const PortalTopBar = ({ title, currentUser, onSignOut }) => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const name = currentUser?.name || 'Name';

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const bellRef = useRef(null);

  // Pull the latest notifications + unread count from the backend.
  const loadNotifications = async () => {
    try {
      const { notifications: list, unreadCount: count } = await getNotifications();
      setNotifications(list);
      setUnreadCount(count);
      setError(false);
    } catch {
      // Bell failures should be quiet — the rest of the portal must keep working.
      setError(true);
    }
  };

  // Fetch on mount, then poll on an interval while the bar is mounted.
  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Opening the dropdown marks everything read (badge clears immediately, then
  // we tell the server). Closing just toggles.
  const toggleDropdown = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        await markAllNotificationsRead();
      } catch {
        // If it fails, the next poll will resync the true state.
      }
    }
  };

  // Clicking a single notification marks just it read (used when opening didn't).
  const handleNotificationClick = async (notification) => {
    if (notification.read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      // Next poll resyncs on failure.
    }
  };

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
          placeholder={t('portal.searchPlaceholder')}
          className="w-full rounded-full bg-white/90 dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 text-lg pl-12 pr-4 py-2.5 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        />
      </div>

      {/* Page title — hidden on small screens where space is tight */}
      <h1 className="hidden md:block text-3xl font-bold text-[#1C2A16] dark:text-white flex-1">
        {title}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          aria-label={t('portal.toggleDarkMode')}
          className="rounded-full hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        >
          <img
            src={isDark ? darkModeToggle : lightModeToggle}
            alt={isDark ? t('portal.darkModeEnabled') : t('portal.lightModeEnabled')}
            className="h-8 w-auto"
          />
        </button>

        {/* Notification bell + dropdown */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={toggleDropdown}
            aria-label={t('portal.notifications')}
            aria-expanded={open}
            className="relative w-10 h-10 rounded-full bg-white dark:bg-[#1f2d18] flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
          >
            <svg className="w-5 h-5 text-[#1a2332] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#6ba3d3] text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1f2d18] rounded-xl shadow-lg ring-1 ring-black/5 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10">
                <span className="font-semibold text-[#1C2A16] dark:text-white">
                  {t('portal.notifications')}
                </span>
                {notifications.some((n) => !n.read) && (
                  <button
                    type="button"
                    onClick={async () => {
                      setUnreadCount(0);
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                      try {
                        await markAllNotificationsRead();
                      } catch {
                        /* next poll resyncs */
                      }
                    }}
                    className="text-xs text-[#3a4a30] dark:text-gray-300 hover:underline"
                  >
                    {t('portal.notificationsMarkAllRead')}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {error ? (
                  <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
                    {t('portal.notificationsError')}
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
                    {t('portal.notificationsEmpty')}
                  </p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-white/10 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                        n.read ? '' : 'bg-[#6ba3d3]/10 dark:bg-[#6ba3d3]/15'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-[#6ba3d3] flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#1C2A16] dark:text-white">
                            {n.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
                            {n.message}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[#1a2332] dark:text-white font-bold">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[#1C2A16] dark:text-white font-semibold">{name}</span>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="text-left text-xs text-[#3a4a30] dark:text-gray-400 hover:underline"
              >
                {t('portal.signOut')}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default PortalTopBar;
