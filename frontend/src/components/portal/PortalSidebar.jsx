import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MRLogo from '../../assets/logos/MRLogo.png';
import { PortalIcon } from './portalIcons';

// Shared left navigation for both the help-seeker and organization portals.
//
// Two presentations, one nav config:
//   • lg and up  — a static labeled rail pinned to the left of the shell.
//   • below lg   — a slide-in drawer opened by the top bar's hamburger. The
//     icon-only rail was replaced here because the glyphs alone weren't
//     intuitive on a phone; the drawer shows full labels in a standard stack.
//
// @param {string} label - persona label under the logo
// @param {{heading: string, items: {id, label, icon}[]}[]} groups - nav groups
// @param {string} activeView - id of the current view
// @param {(id: string) => void} onNavigate
// @param {boolean} mobileOpen - whether the mobile drawer is open
// @param {() => void} onCloseMobile - close the mobile drawer
const PortalSidebar = ({ label, groups, activeView, onNavigate, mobileOpen, onCloseMobile }) => {
  const { t } = useTranslation();

  // On mobile, tapping an item navigates and then closes the drawer.
  const handleNavigate = (id) => {
    onNavigate(id);
    onCloseMobile?.();
  };

  // Close the drawer on Escape while it's open.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  // The nav body — shared by both the desktop rail and the mobile drawer.
  const navBody = (
    <>
      {/* Logo header block */}
      <div className="bg-[#7f9976] dark:bg-[#141d11] px-3 py-4 flex flex-col items-center gap-1 transition-colors duration-300">
        <div className="p-1 rounded-xl dark:bg-white/75">
          <img
            src={MRLogo}
            alt={t('portal.logoAlt', { brand: 'MapResponse' })}
            className="h-14 lg:h-16 w-auto object-contain"
          />
        </div>
        <span className="text-[#1C2A16] dark:text-white font-bold tracking-wide text-lg text-center uppercase">
          {label}
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {groups.map((group, i) => (
          <div key={group.heading} className={i > 0 ? 'mt-6' : ''}>
            <p className="text-[#3a4a30] dark:text-gray-400 text-base font-semibold mb-2 px-2">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map(({ id, label: itemLabel, icon }) => {
                const isActive = id === activeView;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => handleNavigate(id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 rounded-full px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 ${
                        isActive
                          ? 'bg-[#bcd4f1] text-[#1C2A16] shadow-sm'
                          : 'text-[#1C2A16] dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <PortalIcon name={icon || id} />
                      <span className="font-semibold text-lg">{itemLabel}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop rail — labeled, always visible from lg up. */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#9db29a] dark:bg-[#1a2417] flex-col transition-colors duration-300">
        {navBody}
      </aside>

      {/* Mobile drawer — a standard slide-in stack, below lg only. */}
      <div
        className={`lg:hidden fixed inset-0 z-[1600] ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          onClick={onCloseMobile}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Panel */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-[#9db29a] dark:bg-[#1a2417] flex flex-col shadow-2xl transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/70 dark:bg-black/30 flex items-center justify-center text-[#1C2A16] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {navBody}
        </aside>
      </div>
    </>
  );
};

export default PortalSidebar;
