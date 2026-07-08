import { PrismaClient } from '@prisma/client';
import { prioritizeRequest } from '../services/ai/prioritizer.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Demo script for AI prioritization engine
 * Creates sample requests and shows how the AI prioritizes them
 */
async function demo() {
  console.log('Crisis360 - AI Prioritization Engine Demo\n');
  console.log('='.repeat(70));

  // Check API keys
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
    console.error('\nError: ANTHROPIC_API_KEY not configured in .env file');
    console.log('Please add your Anthropic API key to backend/.env\n');
    process.exit(1);
  }

  // Check embedding providers
  const hasCohere = process.env.COHERE_API_KEY && process.env.COHERE_API_KEY !== 'your-cohere-key-here';
  const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here';

  if (hasCohere) {
    console.log('\nEmbedding Provider: Cohere (free tier)');
  } else if (hasOpenAI) {
    console.log('\nEmbedding Provider: OpenAI');
  } else {
    console.log('\nEmbedding Provider: None (using fallback similarity matching)');
  }

  try {
    // Create sample requests
    console.log('\nStep 1: Creating sample help requests...');

    const requests = await createSampleRequests();

    console.log(`Created ${requests.length} sample requests\n`);
    console.log('='.repeat(70));

    // Prioritize each request
    console.log('\nStep 2: Running AI prioritization pipeline...\n');

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      console.log(`\nRequest ${i + 1} of ${requests.length}:`);
      console.log(`Description: ${request.description.substring(0, 65)}...`);
      console.log(`Category: ${request.category} | Urgency: ${request.urgency} | Location: ${request.location}`);

      try {
        const result = await prioritizeRequest(request.id);

        console.log(`\nPriority Score: ${result.priorityScore}/100`);
        console.log(`\nAI Explanation:`);
        console.log(`"${result.reasoning}"`);

        if (result.similarRequests.length > 0) {
          console.log(`\nSimilar Requests Found: ${result.similarRequests.length}`);
          result.similarRequests.slice(0, 3).forEach((sr, idx) => {
            console.log(`  ${idx + 1}. ${sr.category} in ${sr.location} (${sr.similarity}% similarity)`);
          });
        }

        console.log('\n' + '-'.repeat(70));
      } catch (error) {
        console.error(`Error processing request: ${error.message}`);
      }

      // Small delay between requests for readability
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Show final ranking
    console.log('\n' + '='.repeat(70));
    console.log('\nStep 3: Final Priority Ranking\n');

    const rankedRequests = await prisma.request.findMany({
      where: {
        id: { in: requests.map((r) => r.id) },
      },
      orderBy: { priorityScore: 'desc' },
      select: {
        description: true,
        category: true,
        urgency: true,
        location: true,
        priorityScore: true,
        reasoning: true,
      },
    });

    rankedRequests.forEach((req, idx) => {
      console.log(`\n${idx + 1}. Priority Score: ${req.priorityScore}/100`);
      console.log(`   ${req.description.substring(0, 70)}...`);
      console.log(`   ${req.category} | ${req.urgency} | ${req.location}`);
      console.log(`   Reasoning: "${req.reasoning}"`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('\nDemo complete. All requests prioritized successfully.\n');
  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Create realistic sample requests for demo
 */
async function createSampleRequests() {
  const sampleData = [
    {
      submitterName: 'Maria Rodriguez',
      category: 'Food',
      urgency: 'Critical',
      location: 'Miami, FL',
      description: 'Family of 4 without food for 2 days after hurricane. Children are hungry and we have no water.',
    },
    {
      submitterName: 'John Smith',
      category: 'Shelter',
      urgency: 'High',
      location: 'Miami, FL',
      description: 'House flooded, need emergency shelter for tonight. 2 adults and elderly mother.',
    },
    {
      submitterName: 'Lisa Chen',
      category: 'Medical',
      urgency: 'Critical',
      location: 'Fort Lauderdale, FL',
      description: 'Diabetic patient needs insulin. Pharmacy closed due to storm, running out in 24 hours.',
    },
    {
      submitterName: 'David Johnson',
      category: 'Food',
      urgency: 'High',
      location: 'Miami, FL',
      description: 'Evacuated with nothing. Need food and drinking water for family of 5.',
    },
    {
      submitterName: 'Sarah Williams',
      category: 'Transport',
      urgency: 'Medium',
      location: 'Homestead, FL',
      description: 'Car damaged in storm, need transportation to evacuation center.',
    },
  ];

  const requests = [];

  for (const data of sampleData) {
    const request = await prisma.request.create({
      data: {
        ...data,
        submitterRole: 'help-seeker',
        status: 'pending',
      },
    });
    requests.push(request);
  }

  return requests;
}

// Run the demo
demo();
