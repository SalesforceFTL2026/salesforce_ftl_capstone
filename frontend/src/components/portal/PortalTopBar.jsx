import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../utils/notifications';
import { useIsAdminEmbed } from '../../context/AdminEmbedContext';

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

// Shared top bar for both portals: page title, search, notification bell, and
// the signed-in user's name/avatar. Theme is switched from Settings, not here.
//
// The search box is only interactive when a portal wires it up: pass
// `onSearchChange` (and `searchResults`) to make it a live, controlled search
// with a grouped results dropdown. Portals that omit those props get the
// original decorative box, so this stays reusable and backward-compatible.
//
// @param {string} title - the current view's title (e.g. "Dashboard")
// @param {object} [currentUser] - signed-in user, for the name + sign out
// @param {() => void} [onSignOut]
// @param {string} [searchValue] - controlled value of the search input
// @param {(value: string) => void} [onSearchChange] - enables live search
// @param {string} [searchPlaceholder] - overrides the placeholder text
// @param {{key: string, heading: string, items: {id: string, title: string, subtitle?: string, onSelect: () => void}[]}[]} [searchResults]
//        grouped results to show in the dropdown while there's a query
const PortalTopBar = ({
  title,
  currentUser,
  onSignOut,
  onOpenNav,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  searchResults = [],
}) => {
  const { t } = useTranslation();
  const name = currentUser?.name || 'Name';

  // When embedded in the admin view switcher, the admin bar already shows a
  // "Sign out", so suppress this one to avoid two sign-out buttons (issue #242).
  const isAdminEmbed = useIsAdminEmbed();
  const showSignOut = onSignOut && !isAdminEmbed;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const bellRef = useRef(null);

  // Live-search state. `searchable` gates every search behavior so a portal
  // that doesn't pass onSearchChange keeps the plain, decorative input.
  const searchable = typeof onSearchChange === 'function';
  const [searchOpen, setSearchOpen] = useState(false);
  // On phones the field is collapsed to an icon to save room; tapping expands it
  // to a full-width bar. From sm up it's always inline, so this is a no-op there.
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const hasQuery = searchable && searchValue.trim().length > 0;
  const showResults = searchOpen && hasQuery;
  const resultCount = searchResults.reduce((sum, g) => sum + g.items.length, 0);

  const openSearch = () => {
    setSearchExpanded(true);
    if (searchable) setSearchOpen(true);
  };
  const closeSearch = () => {
    setSearchExpanded(false);
    setSearchOpen(false);
  };

  // When the mobile field expands, move focus into it so the user can type.
  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus();
  }, [searchExpanded]);

  // Close the results dropdown (and collapse the mobile field) on outside click.
  useEffect(() => {
    if (!searchOpen && !searchExpanded) return undefined;
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen, searchExpanded]);

  // Run a result's action, then clear the query and close — so the box resets
  // and the user lands on the view/item they picked.
  const handleSelectResult = (item) => {
    item.onSelect?.();
    onSearchChange('');
    setSearchOpen(false);
  };

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
    <header className="relative bg-[#7f9976] dark:bg-[#141d11] px-4 sm:px-6 py-4 flex items-center gap-3 sm:gap-4 transition-colors duration-300">
      {/* Hamburger — opens the nav drawer. Only below lg, where the sidebar rail
          is hidden. Hidden while the mobile search field is expanded over the bar. */}
      {onOpenNav && !searchExpanded && (
        <button
          type="button"
          onClick={onOpenNav}
          aria-label={t('portal.openMenu', { defaultValue: 'Open menu' })}
          className="lg:hidden shrink-0 w-10 h-10 rounded-full bg-white/90 dark:bg-[#1f2d18] flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        >
          <svg className="w-5 h-5 text-[#1a2332] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Collapsed search button — phones only, and only while not expanded. It
          saves room in the cramped top bar; tapping expands the field to fill
          the bar. From sm up the inline field below is always shown instead. */}
      {!searchExpanded && (
        <button
          type="button"
          onClick={openSearch}
          aria-label={t('portal.searchPlaceholder')}
          className="sm:hidden shrink-0 w-10 h-10 rounded-full bg-white/90 dark:bg-[#1f2d18] flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        >
          <svg className="w-5 h-5 text-[#6ba3d3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      )}

      {/* Search field. Inline (flex-1) from sm up. On phones it's hidden until
          the button above expands it, at which point it's positioned to fill
          the whole bar (over the other controls) so it isn't squeezed. */}
      <div
        className={`sm:relative sm:flex-1 sm:block sm:max-w-md sm:inset-auto sm:px-0 sm:bg-transparent ${
          searchExpanded
            ? 'absolute inset-x-0 inset-y-2 px-4 z-40 flex items-center bg-[#7f9976] dark:bg-[#141d11]'
            : 'hidden'
        }`}
        ref={searchRef}
      >
        <div className="relative flex-1">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6ba3d3]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchInputRef}
          type="search"
          role={searchable ? 'combobox' : undefined}
          aria-label={t('portal.searchPlaceholder')}
          aria-expanded={searchable ? showResults : undefined}
          aria-controls={searchable ? 'portal-search-results' : undefined}
          placeholder={searchPlaceholder || t('portal.searchPlaceholder')}
          value={searchable ? searchValue : undefined}
          onChange={searchable ? (e) => onSearchChange(e.target.value) : undefined}
          onFocus={searchable ? () => setSearchOpen(true) : undefined}
          onKeyDown={
            searchable
              ? (e) => {
                  if (e.key === 'Escape') {
                    if (searchValue) onSearchChange('');
                    closeSearch();
                  }
                }
              : undefined
          }
          className="w-full rounded-full bg-white/90 dark:bg-[#1f2d18] text-gray-800 dark:text-gray-100 text-lg pl-12 pr-4 py-2.5 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        />

        {showResults && (
          <div
            id="portal-search-results"
            role="listbox"
            className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#1f2d18] rounded-2xl shadow-lg ring-1 ring-black/5 z-50 overflow-hidden max-h-[70vh] overflow-y-auto"
          >
            {resultCount === 0 ? (
              <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
                {t('portal.searchNoResults', { query: searchValue.trim() })}
              </p>
            ) : (
              searchResults
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="py-1">
                    <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                      {group.heading}
                    </p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => handleSelectResult(item)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <p className="text-sm font-semibold text-[#1C2A16] dark:text-white truncate">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                ))
            )}
          </div>
        )}
        </div>

        {/* Close the expanded mobile field. Hidden from sm up (field is inline). */}
        {searchExpanded && (
          <button
            type="button"
            onClick={closeSearch}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="sm:hidden shrink-0 ml-2 w-10 h-10 rounded-full bg-white/90 dark:bg-[#1f2d18] flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
          >
            <svg className="w-5 h-5 text-[#1a2332] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Page title — hidden on small screens where space is tight */}
      <h1 className="hidden md:block text-3xl font-bold text-[#1C2A16] dark:text-white flex-1">
        {title}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-3 ml-auto">
        <Link
          to="/"
          className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#1f2d18] text-[#1C2A16] dark:text-white text-sm font-bold hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
        >
          HOME
        </Link>
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
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-500">
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
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={name}
              className="w-10 h-10 rounded-full object-cover bg-gray-200 dark:bg-gray-600"
            />
          ) : (
            <span className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[#1a2332] dark:text-white font-bold">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          {/* Name only shows on >= sm; on phones the avatar stands in for it. */}
          <span className="hidden sm:block text-[#1C2A16] dark:text-white font-semibold leading-tight">
            {name}
          </span>
          {/* Sign out must be reachable on every screen size, so it lives
              OUTSIDE the name column (which is hidden on mobile). Without this,
              phone users had no way to log out of the portal. */}
          {showSignOut && (
            <button
              onClick={onSignOut}
              className="text-xs text-[#3a4a30] dark:text-gray-300 hover:underline whitespace-nowrap"
            >
              {t('portal.signOut')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default PortalTopBar;
