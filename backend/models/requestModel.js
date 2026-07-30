import prisma from '../services/database/prisma.js';

/**
 * Request Model
 * Handles all database operations for help requests
 */

// Create a new help request
export const createRequest = async (requestData) => {
  const { userId, submitterName, submitterRole, category, urgency, location, latitude, longitude, description, householdSize } = requestData;

  return await prisma.request.create({
    data: {
      userId: userId || null,          // link to the logged-in user when present
      submitterName: submitterName || null,
      submitterRole: submitterRole || null,
      category,
      urgency,
      location,
      latitude: latitude ?? null,      // geocoded from `location`; drives the map view
      longitude: longitude ?? null,
      description,
      householdSize: householdSize ?? null,  // optional; drives "people helped" on the volunteer dashboard
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

// Summarize whether a request has actually met the real-world conditions behind
// its "in-progress" and "fulfilled" states, so the controller can stop a status
// from being set falsely. The signals come from the org-managed work already
// tied to the request:
//   - volunteersAssigned: at least one linked volunteer task has confirmed the
//     minimum number of volunteers it needs (VolunteerTask.volunteersConfirmed
//     >= minVolunteers).
//   - resourcesAllocated: resources have been earmarked to the request (>= 1
//     ResourceAllocation) OR a linked task has confirmed its resources are ready.
//   - volunteerDatePassed: the latest scheduled volunteer day across the linked
//     tasks is set and now in the past — i.e. the work day has come and gone, so
//     the request can legitimately be marked done.
// Returns null when the request doesn't exist.
export const getRequestReadiness = async (id) => {
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      volunteerTasks: {
        select: {
          minVolunteers: true,
          volunteersConfirmed: true,
          resourcesReady: true,
          volunteerDate: true
        }
      },
      allocations: { select: { id: true } }
    }
  });

  if (!request) return null;

  const tasks = request.volunteerTasks;

  // "Required volunteers assigned" — a task has met its own minimum. minVolunteers
  // is always >= 1 (schema default + validation), so an empty task never counts.
  const volunteersAssigned = tasks.some(
    (task) => task.volunteersConfirmed >= task.minVolunteers
  );

  // "Necessary resources allocated" — either units earmarked to the request, or
  // an org that flagged a task's resources as ready.
  const resourcesAllocated =
    request.allocations.length > 0 ||
    tasks.some((task) => task.resourcesReady === true);

  // The latest scheduled volunteer day; a request with several tasks isn't done
  // until the last one's day has passed. Null when no task has a date set.
  const scheduledDates = tasks
    .map((task) => task.volunteerDate)
    .filter(Boolean)
    .map((date) => new Date(date).getTime());
  const latestVolunteerDate =
    scheduledDates.length > 0 ? new Date(Math.max(...scheduledDates)) : null;
  const volunteerDatePassed =
    latestVolunteerDate !== null && latestVolunteerDate.getTime() <= Date.now();

  return {
    volunteersAssigned,
    resourcesAllocated,
    latestVolunteerDate,
    volunteerDatePassed
  };
};

// Update a request's category and/or description.
// Used by organizations to categorize requests and add detail to them.
// Only the fields provided in `fields` are changed; anything omitted is left as-is.
export const updateRequestDetails = async (id, fields) => {
  return await prisma.request.update({
    where: { id },
    data: fields
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
  getRequestReadiness,
  updateRequestDetails,
  deleteRequest,
  getRequestsByCategory,
  getRequestsByUrgency,
  getRequestsByLocation
};
