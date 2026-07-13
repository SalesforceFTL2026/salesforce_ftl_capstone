import { useTheme } from '../../context/ThemeContext';

function Header() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#79A7ED]/86 dark:bg-[#1a2332] shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg width="40" height="40" viewBox="0 0 50 50" className="text-[#a8c5a8] sm:w-[50px] sm:h-[50px]">
                <circle cx="25" cy="25" r="23" fill="currentColor" />
                <text x="25" y="20" textAnchor="middle" className="text-[#1e5a3a] font-bold text-2xl">M</text>
                <text x="25" y="35" textAnchor="middle" className="text-[#c84444] font-bold text-xl">R</text>
                <circle cx="32" cy="18" r="4" fill="#c84444" />
              </svg>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#give" className="text-[#1C2A16] dark:text-white text-sm font-medium hover:opacity-70 transition-opacity">
              GIVE
            </a>
            <a href="#what-we-do" className="text-[#1C2A16] dark:text-white text-sm font-medium hover:opacity-70 transition-opacity">
              WHAT WE DO
            </a>
            <a href="#who-we-are" className="text-[#1C2A16] dark:text-white text-sm font-medium hover:opacity-70 transition-opacity">
              WHO WE ARE
            </a>
            <a href="#how-to-help" className="text-[#1C2A16] dark:text-white text-sm font-medium hover:opacity-70 transition-opacity">
              HOW TO HELP
            </a>
            <a href="#partner-resources" className="text-[#1C2A16] dark:text-white text-sm font-medium hover:opacity-70 transition-opacity">
              PARTNER RESOURCES
            </a>
            <a href="#get-help" className="text-[#1C2A16] dark:text-white text-sm font-medium hover:opacity-70 transition-opacity">
              GET HELP
            </a>
          </nav>

          {/* Right side - Search and Theme Toggle */}
          <div className="flex items-center gap-3">
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
              className="flex items-center bg-white dark:bg-gray-700 rounded-full p-0.5 w-14 h-7 relative transition-colors duration-300"
              aria-label="Toggle theme"
            >
              <div className={`absolute w-6 h-6 rounded-full transition-transform ${isDark ? 'translate-x-7 bg-[#1e3a5f]' : 'translate-x-0 bg-yellow-400'}`}>
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute top-1 left-1 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute top-1 left-1 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,6a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V5A1,1,0,0,0,12,6ZM5.64,8.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-1.41-1.42A1,1,0,0,0,4.22,6.64ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm.64,5.95a1,1,0,0,0-1.41,1.41l1.41,1.42a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.42ZM12,18a1,1,0,0,0-1,1v2a1,1,0,0,0,2,0V19A1,1,0,0,0,12,18ZM18.36,17.64a1,1,0,0,0-1.41,1.41l1.41,1.42a1,1,0,0,0,1.41-1.42ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-2.64-3a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29l1.41-1.42a1,1,0,1,0-1.41-1.41L18.36,6.64A1,1,0,0,0,18.36,8.05ZM12,8a4,4,0,1,0,4,4A4,4,0,0,0,12,8Z"/>
                  </svg>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
