import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';

// A settings card that toggles light/dark mode. Lives in the account settings of
// each portal (moved out of the top bar). Reads and writes the shared
// ThemeContext, so the choice persists and applies app-wide immediately.
const ThemeToggle = () => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-[#16233a] rounded-3xl shadow-md p-6 mt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
            {t('settings.appearance')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isDark ? t('settings.darkModeOn') : t('settings.lightModeOn')}
          </p>
        </div>

        {/* Track + knob switch. The whole control is one button. */}
        <button
          type="button"
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          aria-label={t('settings.toggleTheme')}
          className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/50 ${
            isDark ? 'bg-[#1e3a5f]' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform ${
              isDark ? 'translate-x-8' : 'translate-x-1'
            }`}
          >
            {isDark ? (
              // Moon
              <svg className="h-4 w-4 text-[#1e3a5f]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
              </svg>
            ) : (
              // Sun
              <svg className="h-4 w-4 text-[#e0a63f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ThemeToggle;
