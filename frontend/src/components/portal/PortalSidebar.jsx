import MRLogoMini from '../../assets/logos/MRLogoMini.png';
import { PortalIcon } from './portalIcons';

// Shared left navigation rail for both the help-seeker and organization
// portals. The persona label (e.g. "HELP SEEKER" / "ORGANIZATION") and the nav
// groups are passed in, so the two portals stay visually identical.
//
// @param {string} label - persona label under the logo
// @param {{heading: string, items: {id, label, icon}[]}[]} groups - nav groups
// @param {string} activeView - id of the current view
// @param {(id: string) => void} onNavigate
const PortalSidebar = ({ label, groups, activeView, onNavigate }) => {
  return (
    <aside className="w-20 lg:w-60 shrink-0 bg-[#9db29a] dark:bg-[#1a2417] flex flex-col transition-colors duration-300">
      {/* Logo header block */}
      <div className="bg-[#7f9976] dark:bg-[#141d11] px-3 py-4 flex flex-col items-center gap-1 transition-colors duration-300">
        <div className="bg-white rounded-xl p-1 shadow-sm">
          <img
            src={MRLogoMini}
            alt="MapResponse logo"
            className="w-12 h-12 lg:w-16 lg:h-16 object-contain"
          />
        </div>
        <span className="hidden lg:block text-[#1C2A16] dark:text-white font-bold tracking-wide text-lg text-center uppercase">
          {label}
        </span>
      </div>

      <nav className="flex-1 px-2 lg:px-3 py-4 overflow-y-auto">
        {groups.map((group, i) => (
          <div key={group.heading} className={i > 0 ? 'mt-6' : ''}>
            <p className="hidden lg:block text-[#3a4a30] dark:text-gray-400 text-sm font-semibold mb-2 px-2">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-1">
              {group.items.map(({ id, label: itemLabel, icon }) => {
                const isActive = id === activeView;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 justify-center lg:justify-start ${
                        isActive
                          ? 'bg-[#bcd4f1] text-[#1C2A16] shadow-sm'
                          : 'text-[#1C2A16] dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <PortalIcon name={icon || id} />
                      <span className="hidden lg:inline font-semibold">{itemLabel}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default PortalSidebar;
