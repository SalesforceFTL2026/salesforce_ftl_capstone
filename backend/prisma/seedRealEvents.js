// Seed the database with help requests derived from REAL crisis events.
//
// Pipeline:  fetch real events (USGS, NWS, EONET, GDACS, FEMA) -> dedupe across
// sources -> generate plausible help requests near each -> geocode -> insert ->
// run the real AI prioritization on each. The result is a feed/map/heatmap
// populated with geographically coherent, real-world-anchored data instead of
// hand-written samples.
//
// Usage (from backend/):  node prisma/seedRealEvents.js [--events=5] [--per-event=3]
//   --events    is per-source (each adapter contributes up to this many events)
//   --per-event help requests generated per event
//
// Safe to re-run: it deletes any requests it previously created (matched by the
// "[real-event]" marker in the description) before re-inserting.
//
// Design note: we fetch the events ONCE and snapshot the generated requests
// into the DB. The demo then runs against a stable database — no live network
// call at demo time. The same adapters can be polled on a schedule in
// production (see services/ingestion/), but the demo never depends on that.

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

// Ingestion sources to seed from. Each just needs a fetchEvents({ limit }) that
// returns the shared normalized event shape — add a new source by writing an
// adapter under services/ingestion/ and appending it here.
const SOURCES = [
  { name: 'usgs', fetch: fetchUsgsEvents },   // earthquakes (global)
  { name: 'nws', fetch: fetchNwsEvents },     // US weather alerts
  { name: 'eonet', fetch: fetchEonetEvents }, // wildfires/storms/volcanoes (global)
  { name: 'gdacs', fetch: fetchGdacsEvents }, // global disaster alerts w/ severity
  { name: 'fema', fetch: fetchFemaEvents },   // US federal disaster declarations
];

const prisma = new PrismaClient();

// Marker that identifies requests this seed created, so re-runs are idempotent.
const MARKER = '[real-event]';

// The help-seeker these requests are attributed to. Falls back to the first
// help-seeker in the DB if this id is gone (survives a database reset).
const USER_ID = 'cmro46my500022d9hfxutihjs';

// Simple CLI flag parsing: --events=N and --per-event=N.
function parseArgs(argv) {
  const get = (name, fallback) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    if (!hit) return fallback;
    const n = Number(hit.split('=')[1]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  };
  return { events: get('events', 5), perEvent: get('per-event', 3) };
}

async function main() {
  const { events: eventLimit, perEvent } = parseArgs(process.argv.slice(2));

  const user =
    (await prisma.user.findUnique({ where: { id: USER_ID } })) ||
    (await prisma.user.findFirst({ where: { role: 'help-seeker' } }));
  if (!user) {
    throw new Error('No help-seeker found. Register one, then re-run this seed.');
  }

  // Clear previously-seeded real-event requests for this user.
  const { count } = await prisma.request.deleteMany({
    where: { userId: user.id, description: { contains: MARKER } },
  });
  if (count) console.log(`Removed ${count} previously-seeded real-event request(s).`);

  // 1. Fetch real events from every configured source (--events is per-source).
  const fetched = [];
  for (const source of SOURCES) {
    const rows = await source.fetch({ limit: eventLimit });
    console.log(`  ${source.name}: ${rows.length} event(s)`);
    fetched.push(...rows);
  }
  if (!fetched.length) {
    console.error('No events returned from any source; nothing to seed.');
    return;
  }

  // 2. Collapse cross-source duplicates (same disaster in e.g. GDACS + EONET).
  const { events, removed } = dedupeEvents(fetched);
  console.log(
    `Fetched ${fetched.length} event(s) across ${SOURCES.length} source(s); ` +
      `${removed} cross-source duplicate(s) merged -> ${events.length} unique.`
  );

  let inserted = 0;
  for (const event of events) {
    console.log(`\n${event.severity} · ${event.location}`);

    // 3. Generate plausible help requests anchored to this event.
    const requests = await generateRequestsForEvent(event, { count: perEvent });
    if (!requests.length) {
      console.log('  (no requests generated for this event)');
      continue;
    }

    for (const r of requests) {
      // 4. Prefer the event's own coordinates; geocode only if absent.
      let latitude = r.latitude;
      let longitude = r.longitude;
      if (latitude == null || longitude == null) {
        const coords = await geocodeLocation(r.location);
        latitude = coords?.latitude ?? null;
        longitude = coords?.longitude ?? null;
      }

      const created = await prisma.request.create({
        data: {
          userId: user.id,
          submitterName: user.name,
          submitterRole: 'help-seeker',
          category: r.category,
          urgency: r.urgency,
          location: r.location,
          latitude,
          longitude,
          // Tag the description so the seed stays idempotent, and note the source.
          description: `${r.description} ${MARKER} (source: ${event.source})`,
          status: 'pending',
          priorityScore: 0,
        },
      });
      inserted += 1;

      // 5. Run the real AI prioritization pipeline (same path a live request takes).
      try {
        const { priorityScore } = await prioritizeRequest(created.id);
        console.log(`  ${r.category} (${r.urgency}) -> score ${priorityScore}`);
      } catch (e) {
        console.error(`  Could not score ${r.category} request:`, e.message);
      }
    }
  }

  console.log(`\nSeeded ${inserted} real-event request(s) for ${user.email}.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
