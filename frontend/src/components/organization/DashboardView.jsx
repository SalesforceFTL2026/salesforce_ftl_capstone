import HeatMap from './HeatMap';

// Dashboard landing view for an organization. Left: greeting, a metrics chart
// card, and three headline stat pills. Right: the request heat map and an
// upcoming-tasks list. Numbers are derived from the priority feed where we
// have real data, and fall back to representative figures otherwise.
//
// @param {object} [currentUser] - to greet the org by name
// @param {object} stats - { completedPct, peopleHelped, resourcesAvailable }
// @param {{date: string, month: string, title: string}[]} tasks - upcoming tasks
const DashboardView = ({ currentUser, stats, tasks }) => {
  const orgName = currentUser?.name || 'org';

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(320px,420px)] gap-6">
      {/* Left column */}
      <div className="bg-[#dce8f7] dark:bg-[#16233a] rounded-3xl p-6 sm:p-8 transition-colors duration-300">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C2A16] dark:text-white mb-6">
          Hello, {orgName}!
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Metrics card */}
          <div className="bg-[#9db29a] dark:bg-[#1f3320] rounded-2xl p-5 flex-1 transition-colors duration-300">
            <h3 className="text-lg font-bold text-[#1C2A16] dark:text-white mb-3 text-center">
              METRICS
            </h3>
            <div className="bg-white rounded-xl p-3">
              <MetricsChart />
            </div>
            <button
              type="button"
              className="mt-4 w-full flex items-center justify-center gap-3 rounded-full bg-[#7c8ba0] dark:bg-[#2b3b55] text-white font-semibold py-2.5 border-2 border-dashed border-[#1a2332] dark:border-[#6ba3d3] hover:opacity-90 transition-opacity"
            >
              Analyze
              <span className="w-7 h-7 rounded-full bg-[#7f9976] flex items-center justify-center">→</span>
            </button>
          </div>

          {/* Stat pills */}
          <div className="flex flex-row md:flex-col gap-4 justify-center">
            <StatPill value={stats.completedPct} label="Requests Completed" tone="sage" />
            <StatPill value={stats.peopleHelped} label="People Helped" tone="navy" />
            <StatPill value={stats.resourcesAvailable} label="Resources Available" tone="forest" />
          </div>
        </div>
      </div>

      {/* Right column: heat map + tasks */}
      <div className="bg-[#5b8bb0] dark:bg-[#16233a] rounded-3xl p-6 transition-colors duration-300">
        <h2 className="text-2xl font-bold text-white text-center mb-4">Request Heat Map</h2>
        <HeatMap />
        <p className="text-white font-semibold text-center mt-4 mb-4">
          Where are we responding today?
        </p>

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-bold uppercase tracking-wide text-sm">Tasks</h3>
          <button className="text-white/90 text-xs font-semibold uppercase hover:underline">
            View all
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {tasks.map((task, i) => (
            <li
              key={i}
              className="flex items-center gap-4 bg-[#7a2e2e] rounded-2xl p-3 text-white"
            >
              <div className="w-14 h-14 rounded-xl bg-[#efe9dd] text-[#1C2A16] flex flex-col items-center justify-center leading-none shrink-0">
                <span className="text-lg font-bold">{task.date}</span>
                <span className="text-[10px] font-semibold uppercase">{task.month}</span>
              </div>
              <span className="font-semibold">{task.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Three stacked pills. Each has a small circular "tab" on top like the mockup.
const PILL_TONES = {
  sage: 'bg-[#8a9b7a]',
  navy: 'bg-[#1a2740]',
  forest: 'bg-[#203818]',
};

const StatPill = ({ value, label, tone }) => (
  <div className="relative">
    <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-black/20" />
    <div className={`relative ${PILL_TONES[tone]} rounded-3xl px-6 py-4 text-center text-white shadow-md min-w-[130px]`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase underline decoration-1 underline-offset-2 mt-1">
        {label}
      </p>
    </div>
  </div>
);

// A tiny three-series line chart drawn with inline SVG — no chart library.
const SERIES = [
  { color: '#1a2740', points: '0,46 18,40 36,42 54,30 72,33 90,22 108,25 126,14 144,17 160,10' },
  { color: '#e07a3f', points: '0,52 18,48 36,45 54,44 72,36 90,40 108,30 126,34 144,26 160,30' },
  { color: '#2f7d6b', points: '0,56 18,54 36,50 54,52 72,46 90,48 108,42 126,44 144,40 160,38' },
];

function MetricsChart() {
  return (
    <svg viewBox="0 0 160 64" className="w-full h-24" preserveAspectRatio="none" role="img" aria-label="Metrics trend chart">
      {SERIES.map((s) => (
        <polyline
          key={s.color}
          points={s.points}
          fill="none"
          stroke={s.color}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export default DashboardView;
