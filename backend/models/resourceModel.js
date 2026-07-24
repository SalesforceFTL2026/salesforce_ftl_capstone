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

// List only the resources an org currently has available (quantity > 0 and
// marked available). Used to feed the AI advisor and the allocation picker.
export const getAvailableResourcesByOrg = async (organizationId) => {
  return await prisma.resource.findMany({
    where: { organizationId, available: true, quantity: { gt: 0 } },
    orderBy: { createdAt: 'desc' },
  });
};

// All allocations for a given request, with the resource each draws from.
export const getAllocationsByRequest = async (requestId) => {
  return await prisma.resourceAllocation.findMany({
    where: { requestId },
    include: { resource: true },
    orderBy: { createdAt: 'desc' },
  });
};

// Assign `quantity` units of a resource to a request. Done in a transaction so
// the resource's on-hand quantity is decremented atomically with creating the
// allocation; the resource is flipped unavailable once it hits zero. Throws if
// there isn't enough on hand.
export const allocateResource = async ({ resourceId, requestId, quantity, note }) => {
  return await prisma.$transaction(async (tx) => {
    const resource = await tx.resource.findUnique({ where: { id: resourceId } });
    if (!resource) {
      throw new Error('Resource not found.');
    }
    if (quantity > resource.quantity) {
      throw new Error(
        `Only ${resource.quantity} ${resource.unit} of ${resource.name} on hand.`
      );
    }

    const remaining = resource.quantity - quantity;
    await tx.resource.update({
      where: { id: resourceId },
      data: { quantity: remaining, available: remaining > 0 },
    });

    return await tx.resourceAllocation.create({
      data: { resourceId, requestId, quantity, note: note || null },
      include: { resource: true },
    });
  });
};

// Load a single allocation (used to check ownership before removing it).
export const getAllocationById = async (id) => {
  return await prisma.resourceAllocation.findUnique({
    where: { id },
    include: { resource: true },
  });
};

// Remove an allocation, returning its quantity to the resource's on-hand count
// and marking the resource available again. Transactional, mirroring allocate.
export const deallocateResource = async (id) => {
  return await prisma.$transaction(async (tx) => {
    const allocation = await tx.resourceAllocation.findUnique({ where: { id } });
    if (!allocation) {
      throw new Error('Allocation not found.');
    }

    await tx.resource.update({
      where: { id: allocation.resourceId },
      data: {
        quantity: { increment: allocation.quantity },
        available: true,
      },
    });

    await tx.resourceAllocation.delete({ where: { id } });
    return true;
  });
};

export default {
  getOrCreateOrgProfile,
  getResourcesByOrg,
  createResource,
  getResourceById,
  setResourceAvailability,
  deleteResource,
  getAvailableResourcesByOrg,
  getAllocationsByRequest,
  allocateResource,
  getAllocationById,
  deallocateResource,
};
