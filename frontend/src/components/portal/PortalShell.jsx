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
// @param {React.ReactNode} children - the active view's content
const PortalShell = ({
  personaLabel, navGroups, activeView, onNavigate, title, currentUser, onSignOut, children,
}) => (
  <div className="min-h-screen flex bg-[#c9d6c2] dark:bg-[#0f1a0f] transition-colors duration-300">
    <PortalSidebar
      label={personaLabel}
      groups={navGroups}
      activeView={activeView}
      onNavigate={onNavigate}
    />

    <div className="flex-1 flex flex-col min-w-0">
      <PortalTopBar title={title} currentUser={currentUser} onSignOut={onSignOut} />
      <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
    </div>
  </div>
);

export default PortalShell;
