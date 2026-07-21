// One-off seed: populate a help-seeker account with a few sample requests so
// the Help-Seeker "Requests" tab has content to show during development.
//
// Usage (from backend/):  node prisma/seedSampleRequests.js
//
// Safe to re-run: it deletes any prior requests it created for this user
// (matched by the "[sample]" marker in the description) before re-inserting.
import { PrismaClient } from '@prisma/client';
import { prioritizeRequest } from '../services/ai/prioritizer.js';
import { geocodeLocation } from '../services/geocoding/geocoder.js';

const prisma = new PrismaClient();

// The help-seeker these sample requests belong to. Falls back to the first
// help-seeker in the database if this exact id isn't found, so the seed keeps
// working after the DB is reset and ids change.
const USER_ID = 'cmro46my500022d9hfxutihjs';

const SAMPLE_REQUESTS = [
  {
    category: 'Food',
    urgency: 'High',
    location: 'Austin, TX 78701',
    description: 'Family of four out of groceries after flooding; need food for a few days. [sample]',
    status: 'pending',
  },
  {
    category: 'Shelter',
    urgency: 'Critical',
    location: 'Houston, TX 77002',
    description: 'Home flooded and unsafe to stay in — need emergency shelter tonight. [sample]',
    status: 'in-progress',
  },
  {
    category: 'Medical',
    urgency: 'Medium',
    location: 'Dallas, TX 75201',
    description: 'Elderly parent out of blood-pressure medication; need a refill or clinic referral. [sample]',
    status: 'pending',
  },
  {
    category: 'Transport',
    urgency: 'Low',
    location: 'San Antonio, TX 78205',
    description: 'Need a ride to a supply distribution center this weekend. [sample]',
    status: 'matched',
  },
  {
    category: 'Other',
    urgency: 'High',
    location: 'Fort Worth, TX 76102',
    description: 'Lost power for 3 days; need help finding a charging station and clean water. [sample]',
    status: 'pending',
  },
];

async function main() {
  // Prefer the configured user; otherwise grab any help-seeker so the seed
  // survives a database reset (where the hardcoded id no longer exists).
  const user =
    (await prisma.user.findUnique({ where: { id: USER_ID } })) ||
    (await prisma.user.findFirst({ where: { role: 'help-seeker' } }));
  if (!user) {
    throw new Error('No help-seeker found. Register one, then re-run this seed.');
  }

  // Clear previously-seeded samples for this user so re-runs don't duplicate.
  const { count } = await prisma.request.deleteMany({
    where: { userId: user.id, description: { contains: '[sample]' } },
  });
  if (count) console.log(`Removed ${count} previously-seeded sample request(s).`);

  for (const r of SAMPLE_REQUESTS) {
    // Geocode the sample location so it appears on the map view.
    const coords = await geocodeLocation(r.location);
    const created = await prisma.request.create({
      data: {
        userId: user.id,
        submitterName: user.name,
        submitterRole: 'help-seeker',
        category: r.category,
        urgency: r.urgency,
        location: r.location,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        description: r.description,
        status: r.status,
        priorityScore: 0,
      },
    });

    // Run the real AI prioritization pipeline so each seeded request gets a
    // genuine priority score + reasoning (same path a live request takes).
    try {
      const { priorityScore } = await prioritizeRequest(created.id);
      console.log(`  ${r.category} (${r.urgency}) -> score ${priorityScore}`);
    } catch (e) {
      console.error(`  Could not score ${r.category} request:`, e.message);
    }
  }

  console.log(`Seeded ${SAMPLE_REQUESTS.length} sample requests for ${user.email}.`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
