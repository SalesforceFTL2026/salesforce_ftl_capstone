// Daily real-event ingestion job (production).
//
// Pulls real disasters from every source, keeps only US events, dedupes across
// sources, and UPSERTS them into CrisisEvent. Unlike prisma/seedRealEvents.js
// this does NOT fabricate help requests and does NOT delete-and-recreate — it
// writes only real events and updates existing ones in place, so it's safe to
// run unattended on a schedule against a public database.
//
// Run manually:   node services/ingestion/ingestEvents.js [--events=N]
// Run on Render:   configured as a Cron Job in render.yaml (daily).
//
// Exit code is non-zero on a fatal error so the platform marks the run failed.

import prisma from '../database/prisma.js';
import { fetchEvents as fetchUsgs } from './usgs.js';
import { fetchEvents as fetchNws } from './nws.js';
import { fetchEvents as fetchEonet } from './eonet.js';
import { fetchEvents as fetchGdacs } from './gdacs.js';
import { fetchEvents as fetchFema } from './fema.js';
import { filterUnitedStates } from './usFilter.js';
import { dedupeEvents } from './dedupe.js';

const SOURCES = [
  { name: 'usgs', fetch: fetchUsgs },
  { name: 'nws', fetch: fetchNws },
  { name: 'eonet', fetch: fetchEonet },
  { name: 'gdacs', fetch: fetchGdacs },
  { name: 'fema', fetch: fetchFema },
];

// Our normalized severity (Low/Medium/High/Critical) -> CrisisEvent's existing
// vocabulary (minor/moderate/severe/catastrophic).
const SEVERITY_MAP = {
  Low: 'minor',
  Medium: 'moderate',
  High: 'severe',
  Critical: 'catastrophic',
};

// Per-source cap so a busy disaster day can't insert thousands of rows. Applied
// after the US filter, before dedupe. Overridable with --events=N.
function parseLimit(argv) {
  const hit = argv.find((a) => a.startsWith('--events='));
  const n = hit ? Number(hit.split('=')[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 25;
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));

  // 1. Fetch all sources, keep US only, then cap per source.
  const collected = [];
  for (const source of SOURCES) {
    try {
      const rows = await source.fetch();
      const usRows = filterUnitedStates(rows).slice(0, limit);
      console.log(`  ${source.name}: ${usRows.length} US event(s) (of ${rows.length})`);
      collected.push(...usRows);
    } catch (err) {
      // One source failing must not sink the whole run.
      console.error(`  ${source.name}: failed (${err.message})`);
    }
  }
  if (!collected.length) {
    console.log('No US events fetched this run; nothing to upsert.');
    return { upserted: 0, deactivated: 0 };
  }

  // 2. Collapse cross-source duplicates.
  const { events, removed } = dedupeEvents(collected);
  console.log(
    `Kept ${collected.length} US event(s); ${removed} duplicate(s) merged -> ${events.length} unique.`
  );

  // 3. Upsert each event on (source, externalId). Track which we saw this run
  //    so we can deactivate ones that have aged out of the feeds.
  const seen = [];
  let upserted = 0;
  for (const e of events) {
    const data = {
      name: e.location,
      description: e.description,
      eventType: 'natural-disaster',
      location: e.location,
      severity: SEVERITY_MAP[e.severity] || 'moderate',
      startDate: new Date(e.occurredAt),
      active: true,
      latitude: e.latitude,
      longitude: e.longitude,
      url: e.url,
    };

    await prisma.crisisEvent.upsert({
      where: { source_externalId: { source: e.source, externalId: e.externalId } },
      update: data,
      create: { ...data, source: e.source, externalId: e.externalId },
    });
    seen.push(e.externalId);
    upserted += 1;
  }

  // 4. Deactivate previously-ingested events that no longer appear in any feed
  //    (e.g. an expired NWS alert), so the live map self-cleans. We only touch
  //    ingested rows (source not null) — internal crises are never deactivated.
  const { count: deactivated } = await prisma.crisisEvent.updateMany({
    where: {
      source: { not: null },
      active: true,
      externalId: { notIn: seen },
    },
    data: { active: false },
  });

  console.log(`Upserted ${upserted} event(s); deactivated ${deactivated} stale event(s).`);
  return { upserted, deactivated };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Ingestion run failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
