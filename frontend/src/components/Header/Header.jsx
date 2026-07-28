import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import MRLogo from '../../assets/logos/MRLogo.png';

const Header = ({ currentUser, onSignInClick, onSignOutClick, onDashboardClick }) => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  // Hide the header when scrolling down, reveal it when scrolling up. We track
  // the last scroll position in a ref so the listener doesn't need to re-bind.
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  // The "Sign In" button opens a small menu so the user first picks who they
  // are (help seeker / volunteer / organization) before the login popup opens.
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef(null);

  const signInRoles = [
    { key: 'help-seeker', label: t('auth.roles.helpSeeker') },
    { key: 'volunteer', label: t('auth.roles.volunteer') },
    { key: 'organization', label: t('auth.roles.organization') },
  ];

  // Close the role menu on an outside click or the Escape key.
  useEffect(() => {
    if (!roleMenuOpen) return undefined;
    const onDocClick = (e) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target)) {
        setRoleMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setRoleMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [roleMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      // Ignore tiny jitters, and never hide while near the very top.
      if (Math.abs(currentY - lastScrollY.current) > 8) {
        setHidden(currentY > lastScrollY.current && currentY > 80);
        lastScrollY.current = currentY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-md border-b border-hairline/70 transition-[transform] duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src={MRLogo}
                alt={t('landing.header.logoAlt')}
                className="h-9 sm:h-14 w-auto object-contain"
              />
            </div>
          </div>

          {/* Navigation — links follow the page's top-to-bottom section order so
              each anchor lands on its matching section. */}
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#who-we-are" className="font-display text-ink text-xl tracking-wide hover:text-pin-500 transition-colors">
              {t('landing.header.nav.whoWeAre')}
            </a>
            <a href="#what-we-do" className="font-display text-ink text-xl tracking-wide hover:text-pin-500 transition-colors">
              {t('landing.header.nav.whatWeDo')}
            </a>
            <a href="#get-involved" className="font-display text-ink text-xl tracking-wide hover:text-pin-500 transition-colors">
              {t('landing.header.nav.howToHelp')}
            </a>
            <a href="#partner-resources" className="font-display text-ink text-xl tracking-wide hover:text-pin-500 transition-colors">
              {t('landing.header.nav.partnerResources')}
            </a>
          </nav>

          {/* Right side - Sign In, Search and Theme Toggle */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <button
                  onClick={onDashboardClick}
                  className="font-display text-ink text-xl tracking-wide hover:text-pin-500 transition-colors"
                >
                  DASHBOARD
                </button>
                <span className="hidden sm:inline font-display text-ink-muted text-xl tracking-wide">
                  {t('landing.header.greeting', { name: currentUser.name })}
                </span>
                <button
                  onClick={onSignOutClick}
                  className="font-display text-ink text-xl tracking-wide hover:text-pin-500 transition-colors"
                >
                  {t('landing.header.signOut')}
                </button>
              </>
            ) : (
              <div className="relative" ref={roleMenuRef}>
                <button
                  onClick={() => setRoleMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={roleMenuOpen}
                  className="font-display text-xl tracking-wide px-4 py-1.5 rounded-full bg-pin-500 text-white hover:bg-pin-600 transition-colors"
                >
                  {t('landing.header.signIn')}
                </button>
                {roleMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-56 bg-surface rounded-2xl shadow-card py-2 z-50 border border-hairline"
                  >
                    <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                      {t('landing.header.chooseRole')}
                    </p>
                    {signInRoles.map((r) => (
                      <button
                        key={r.key}
                        role="menuitem"
                        onClick={() => {
                          setRoleMenuOpen(false);
                          onSignInClick(r.key);
                        }}
                        className="block w-full text-left px-4 py-2 text-ink hover:bg-surface-2 transition-colors"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              className="p-2 text-ink hover:text-pin-500 transition-colors"
              aria-label={t('landing.header.searchAria')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={toggleTheme}
              role="switch"
              aria-checked={isDark}
              aria-label={t('landing.header.toggleDarkModeAria')}
              className="p-2 rounded-full text-ink hover:text-pin-500 hover:bg-surface-2 transition-colors"
            >
              {isDark ? (
                // Sun — click to return to light mode
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
                </svg>
              ) : (
                // Moon — click for dark mode
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
