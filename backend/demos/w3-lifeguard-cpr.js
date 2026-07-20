import { PrismaClient } from '@prisma/client';
import { prioritizeRequest } from '../services/ai/prioritizer.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Presentation seed — CPR / lifeguard water-rescue scenario.
 *
 * Builds on demos/w2-seed.js but tells a single, coherent story for the live
 * demo: a flash-flood at Riverside Park, FL where multiple people need
 * responders with common volunteer skills (CPR- and lifeguard-certified).
 *
 * Because several of these requests share a category + location, the AI
 * prioritizer's cluster-density signal fires, and the Claude reasoning on each
 * card references the *other* nearby incidents — which is exactly the behavior
 * worth showing off on stage.
 *
 * It:
 *   1. Removes any prior rows from THIS seed (idempotent — safe to re-run)
 *   2. Creates the water-rescue help requests
 *   3. Runs the real prioritizeRequest() pipeline on each
 *      (embedding -> similarity -> score -> Claude explanation -> save)
 *   4. Wires the demo volunteer's account to a few of them ("My Interests")
 *   5. Prints the final ranking
 *
 * Run from backend/:  node demos/w3-lifeguard-cpr.js
 */

// The account we present with. This volunteer will show pre-populated interests
// on the dashboard's "Skills / My Interests" tab so it isn't empty on stage.
const DEMO_VOLUNTEER_EMAIL = 'jennifer.ye@salesforce.com';

// The water-rescue scenario. Skills a volunteer HAS (CPR, lifeguard) can't live
// on the Request model, so the requests spell out the skills they NEED in the
// description — which is also what the volunteer reads when deciding to help.
// Most incidents share "Riverside Park, FL" so the cluster-density signal fires.
const SAMPLE_REQUESTS = [
  {
    submitterName: 'Grace Okafor',
    category: 'Medical',
    urgency: 'Critical',
    location: 'Riverside Park, FL',
    description:
      'Child pulled from floodwater, not breathing. Need a CPR-certified responder on scene immediately — bystanders are attempting rescue breaths now.',
  },
  {
    submitterName: 'Marcus Bell',
    category: 'Medical',
    urgency: 'Critical',
    location: 'Riverside Park, FL',
    description:
      'Two swimmers swept into the flooded river channel and trapped against debris. Need lifeguard-certified rescuers with water-rescue experience right away.',
  },
  {
    submitterName: 'Priya Nair',
    category: 'Medical',
    urgency: 'High',
    location: 'Riverside Park, FL',
    description:
      'Elderly man collapsed after wading through rising water, unresponsive but breathing. CPR-certified volunteers needed to monitor and assist until EMS arrives.',
  },
  {
    submitterName: 'Diego Herrera',
    category: 'Other',
    urgency: 'High',
    location: 'Riverside Park, FL',
    description:
      'Community pool overflowed into the rec center; several families cut off by fast-moving water. Lifeguards needed to help evacuate people to higher ground.',
  },
  {
    submitterName: 'Hannah Lund',
    category: 'Medical',
    urgency: 'Medium',
    location: 'Coral Springs, FL',
    description:
      'Evacuation shelter needs a CPR-certified volunteer on standby overnight for elderly and medically fragile residents.',
  },
];

// Names used to identify rows from THIS seed so re-running replaces them
// instead of piling up duplicates. We only ever delete unclaimed seed rows
// (userId is null), so real user-submitted requests are never touched.
const DEMO_NAMES = SAMPLE_REQUESTS.map((r) => r.submitterName);

// The requests we'll pre-express interest in on the demo volunteer's behalf,
// so "My Interests" is populated on stage. Matched by submitterName.
const PREINTEREST_NAMES = ['Grace Okafor', 'Priya Nair'];

async function clearPreviousDemoRows() {
  // Responses cascade-delete with their request, so removing the request rows
  // is enough to clear any interests we wired on a previous run too.
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

// Pre-populate the demo volunteer's "My Interests" so the dashboard tab isn't
// empty. Mirrors what POST /api/requests/:id/interact does (a volunteer
// Response with status 'offered'), and skips any that already exist so it's
// safe to re-run.
async function wireVolunteerInterests(requests) {
  const volunteer = await prisma.user.findUnique({
    where: { email: DEMO_VOLUNTEER_EMAIL },
  });

  if (!volunteer) {
    console.log(
      `  (skipped — no account found for ${DEMO_VOLUNTEER_EMAIL}; sign up first)`
    );
    return 0;
  }

  const targets = requests.filter((r) => PREINTEREST_NAMES.includes(r.submitterName));
  let wired = 0;

  for (const request of targets) {
    const existing = await prisma.response.findFirst({
      where: {
        requestId: request.id,
        responderId: volunteer.id,
        responderType: 'volunteer',
      },
    });
    if (existing) continue;

    await prisma.response.create({
      data: {
        requestId: request.id,
        responderId: volunteer.id,
        responderType: 'volunteer',
        status: 'offered',
        notes: 'CPR & lifeguard certified — can respond on scene.',
      },
    });
    wired += 1;
  }

  return wired;
}

async function seed() {
  console.log('MapResponse — Seeding CPR/lifeguard water-rescue demo\n');
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

    console.log('\nStep 2: Creating water-rescue help requests...');
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

    console.log(`\nStep 4: Wiring interests for ${DEMO_VOLUNTEER_EMAIL}...`);
    const wired = await wireVolunteerInterests(requests);
    console.log(`Recorded ${wired} new interest(s) on the demo account.`);

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
