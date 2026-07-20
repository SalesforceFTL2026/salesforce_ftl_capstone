import * as resourceModel from '../models/resourceModel.js';

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

export default {
  getMyResources,
  createResource,
  updateResourceAvailability,
  deleteResource,
};
