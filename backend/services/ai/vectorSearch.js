import { PrismaClient } from '@prisma/client';
import { cosineSimilarity } from './embeddings.js';

const prisma = new PrismaClient();

/**
 * Find similar requests based on embedding similarity
 *
 * @param {number[]} embedding - The embedding vector to search with
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum number of results (default: 10)
 * @param {number} options.minSimilarity - Minimum similarity threshold (default: 0.7)
 * @param {number} options.maxHoursOld - Only include requests from last N hours (default: 24)
 * @returns {Promise<Array>} - Array of {request, similarity} objects
 */
export async function findSimilarRequests(
  embedding,
  { limit = 10, minSimilarity = 0.7, maxHoursOld = 24 } = {}
) {
  // Calculate time threshold
  const timeThreshold = new Date(Date.now() - maxHoursOld * 60 * 60 * 1000);

  // Fetch recent requests with embeddings
  const requests = await prisma.request.findMany({
    where: {
      embeddingJson: { not: null },
      createdAt: { gte: timeThreshold },
    },
    select: {
      id: true,
      category: true,
      urgency: true,
      location: true,
      description: true,
      embeddingJson: true,
      priorityScore: true,
      createdAt: true,
    },
  });

  // Calculate similarity for each request
  const similarities = requests
    .map((request) => {
      try {
        const requestEmbedding = JSON.parse(request.embeddingJson);
        const similarity = cosineSimilarity(embedding, requestEmbedding);

        return {
          request: {
            id: request.id,
            category: request.category,
            urgency: request.urgency,
            location: request.location,
            description: request.description,
            priorityScore: request.priorityScore,
            createdAt: request.createdAt,
          },
          similarity,
        };
      } catch (error) {
        console.error(`Error parsing embedding for request ${request.id}:`, error);
        return null;
      }
    })
    .filter((item) => item !== null && item.similarity >= minSimilarity);

  // Sort by similarity (highest first) and limit results
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, limit);
}
