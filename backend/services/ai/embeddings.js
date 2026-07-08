import { openai, cohere } from './clients.js';

/**
 * Generate embedding vector for a help request
 * Tries Cohere (free) first, then OpenAI, then returns null
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

  // Try Cohere first (free tier available)
  if (cohere) {
    try {
      const response = await cohere.embed({
        texts: [text],
        model: 'embed-english-light-v3.0',
        inputType: 'search_document',
      });

      return response.embeddings[0];
    } catch (error) {
      console.error('Error generating Cohere embedding:', error);
      // Fall through to try OpenAI
    }
  }

  // Try OpenAI as fallback
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here') {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating OpenAI embedding:', error);
    }
  }

  // No embedding service available
  console.log('⚠️  No embedding API configured (tried Cohere and OpenAI)');
  return null;
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
