import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import MRLogo from '../../assets/logos/MRLogo.png';
import lightModeToggle from '../../assets/light_mode_toggle.png';
import darkModeToggle from '../../assets/dark_mode_toggle.png';

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
    <header className={`fixed top-0 left-0 right-0 z-50 bg-[#79A7ED]/86 dark:bg-[#1a2332] shadow-sm transition-[transform,background-color] duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src={MRLogo}
                alt={t('landing.header.logoAlt')}
                className="h-10 sm:h-[80px] w-auto object-contain"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#get-involved" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              {t('landing.header.nav.give')}
            </a>
            <a href="#what-we-do" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              {t('landing.header.nav.whatWeDo')}
            </a>
            <a href="#who-we-are" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              {t('landing.header.nav.whoWeAre')}
            </a>
            <a href="#get-involved" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              {t('landing.header.nav.howToHelp')}
            </a>
            <a href="#partner-resources" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              {t('landing.header.nav.partnerResources')}
            </a>
            <a href="#get-help" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              {t('landing.header.nav.getHelp')}
            </a>
          </nav>

          {/* Right side - Sign In, Search and Theme Toggle */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <button
                  onClick={onDashboardClick}
                  className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity"
                >
                  DASHBOARD
                </button>
                <span className="hidden sm:inline text-[#1C2A16] dark:text-white text-[22px] font-medium">
                  {t('landing.header.greeting', { name: currentUser.name })}
                </span>
                <button
                  onClick={onSignOutClick}
                  className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity"
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
                  className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity"
                >
                  {t('landing.header.signIn')}
                </button>
                {roleMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-56 bg-white dark:bg-[#273A20] rounded-xl shadow-xl py-2 z-50 ring-1 ring-black/5"
                  >
                    <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
                        className="block w-full text-left px-4 py-2 text-[18px] text-[#1C2A16] dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a2f1a] transition-colors"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              className="p-2 text-[#1C2A16] dark:text-white hover:opacity-70 transition-opacity"
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
              className="rounded-full hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50"
            >
              <img
                src={isDark ? darkModeToggle : lightModeToggle}
                alt={isDark ? t('landing.header.darkModeEnabledAlt') : t('landing.header.lightModeEnabledAlt')}
                className="h-8 w-auto"
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
