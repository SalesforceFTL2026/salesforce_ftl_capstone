import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from './embeddings.js';
import { findSimilarRequests } from './vectorSearch.js';
import { calculatePriorityScore, getScoreBreakdown } from './scoring.js';
import { generatePriorityExplanation } from './explainer.js';

const prisma = new PrismaClient();

/**
 * Complete AI prioritization pipeline for a help request
 *
 * Steps:
 * 1. Generate embedding for the request
 * 2. Find similar requests (vector search)
 * 3. Calculate priority score
 * 4. Generate Claude explanation
 * 5. Update database with results
 *
 * @param {string} requestId - ID of the request to prioritize
 * @returns {Promise<Object>} - { priorityScore, reasoning, similarRequests }
 */
export async function prioritizeRequest(requestId) {
  try {
    // Fetch the request
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    // Step 1: Generate embedding (optional)
    const embedding = await generateEmbedding(request);

    // Step 2: Find similar requests (only if embedding exists)
    let similarRequests = [];
    if (embedding) {
      similarRequests = await findSimilarRequests(embedding, {
        limit: 10,
        minSimilarity: 0.7,
        maxHoursOld: 24,
      });
    } else {
      // Fallback: Find requests with same category and location
      similarRequests = await findSimilarRequestsFallback(request);
    }

    // Step 3: Calculate priority score
    const priorityScore = calculatePriorityScore(request, similarRequests);

    // Get score breakdown for explanation
    const scoreBreakdown = getScoreBreakdown(request, similarRequests);

    // Step 4: Generate Claude explanation
    const reasoning = await generatePriorityExplanation(
      request,
      priorityScore,
      similarRequests,
      scoreBreakdown
    );

    // Step 5: Update database with results
    await prisma.request.update({
      where: { id: requestId },
      data: {
        embeddingJson: embedding ? JSON.stringify(embedding) : null,
        priorityScore,
        reasoning,
      },
    });

    return {
      priorityScore,
      reasoning,
      similarRequests: similarRequests.map((sr) => ({
        id: sr.request.id,
        category: sr.request.category,
        location: sr.request.location,
        similarity: Math.round(sr.similarity * 100),
      })),
    };
  } catch (error) {
    console.error(`Error prioritizing request ${requestId}:`, error);
    throw error;
  }
}

/**
 * Batch prioritize multiple requests
 *
 * @param {string[]} requestIds - Array of request IDs
 * @returns {Promise<Object[]>} - Array of prioritization results
 */
export async function prioritizeRequestsBatch(requestIds) {
  const results = [];

  for (const requestId of requestIds) {
    try {
      const result = await prioritizeRequest(requestId);
      results.push({ requestId, success: true, ...result });
    } catch (error) {
      console.error(`Failed to prioritize ${requestId}:`, error.message);
      results.push({
        requestId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Re-prioritize all pending requests
 * Useful when the scoring algorithm changes
 *
 * @returns {Promise<number>} - Number of requests re-prioritized
 */
export async function reprioritizeAll() {
  const pendingRequests = await prisma.request.findMany({
    where: { status: 'pending' },
    select: { id: true },
  });

  const results = await prioritizeRequestsBatch(
    pendingRequests.map((r) => r.id)
  );

  const successCount = results.filter((r) => r.success).length;
  return successCount;
}

/**
 * Fallback similarity search when embeddings are not available
 * Finds requests with same category and location
 *
 * @param {Object} request - The request to find similar ones for
 * @returns {Promise<Array>} - Array of similar requests
 */
async function findSimilarRequestsFallback(request) {
  const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const similar = await prisma.request.findMany({
    where: {
      id: { not: request.id },
      category: request.category,
      location: request.location,
      createdAt: { gte: timeThreshold },
    },
    select: {
      id: true,
      category: true,
      urgency: true,
      location: true,
      description: true,
      priorityScore: true,
      createdAt: true,
    },
    take: 10,
  });

  // Format to match vector search results
  return similar.map((req) => ({
    request: req,
    similarity: 0.8, // Mock similarity score for consistency
  }));
}
