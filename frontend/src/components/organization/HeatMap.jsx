import { useMemo } from 'react';

// A compact "request heat map": a grid whose cells are shaded from cool (few
// needs) to hot (many needs), reading as a choropleth at a glance without
// pulling in a full mapping library. When given geocoded `requests` (issue
// #144), it bins them by location into the grid so the hot spots reflect where
// demand actually clusters. With no mappable requests it falls back to a fixed
// decorative pattern so the panel still looks intentional.
//
// @param {object[]} [requests] - requests to bin; only geocoded ones count
// @param {string} [caption] - small line under the title (e.g. "Last updated…")

const COLS = 12;
const ROWS = 6;

// 0 (coolest) … 4 (hottest) -> Tailwind background.
const HEAT_COLORS = [
  'bg-sky-300',    // 0 - coolest / no demand
  'bg-amber-200',  // 1
  'bg-orange-400', // 2
  'bg-red-500',    // 3
  'bg-red-800',    // 4 - hottest
];

// Fallback pattern when we have no coordinates to bin — a stable, intentional
// looking shape (no randomness). 0=cool … 4=hottest.
const FALLBACK_ROWS = [
  [4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 4, 3],
  [3, 4, 3, 2, 1, 0, 1, 1, 2, 3, 4, 3],
  [2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 3, 2],
  [1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 2],
  [2, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3],
  [3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4],
];

const hasCoords = (r) =>
  Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));

// Urgency contributes weight to a cell so hotter needs read hotter.
const URGENCY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// Bin geocoded requests into a ROWS x COLS grid over their bounding box and
// map each cell's count to a 0–4 heat level (scaled to the busiest cell). Also
// weight by urgency so a Critical request reads hotter than a Low one. Returns
// { levels, mappableCount } where levels is a ROWS-length array of COLS-length
// rows, or null when there aren't enough coordinates to form a meaningful map.
const binRequests = (requests) => {
  const points = requests
    .filter(hasCoords)
    .map((r) => ({
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      weight: URGENCY_WEIGHT[r.urgency] || 1,
    }));

  if (points.length === 0) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);

  // Pad a zero-width span (e.g. every request in one city) so binning is stable.
  if (maxLat === minLat) { minLat -= 0.5; maxLat += 0.5; }
  if (maxLng === minLng) { minLng -= 0.5; maxLng += 0.5; }

  const counts = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (const p of points) {
    // Column runs west->east; row runs north->south (row 0 = northernmost).
    const col = Math.min(COLS - 1, Math.floor(((p.lng - minLng) / (maxLng - minLng)) * COLS));
    const row = Math.min(ROWS - 1, Math.floor(((maxLat - p.lat) / (maxLat - minLat)) * ROWS));
    counts[row][col] += p.weight;
  }

  const peak = Math.max(...counts.flat());
  const levels = counts.map((row) =>
    row.map((c) => (c === 0 ? 0 : Math.max(1, Math.round((c / peak) * 4))))
  );

  return { levels, mappableCount: points.length };
};

const HeatMap = ({ requests, caption }) => {
  const binned = useMemo(
    () => (Array.isArray(requests) ? binRequests(requests) : null),
    [requests]
  );
  const rows = binned ? binned.levels : FALLBACK_ROWS;

  return (
    <div>
      {caption && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-2">
          {caption}
        </p>
      )}
      <div className="rounded-2xl border-4 border-[#1a2332] dark:border-[#0f1a2e] bg-[#f7f7f0] p-3 shadow-lg">
        <div className="grid grid-cols-12 gap-0.5 rounded-lg overflow-hidden">
          {rows.flatMap((row, r) =>
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
