import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Request Model
 * Handles all database operations for help requests
 */

// Create a new help request
export const createRequest = async (requestData) => {
  const { submitterName, category, urgency, location, description, userId } = requestData;

  return await prisma.request.create({
    data: {
      submitterName: submitterName || null,
      userId: userId || null,          // link to the logged-in user when present
      category,
      urgency,
      location,
      description,
      status: 'pending',
      priorityScore: 0
    }
  });
};

// Get all requests submitted by a specific user (newest first)
export const getRequestsByUser = async (userId) => {
  return await prisma.request.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
};

// Get all requests
export const getAllRequests = async () => {
  return await prisma.request.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });
};

// Get request by ID
export const getRequestById = async (id) => {
  return await prisma.request.findUnique({
    where: { id }
  });
};

// Get prioritized requests (sorted by priority score)
// Issue #17: Include status and interaction counts
export const getPrioritizedRequests = async () => {
  const requests = await prisma.request.findMany({
    where: {
      status: {
        in: ['pending', 'in-progress'], // Only show active requests
      },
    },
    include: {
      responses: {
        select: {
          responderType: true,
        },
      },
    },
    orderBy: {
      priorityScore: 'desc',
    },
  });

  // Add interaction counts to each request
  return requests.map((request) => {
    const volunteerInterestCount = request.responses.filter(
      (r) => r.responderType === 'volunteer'
    ).length;

    const organizationRespondingCount = request.responses.filter(
      (r) => r.responderType === 'organization'
    ).length;

    // Remove the responses array and replace with counts
    const { responses, ...requestWithoutResponses } = request;

    return {
      ...requestWithoutResponses,
      volunteerInterestCount,
      organizationRespondingCount,
    };
  });
};

// Update request priority score and reasoning
export const updateRequestPriority = async (id, priorityScore, reasoning) => {
  return await prisma.request.update({
    where: { id },
    data: {
      priorityScore,
      reasoning
    }
  });
};

// Update request status
export const updateRequestStatus = async (id, status) => {
  return await prisma.request.update({
    where: { id },
    data: { status }
  });
};

// Delete request
export const deleteRequest = async (id) => {
  return await prisma.request.delete({
    where: { id }
  });
};

// Get requests by category
export const getRequestsByCategory = async (category) => {
  return await prisma.request.findMany({
    where: { category },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

// Get requests by urgency
export const getRequestsByUrgency = async (urgency) => {
  return await prisma.request.findMany({
    where: { urgency },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

// Get requests by location
export const getRequestsByLocation = async (location) => {
  return await prisma.request.findMany({
    where: {
      location: {
        contains: location,
        mode: 'insensitive'
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

export default {
  createRequest,
  getRequestsByUser,
  getAllRequests,
  getRequestById,
  getPrioritizedRequests,
  updateRequestPriority,
  updateRequestStatus,
  deleteRequest,
  getRequestsByCategory,
  getRequestsByUrgency,
  getRequestsByLocation
};
