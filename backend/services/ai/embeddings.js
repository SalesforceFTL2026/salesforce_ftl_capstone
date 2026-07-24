import { cohere } from './clients.js';

// Single embedding provider on purpose. Cosine similarity is only meaningful
// between vectors from the SAME model, so mixing providers would corrupt the
// cluster-density signal and make priority scores non-reproducible. Cohere's
// free tier is what this project provisions, so it is the one source of truth.
const EMBEDDING_MODEL = 'embed-english-light-v3.0';

/**
 * Generate embedding vector for a help request using Cohere.
 *
 * Returns null when Cohere is unavailable (no key or API error); callers fall
 * back to a non-vector similarity search so prioritization still works.
 *
 * @param {Object} request - The help request object
 * @param {string} request.category - Request category
 * @param {string} request.description - Request description
 * @param {string} request.location - Request location
 * @param {string} request.urgency - Request urgency level
 * @returns {Promise<number[]|null>} - Embedding vector or null
 */
export async function generateEmbedding(request) {
  // Combine request fields into searchable text
  const text = [
    `Category: ${request.category}`,
    `Urgency: ${request.urgency}`,
    `Location: ${request.location}`,
    `Description: ${request.description}`,
  ].join('\n');

  if (!cohere) {
    console.log('⚠️  No embedding API configured (Cohere key missing)');
    return null;
  }

  try {
    const response = await cohere.embed({
      texts: [text],
      model: EMBEDDING_MODEL,
      inputType: 'search_document',
    });

    return response.embeddings[0];
  } catch (error) {
    console.error('Error generating Cohere embedding:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 *
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score (0-1, higher = more similar)
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
