// One-off backfill: geocode every existing Request that has a location but no
// coordinates yet, so requests created before the map feature still show up on
// the map. New requests are geocoded at creation time (see requestController),
// so this only needs to run once after deploying the lat/lng migration.
//
// Usage (from backend/):  node prisma/backfillRequestCoordinates.js
//
// Safe to re-run: it only touches requests that are still missing coordinates,
// and skips (leaves untouched) any whose location can't be geocoded.
import { PrismaClient } from '@prisma/client';
import { geocodeLocation } from '../services/geocoding/geocoder.js';

const prisma = new PrismaClient();

async function main() {
  // Requests with a location but no coordinates recorded yet.
  const pending = await prisma.request.findMany({
    where: {
      location: { not: '' },
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { id: true, location: true },
  });

  console.log(`Found ${pending.length} request(s) missing coordinates.`);

  let updated = 0;
  let skipped = 0;
  for (const r of pending) {
    const coords = await geocodeLocation(r.location);
    if (!coords) {
      skipped++;
      console.log(`  skip: could not geocode "${r.location}" (${r.id})`);
      continue;
    }
    await prisma.request.update({
      where: { id: r.id },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
    updated++;
  }

  console.log(`Backfilled ${updated} request(s); skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
