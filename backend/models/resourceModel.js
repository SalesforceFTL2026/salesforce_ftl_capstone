import prisma from '../services/database/prisma.js';

/**
 * Resource Model
 * Database operations for an organization's inventory of resources
 * (things they have available to give out, e.g. food, wood, health care kits).
 *
 * Resources belong to an Organization profile (Resource.organizationId ->
 * Organization.id). Registration only creates the User row, so we lazily
 * create the matching Organization profile the first time an org touches
 * their resources — that's what getOrCreateOrgProfile handles.
 */

// Find the Organization profile for a user, creating an empty one if it
// doesn't exist yet. Returns the Organization row.
export const getOrCreateOrgProfile = async (userId, organizationName) => {
  const existing = await prisma.organization.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }
  return await prisma.organization.create({
    data: {
      userId,
      organizationName: organizationName || 'Organization',
    },
  });
};

// List all resources belonging to an organization profile (newest first).
export const getResourcesByOrg = async (organizationId) => {
  return await prisma.resource.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
};

// Add a resource to an organization's inventory.
export const createResource = async ({
  organizationId,
  resourceType,
  name,
  quantity,
  unit,
  available,
}) => {
  return await prisma.resource.create({
    data: {
      organizationId,
      resourceType,
      name,
      quantity,
      unit,
      available: available ?? true,
    },
  });
};

// Load a single resource (used to check ownership before update/delete).
export const getResourceById = async (id) => {
  return await prisma.resource.findUnique({ where: { id } });
};

// Update whether a resource is currently available.
export const setResourceAvailability = async (id, available) => {
  return await prisma.resource.update({
    where: { id },
    data: { available },
  });
};

// Remove a resource from an organization's inventory.
export const deleteResource = async (id) => {
  return await prisma.resource.delete({ where: { id } });
};

export default {
  getOrCreateOrgProfile,
  getResourcesByOrg,
  createResource,
  getResourceById,
  setResourceAvailability,
  deleteResource,
};
