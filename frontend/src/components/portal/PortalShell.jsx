import PortalSidebar from './PortalSidebar';
import PortalTopBar from './PortalTopBar';

// The full portal chrome shared by the help-seeker and organization portals:
// sage sidebar + top bar over a soft sage page background. Views render as
// children. This is the single source of truth for the portal "background
// format" the wireframes call for.
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
}) => (
  // App-shell layout: fill the available height (h-full — the viewport when
  // standalone, or the space below the admin bar when embedded there) and keep
  // the sidebar + top bar fixed while ONLY the main content scrolls. min-h-0 on
  // the flex children lets the inner scroll area shrink instead of forcing the
  // whole shell taller than its container.
  <div className="h-full flex bg-[#c9d6c2] dark:bg-[#0f1a0f] transition-colors duration-300 overflow-hidden">
    <PortalSidebar
      label={personaLabel}
      groups={navGroups}
      activeView={activeView}
      onNavigate={onNavigate}
    />

    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <PortalTopBar
        title={title}
        currentUser={currentUser}
        onSignOut={onSignOut}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        searchResults={searchResults}
      />
      <main className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  </div>
);

export default PortalShell;
