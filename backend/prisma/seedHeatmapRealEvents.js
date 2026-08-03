// Reseed the heat map from REAL crisis-event ingestion.
//
// Pipeline:  fetch real events (USGS, NWS, EONET, GDACS, FEMA) -> dedupe across
// sources -> generate plausible help requests near each -> assign a distinct
// helpseeker name -> use the event's own coordinates (geocode only if missing)
// -> insert -> run the real AI prioritization on each. Stops once TARGET
// requests have been inserted, so the map gets a fixed, coherent spread.
//
// Differs from seedRealEvents.js in two ways, to match the reseed ask:
//   1. Produces a fixed TOTAL of requests (default 30), not per-source counts.
//   2. Attributes each request to a DIFFERENT helpseeker name (the generator
//      intentionally invents no names), and leaves userId null so these are
//      unclaimed demo rows that never touch a real account.
//
// Usage (from backend/):
//   DATABASE_URL="postgresql://..." node prisma/seedHeatmapRealEvents.js [--total=30]
//
// Idempotent: every row is tagged with MARKER; each run first deletes only its
// own previously-seeded rows. Real user-submitted requests are never touched.

import { PrismaClient } from '@prisma/client';
import { prioritizeRequest } from '../services/ai/prioritizer.js';
import { geocodeLocation } from '../services/geocoding/geocoder.js';
import { fetchEvents as fetchUsgsEvents } from '../services/ingestion/usgs.js';
import { fetchEvents as fetchNwsEvents } from '../services/ingestion/nws.js';
import { fetchEvents as fetchEonetEvents } from '../services/ingestion/eonet.js';
import { fetchEvents as fetchGdacsEvents } from '../services/ingestion/gdacs.js';
import { fetchEvents as fetchFemaEvents } from '../services/ingestion/fema.js';
import { dedupeEvents } from '../services/ingestion/dedupe.js';
import { generateRequestsForEvent } from '../services/ingestion/requestGenerator.js';

const SOURCES = [
  { name: 'usgs', fetch: fetchUsgsEvents },   // earthquakes (global)
  { name: 'nws', fetch: fetchNwsEvents },     // US weather alerts
  { name: 'eonet', fetch: fetchEonetEvents }, // wildfires/storms/volcanoes (global)
  { name: 'gdacs', fetch: fetchGdacsEvents }, // global disaster alerts w/ severity
  { name: 'fema', fetch: fetchFemaEvents },   // US federal disaster declarations
];

const prisma = new PrismaClient();

// Marker that identifies rows this seed owns, so re-runs replace them.
const MARKER = '[heatmap-seed]';

// The heat map only renders the continental US (see US_BOUNDS / MAX_BOUNDS in
// frontend/src/components/map/RequestMap.jsx), but our ingestion sources are
// global. Keep only events whose coordinates fall inside that frame, so every
// seeded request actually lands on the visible map instead of off in the ocean.
const US_BOUNDS = { minLat: 25.5, maxLat: 48.5, minLng: -123, maxLng: -68 };
const inContinentalUS = (e) =>
  Number.isFinite(e.latitude) &&
  Number.isFinite(e.longitude) &&
  e.latitude >= US_BOUNDS.minLat &&
  e.latitude <= US_BOUNDS.maxLat &&
  e.longitude >= US_BOUNDS.minLng &&
  e.longitude <= US_BOUNDS.maxLng;

// A pool of distinct, varied helpseeker names. We shuffle-free by walking the
// list in order and wrapping if we ever need more than we have.
const HELPSEEKER_NAMES = [
  'Maria Rodriguez', 'James Okafor', 'Ling Chen', 'David Johnson', 'Aisha Mohammed',
  'Robert Williams', 'Fatima Al-Sayed', 'Michael Brown', 'Sofia Martinez', 'Kevin Nguyen',
  'Grace Adeyemi', 'Daniel Kim', 'Emily Carter', 'Omar Hassan', 'Isabella Rossi',
  'Marcus Thompson', 'Priya Patel', 'Carlos Mendoza', 'Hannah Goldberg', 'Tyrone Jackson',
  'Yuki Tanaka', 'Nadia Petrova', 'Samuel Owusu', 'Rebecca Stern', 'Diego Ramirez',
  'Chloe Anderson', 'Ahmed Farah', 'Olivia Bennett', 'Wei Zhang', 'Jasmine Coleman',
  'Leah Fischer', 'Andre Dubois', 'Mei Lin', 'Gabriel Silva', 'Zara Hussain',
];

function parseArgs(argv) {
  const hit = argv.find((a) => a.startsWith('--total='));
  const n = hit ? Number(hit.split('=')[1]) : NaN;
  return { total: Number.isFinite(n) && n > 0 ? Math.floor(n) : 30 };
}

async function main() {
  const { total: TARGET } = parseArgs(process.argv.slice(2));
  console.log(`Reseeding heat map from real events — target: ${TARGET} requests\n`);

  // Clear only rows this seed previously created (matched by MARKER).
  const { count } = await prisma.request.deleteMany({
    where: { description: { contains: MARKER } },
  });
  if (count) console.log(`Removed ${count} previously-seeded heat-map request(s).\n`);

  // 1. Fetch real events from every configured source. Global sources return
  //    mostly off-map events that we'll discard, so pull generously — enough
  //    that after the US filter + dedupe we still have plenty for TARGET.
  const perSource = Math.max(40, TARGET * 2);
  const fetched = [];
  for (const source of SOURCES) {
    try {
      const rows = await source.fetch({ limit: perSource });
      console.log(`  ${source.name}: ${rows.length} event(s)`);
      fetched.push(...rows);
    } catch (e) {
      console.error(`  ${source.name}: FAILED (${e.message})`);
    }
  }
  if (!fetched.length) {
    throw new Error('No events returned from any source; nothing to seed.');
  }

  // 2. Collapse cross-source duplicates (same disaster in e.g. GDACS + EONET).
  const { events, removed } = dedupeEvents(fetched);

  // 2b. Keep only events inside the continental US, since that's all the map shows.
  const usEvents = events.filter(inContinentalUS);
  console.log(
    `\nFetched ${fetched.length} event(s); ${removed} duplicate(s) merged -> ` +
      `${events.length} unique -> ${usEvents.length} in continental US.\n`
  );
  if (!usEvents.length) {
    throw new Error('No continental-US events available right now; try re-running later.');
  }

  // 3. Walk events, generating a few requests each, until we hit TARGET. Each
  //    request gets the next distinct helpseeker name.
  let inserted = 0;
  let nameIdx = 0;
  const nextName = () => HELPSEEKER_NAMES[nameIdx++ % HELPSEEKER_NAMES.length];

  for (const event of usEvents) {
    if (inserted >= TARGET) break;

    const remaining = TARGET - inserted;
    const want = Math.min(3, remaining);
    const requests = await generateRequestsForEvent(event, { count: want });
    if (!requests.length) continue;

    for (const r of requests) {
      if (inserted >= TARGET) break;

      // Prefer the event's own coordinates; geocode only if absent.
      let latitude = r.latitude;
      let longitude = r.longitude;
      if (latitude == null || longitude == null) {
        const coords = await geocodeLocation(r.location);
        latitude = coords?.latitude ?? null;
        longitude = coords?.longitude ?? null;
      }
      // A request with no coordinates can't be plotted — skip it so every
      // seeded row actually lands on the map.
      if (latitude == null || longitude == null) continue;

      const name = nextName();
      const created = await prisma.request.create({
        data: {
          userId: null, // unclaimed demo row — never tied to a real account
          submitterName: name,
          submitterRole: 'help-seeker',
          category: r.category,
          urgency: r.urgency,
          location: r.location,
          latitude,
          longitude,
          description: `${r.description} ${MARKER} (source: ${event.source})`,
          status: 'pending',
          priorityScore: 0,
        },
      });
      inserted += 1;

      // 4. Run the real AI prioritization pipeline (same path a live request takes).
      try {
        const { priorityScore } = await prioritizeRequest(created.id);
        console.log(`  ${String(inserted).padStart(2)}. ${name} — ${r.category}/${r.urgency} @ ${r.location} -> ${priorityScore}`);
      } catch (e) {
        console.error(`  ${String(inserted).padStart(2)}. ${name} — ${r.category}/${r.urgency} @ ${r.location} -> score FAILED (${e.message})`);
      }
    }
  }

  if (inserted < TARGET) {
    console.warn(`\nOnly inserted ${inserted}/${TARGET} — ran out of usable events/requests.`);
  }
  console.log(`\nDone. Inserted ${inserted} heat-map request(s) from real events.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
