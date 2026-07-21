import * as resourceModel from '../models/resourceModel.js';
import * as requestModel from '../models/requestModel.js';
import prisma from '../services/database/prisma.js';
import { suggestAllocations } from '../services/ai/resourceAdvisor.js';

/**
 * Resource Controller
 * Lets an organization manage its inventory of available resources
 * (food, wood, health care kits, etc.) shown on the org dashboard.
 *
 * All endpoints are organization-only. Resources are scoped to the caller's
 * own Organization profile, so an org can only see and change its own.
 */

// The baseline resource types an org can stock. More can be added later;
// keeping this list here means the frontend and backend agree on what's valid.
const RESOURCE_TYPES = ['food', 'wood', 'health-care-kits'];

// GET /api/resources
// List the signed-in organization's resources.
export const getMyResources = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can manage resources.',
      });
    }

    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    const resources = await resourceModel.getResourcesByOrg(org.id);

    res.status(200).json({ success: true, data: resources });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resources',
      error: error.message,
    });
  }
};

// POST /api/resources
// Add a resource to the signed-in organization's inventory.
export const createResource = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can add resources.',
      });
    }

    const { resourceType, name, quantity, unit } = req.body;

    if (!resourceType || !RESOURCE_TYPES.includes(resourceType)) {
      return res.status(400).json({
        success: false,
        message: `Resource type must be one of: ${RESOURCE_TYPES.join(', ')}.`,
      });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Resource name is required.',
      });
    }

    // Quantity must be a whole number of 1 or more.
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a whole number of 1 or more.',
      });
    }
    if (!unit || typeof unit !== 'string' || unit.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Unit is required (e.g. meals, units, kits).',
      });
    }

    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    const resource = await resourceModel.createResource({
      organizationId: org.id,
      resourceType,
      name: name.trim(),
      quantity: parsedQuantity,
      unit: unit.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Resource added to your inventory.',
      data: resource,
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add resource',
      error: error.message,
    });
  }
};

// PATCH /api/resources/:id
// Toggle whether a resource is currently available.
export const updateResourceAvailability = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can update resources.',
      });
    }

    const { id } = req.params;
    const { available } = req.body;

    if (typeof available !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Provide `available` as true or false.',
      });
    }

    // Make sure the resource exists and belongs to this organization.
    const resource = await resourceModel.getResourceById(id);
    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    if (!resource || resource.organizationId !== org.id) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found.',
      });
    }

    const updated = await resourceModel.setResourceAvailability(id, available);

    res.status(200).json({
      success: true,
      message: 'Resource updated.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resource',
      error: error.message,
    });
  }
};

// DELETE /api/resources/:id
// Remove a resource from the signed-in organization's inventory.
export const deleteResource = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can delete resources.',
      });
    }

    const { id } = req.params;

    // Make sure the resource exists and belongs to this organization.
    const resource = await resourceModel.getResourceById(id);
    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    if (!resource || resource.organizationId !== org.id) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found.',
      });
    }

    await resourceModel.deleteResource(id);

    res.status(200).json({
      success: true,
      message: 'Resource removed.',
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource',
      error: error.message,
    });
  }
};

// GET /api/resources/requests/:requestId/allocations
// List the resources currently allocated to a given request.
export const getRequestAllocations = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can view resource allocations.',
      });
    }

    const { requestId } = req.params;
    const allocations = await resourceModel.getAllocationsByRequest(requestId);

    res.status(200).json({ success: true, data: allocations });
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch allocations',
      error: error.message,
    });
  }
};

// GET /api/resources/requests/:requestId/suggestions
// Ask the AI advisor which of the org's available resources to assign to a
// request, and how much of each, based on the request's profile.
export const getAllocationSuggestions = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can request allocation suggestions.',
      });
    }

    const { requestId } = req.params;
    const request = await requestModel.getRequestById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    const available = await resourceModel.getAvailableResourcesByOrg(org.id);

    const suggestions = await suggestAllocations(request, available);

    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Error generating allocation suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate suggestions',
      error: error.message,
    });
  }
};

// POST /api/resources/requests/:requestId/allocations
// Assign a quantity of one of the org's resources to a request. Body:
// { resourceId, quantity, note? }. Decrements the resource's on-hand count.
export const allocateResource = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can allocate resources.',
      });
    }

    const { requestId } = req.params;
    const { resourceId, quantity, note } = req.body;

    if (!resourceId || typeof resourceId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A resourceId is required.',
      });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a whole number of 1 or more.',
      });
    }

    // The request must exist to allocate against it.
    const request = await requestModel.getRequestById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    // An org may only allocate resources to a request it has assigned to itself.
    // The assignment is a Response row created via POST /api/requests/:id/assign.
    const assignment = await prisma.response.findFirst({
      where: {
        requestId,
        responderId: req.user.id,
        responderType: 'organization',
      },
    });
    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: 'Assign this request to your organization before allocating resources to it.',
      });
    }

    // The resource must exist and belong to this organization.
    const resource = await resourceModel.getResourceById(resourceId);
    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    if (!resource || resource.organizationId !== org.id) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    let allocation;
    try {
      allocation = await resourceModel.allocateResource({
        resourceId,
        requestId,
        quantity: parsedQuantity,
        note,
      });
    } catch (allocationError) {
      // Not enough on hand is a client error, not a server fault.
      return res.status(400).json({
        success: false,
        message: allocationError.message,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Resource allocated to the request.',
      data: allocation,
    });
  } catch (error) {
    console.error('Error allocating resource:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to allocate resource',
      error: error.message,
    });
  }
};

// DELETE /api/resources/allocations/:id
// Remove an allocation, returning its quantity to the resource's on-hand count.
export const deallocateResource = async (req, res) => {
  try {
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can remove allocations.',
      });
    }

    const { id } = req.params;

    // The allocation must exist and draw from one of this org's resources.
    const allocation = await resourceModel.getAllocationById(id);
    const org = await resourceModel.getOrCreateOrgProfile(req.user.id, req.user.name);
    if (!allocation || allocation.resource.organizationId !== org.id) {
      return res.status(404).json({ success: false, message: 'Allocation not found.' });
    }

    await resourceModel.deallocateResource(id);

    res.status(200).json({ success: true, message: 'Allocation removed.' });
  } catch (error) {
    console.error('Error removing allocation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove allocation',
      error: error.message,
    });
  }
};

export default {
  getMyResources,
  createResource,
  updateResourceAvailability,
  deleteResource,
  getRequestAllocations,
  getAllocationSuggestions,
  allocateResource,
  deallocateResource,
};
