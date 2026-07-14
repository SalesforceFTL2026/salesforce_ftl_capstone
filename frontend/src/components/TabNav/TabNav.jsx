// A simple, accessible tab bar.
//
// Renders one button per tab and highlights the active one. Uses ARIA tab
// roles so screen readers announce it as a tab list.
//
// @param {{ id: string, label: string }[]} tabs - the tabs to render
// @param {string} activeTab - id of the currently selected tab
// @param {(id: string) => void} onTabChange - called with the tab id on click

const TabNav = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div
      role="tablist"
      aria-label="Dashboard views"
      className="flex gap-2 border-b border-gray-200"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-3 text-sm sm:text-base font-semibold -mb-px border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#6ba3d3]/40 rounded-t-lg ${
              isActive
                ? 'border-[#6ba3d3] text-[#6ba3d3]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default TabNav;
