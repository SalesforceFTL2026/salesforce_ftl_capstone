import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import MRLogoMini from '../../assets/logos/MRLogoMini.png';
import lightModeToggle from '../../assets/light_mode_toggle.png';
import darkModeToggle from '../../assets/dark_mode_toggle.png';

const Header = ({ currentUser, onSignInClick, onSignOutClick }) => {
  const { isDark, toggleTheme } = useTheme();

  // Hide the header when scrolling down, reveal it when scrolling up. We track
  // the last scroll position in a ref so the listener doesn't need to re-bind.
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

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
    <header className={`fixed top-0 left-0 right-0 z-100 bg-[#79A7ED]/86 dark:bg-[#1a2332] shadow-sm transition-[transform,background-color] duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src={MRLogoMini}
                alt="MapResponse logo"
                className="w-10 h-10 sm:w-[100px] sm:h-[100px] object-contain"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#give" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              GIVE
            </a>
            <a href="#what-we-do" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              WHAT WE DO
            </a>
            <a href="#who-we-are" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              WHO WE ARE
            </a>
            <a href="#how-to-help" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              HOW TO HELP
            </a>
            <a href="#partner-resources" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              PARTNER RESOURCES
            </a>
            <a href="#get-help" className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity">
              GET HELP
            </a>
          </nav>

          {/* Right side - Sign In, Search and Theme Toggle */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <span className="hidden sm:inline text-[#1C2A16] dark:text-white text-[22px] font-medium">
                  Hi, {currentUser.name}
                </span>
                <button
                  onClick={onSignOutClick}
                  className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity"
                >
                  SIGN OUT
                </button>
              </>
            ) : (
              <button
                onClick={onSignInClick}
                className="text-[#1C2A16] dark:text-white text-[22px] font-medium hover:opacity-70 transition-opacity"
              >
                SIGN IN
              </button>
            )}
            <button
              className="p-2 text-[#1C2A16] dark:text-white hover:opacity-70 transition-opacity"
              aria-label="Search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
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
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
