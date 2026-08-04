import { useState } from 'react';
import PortalSidebar from './PortalSidebar';
import PortalTopBar from './PortalTopBar';

// The full portal chrome shared by the help-seeker and organization portals:
// sage sidebar + top bar over a soft sage page background. Views render as
// children. This is the single source of truth for the portal "background
// format" the wireframes call for.
//
// On phones the sidebar collapses into a hamburger-triggered drawer (the icon
// rail wasn't intuitive at that size); this shell owns the drawer's open state
// and wires the top bar's hamburger to it.
//
// @param {string} personaLabel - sidebar persona label ("Help Seeker" / "Organization")
// @param {object[]} navGroups - sidebar nav groups (see PortalSidebar)
// @param {string} activeView
// @param {(id: string) => void} onNavigate
// @param {string} title - top bar title
// @param {object} [currentUser]
// @param {() => void} [onSignOut]
// @param {string} [searchValue] - controlled top-bar search value
// @param {(value: string) => void} [onSearchChange] - enables live top-bar search
// @param {string} [searchPlaceholder] - overrides the search placeholder
// @param {object[]} [searchResults] - grouped results for the search dropdown
// @param {React.ReactNode} children - the active view's content
const PortalShell = ({
  personaLabel, navGroups, activeView, onNavigate, title, currentUser, onSignOut,
  searchValue, onSearchChange, searchPlaceholder, searchResults, children,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    // App-shell layout: the shell grows to at least fill its container (min-h-full)
    // but expands past it when a view's content is taller, so the whole page
    // scrolls with the browser's normal scrollbar. This keeps content from being
    // trapped below the fold on shorter screens (an earlier version clipped the
    // shell to the viewport and scrolled only <main> internally, with no visible
    // scrollbar — so tall dashboards looked cut off until you zoomed out).
    <div className="min-h-full flex bg-[#c9d6c2] dark:bg-[#0f1a0f] transition-colors duration-300">
      <PortalSidebar
        label={personaLabel}
        groups={navGroups}
        activeView={activeView}
        onNavigate={onNavigate}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <PortalTopBar
          title={title}
          currentUser={currentUser}
          onSignOut={onSignOut}
          onOpenNav={() => setMobileNavOpen(true)}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchResults={searchResults}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
};

export default PortalShell;
