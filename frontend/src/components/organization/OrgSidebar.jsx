import MRLogoMini from '../../assets/logos/MRLogoMini.png';

// Left navigation rail for the organization portal. Two groups — General and
// Tools — mirroring the wireframes. The active item gets a light-blue pill.
//
// @param {string} activeView - id of the current view
// @param {(id: string) => void} onNavigate - called with a nav item's id
const GENERAL = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'requests', label: 'Requests', icon: RequestsIcon },
  { id: 'metrics', label: 'Metrics', icon: MetricsIcon },
  { id: 'resources', label: 'Resources', icon: ResourcesIcon },
  { id: 'volunteers', label: 'Volunteers', icon: VolunteersIcon },
];

const TOOLS = [
  { id: 'chat', label: 'Chat', icon: ChatIcon },
  { id: 'documents', label: 'Documents', icon: DocumentsIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const OrgSidebar = ({ activeView, onNavigate }) => {
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
        <span className="hidden lg:block text-[#1C2A16] dark:text-white font-bold tracking-wide text-lg">
          ORGANIZATION
        </span>
      </div>

      <nav className="flex-1 px-2 lg:px-3 py-4 overflow-y-auto">
        <NavGroup title="General" items={GENERAL} activeView={activeView} onNavigate={onNavigate} />
        <div className="mt-6">
          <NavGroup title="Tools" items={TOOLS} activeView={activeView} onNavigate={onNavigate} />
        </div>
      </nav>
    </aside>
  );
};

const NavGroup = ({ title, items, activeView, onNavigate }) => (
  <div>
    <p className="hidden lg:block text-[#3a4a30] dark:text-gray-400 text-sm font-semibold mb-2 px-2">
      {title}
    </p>
    <ul className="flex flex-col gap-1">
      {items.map(({ id, label, icon: renderIcon }) => {
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
              {renderIcon()}
              <span className="hidden lg:inline font-semibold">{label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  </div>
);

// --- Icons (inline so we don't pull in an icon library) ---
const iconProps = {
  className: 'w-5 h-5 shrink-0',
  fill: 'none',
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 1.8,
};

function DashboardIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13a9 9 0 0118 0M12 13l4-4M12 13a1 1 0 100 2 1 1 0 000-2z" />
    </svg>
  );
}
function RequestsIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function MetricsIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V9m4 8V5m4 12v-4M5 21h14" />
    </svg>
  );
}
function ResourcesIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 17l8 4 8-4" />
    </svg>
  );
}
function VolunteersIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-1a4 4 0 00-4-4h-1m-6 5H2v-1a4 4 0 014-4h4a4 4 0 014 4v1zm-1-11a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-3H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" />
    </svg>
  );
}
function DocumentsIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h6l6 6v10a2 2 0 01-2 2z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2 2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9 2 2 0 010-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2 2 2 0 014 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9 2 2 0 010 4h-.1a1.7 1.7 0 00-1.6 1z" />
    </svg>
  );
}

export default OrgSidebar;
