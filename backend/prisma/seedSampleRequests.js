// One-off seed: populate a help-seeker account with a few sample requests so
// the Help-Seeker "Requests" tab has content to show during development.
//
// Usage (from backend/):  node prisma/seedSampleRequests.js
//
// Safe to re-run: it deletes any prior requests it created for this user
// (matched by the "[sample]" marker in the description) before re-inserting.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The help-seeker these sample requests belong to (mbasnet50@salesforce.com).
const USER_ID = 'cmrmo890500050h8g65vw8fh7';

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
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  if (!user) {
    throw new Error(`User ${USER_ID} not found. Update USER_ID in this script.`);
  }

  // Clear previously-seeded samples for this user so re-runs don't duplicate.
  const { count } = await prisma.request.deleteMany({
    where: { userId: USER_ID, description: { contains: '[sample]' } },
  });
  if (count) console.log(`Removed ${count} previously-seeded sample request(s).`);

  for (const r of SAMPLE_REQUESTS) {
    await prisma.request.create({
      data: {
        userId: USER_ID,
        submitterName: user.name,
        submitterRole: 'help-seeker',
        category: r.category,
        urgency: r.urgency,
        location: r.location,
        description: r.description,
        status: r.status,
        priorityScore: 0,
      },
    });
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
