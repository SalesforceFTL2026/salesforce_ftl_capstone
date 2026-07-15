import { PrismaClient } from '@prisma/client';
import { prioritizeRequest } from '../services/ai/prioritizer.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Demo seed for the AI Prioritization Engine.
 *
 * This is the same sample data and pipeline we showed in the Week 1 demo,
 * except it PERSISTS the results so the frontend can read them. It:
 *   1. Removes any prior demo rows (idempotent — safe to re-run)
 *   2. Creates the 5 sample help requests
 *   3. Runs the real prioritizeRequest() pipeline on each
 *      (embedding -> similarity -> score -> Claude explanation -> save)
 *   4. Prints the final ranking
 *
 * After running, the Volunteer Dashboard Priority Feed
 * (GET /api/requests/prioritized) shows these requests ranked by score with
 * the AI reasoning on each card.
 *
 * Run from backend/:  node demos/seed-demo.js
 */

// The Week 1 sample requests. Kept identical to demos/w1-prioritization.js so
// the frontend showcases the exact system we demoed.
const SAMPLE_REQUESTS = [
  {
    submitterName: 'Maria Rodriguez',
    category: 'Food',
    urgency: 'Critical',
    location: 'Miami, FL',
    description:
      'Family of 4 without food for 2 days after hurricane. Children are hungry and we have no water.',
  },
  {
    submitterName: 'John Smith',
    category: 'Shelter',
    urgency: 'High',
    location: 'Miami, FL',
    description:
      'House flooded, need emergency shelter for tonight. 2 adults and elderly mother.',
  },
  {
    submitterName: 'Lisa Chen',
    category: 'Medical',
    urgency: 'Critical',
    location: 'Fort Lauderdale, FL',
    description:
      'Diabetic patient needs insulin. Pharmacy closed due to storm, running out in 24 hours.',
  },
  {
    submitterName: 'David Johnson',
    category: 'Food',
    urgency: 'High',
    location: 'Miami, FL',
    description:
      'Evacuated with nothing. Need food and drinking water for family of 5.',
  },
  {
    submitterName: 'Sarah Williams',
    category: 'Transport',
    urgency: 'Medium',
    location: 'Homestead, FL',
    description:
      'Car damaged in storm, need transportation to evacuation center.',
  },
];

// Names used to identify demo rows so re-running the seed replaces them
// instead of piling up duplicates. We only ever delete unclaimed demo rows
// (userId is null), so real user-submitted requests are never touched.
const DEMO_NAMES = SAMPLE_REQUESTS.map((r) => r.submitterName);

async function clearPreviousDemoRows() {
  const result = await prisma.request.deleteMany({
    where: {
      submitterName: { in: DEMO_NAMES },
      userId: null,
    },
  });
  return result.count;
}

async function createSampleRequests() {
  const created = [];
  for (const data of SAMPLE_REQUESTS) {
    const request = await prisma.request.create({
      data: {
        ...data,
        submitterRole: 'help-seeker',
        status: 'pending',
      },
    });
    created.push(request);
  }
  return created;
}

async function seed() {
  console.log('MapResponse — Seeding AI-prioritized demo data\n');
  console.log('='.repeat(70));

  // Fail fast if the AI key is missing, since we run the real pipeline.
  if (
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here'
  ) {
    console.error('\nError: ANTHROPIC_API_KEY not configured in backend/.env');
    process.exit(1);
  }

  try {
    console.log('\nStep 1: Clearing previous demo rows...');
    const removed = await clearPreviousDemoRows();
    console.log(`Removed ${removed} previous demo request(s).`);

    console.log('\nStep 2: Creating sample help requests...');
    const requests = await createSampleRequests();
    console.log(`Created ${requests.length} sample requests.`);

    console.log('\nStep 3: Running AI prioritization pipeline...');
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      process.stdout.write(
        `  [${i + 1}/${requests.length}] ${request.category} · ${request.urgency} · ${request.location} ... `
      );
      try {
        const result = await prioritizeRequest(request.id);
        console.log(`scored ${result.priorityScore}/100`);
      } catch (error) {
        console.log(`FAILED (${error.message})`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\nFinal Priority Ranking:\n');
    const ranked = await prisma.request.findMany({
      where: { submitterName: { in: DEMO_NAMES }, userId: null },
      orderBy: { priorityScore: 'desc' },
      select: {
        category: true,
        urgency: true,
        location: true,
        priorityScore: true,
        reasoning: true,
      },
    });
    ranked.forEach((req, idx) => {
      console.log(`${idx + 1}. [${req.priorityScore}/100] ${req.category} · ${req.urgency} · ${req.location}`);
      console.log(`   "${req.reasoning}"\n`);
    });

    console.log('='.repeat(70));
    console.log('\nDone. Open the Volunteer Dashboard Priority Feed to see these ranked.\n');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
