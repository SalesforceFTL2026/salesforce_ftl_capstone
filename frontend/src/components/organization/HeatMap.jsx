// A lightweight, decorative "request heat map". We don't pull in a mapping
// library — instead we render a grid of cells shaded from cool (low demand) to
// hot (high demand), which reads as a choropleth at a glance and keeps the
// bundle small. Swap this for a real map (Leaflet/Mapbox) when the data exists.
//
// @param {string} [caption] - small line under the title (e.g. "Last updated…")

// A fixed pattern so the map looks intentional and stable across renders
// (no Math.random, which isn't available here anyway). 0=cool … 4=hottest.
const HEAT_ROWS = [
  [4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 4, 3],
  [3, 4, 3, 2, 1, 0, 1, 1, 2, 3, 4, 3],
  [2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 3, 2],
  [1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 2],
  [2, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3],
  [3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4],
];

const HEAT_COLORS = [
  'bg-sky-300',    // 0 - coolest
  'bg-amber-200',  // 1
  'bg-orange-400', // 2
  'bg-red-500',    // 3
  'bg-red-800',    // 4 - hottest
];

const HeatMap = ({ caption }) => {
  return (
    <div>
      {caption && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
          {caption}
        </p>
      )}
      <div className="rounded-2xl border-4 border-[#1a2332] dark:border-[#0f1a2e] bg-[#f7f7f0] p-3 shadow-lg">
        <div className="grid grid-cols-12 gap-0.5 rounded-lg overflow-hidden">
          {HEAT_ROWS.flatMap((row, r) =>
            row.map((level, c) => (
              <div
                key={`${r}-${c}`}
                className={`aspect-square ${HEAT_COLORS[level]}`}
                aria-hidden="true"
              />
            ))
          )}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span>Fewer needs</span>
        <div className="flex gap-0.5">
          {HEAT_COLORS.map((c) => (
            <span key={c} className={`w-4 h-3 rounded-sm ${c}`} />
          ))}
        </div>
        <span>More needs</span>
      </div>
    </div>
  );
};

export default HeatMap;
