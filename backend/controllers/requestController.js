import * as requestModel from '../models/requestModel.js';
import prisma from '../services/database/prisma.js';

/**
 * Request Controller
 * Handles business logic for help request endpoints
 */

// Sentinel returned by parseHouseholdSize when the value can't be used, so we
// can tell "not provided" (null) apart from "provided but invalid".
const INVALID_HOUSEHOLD_SIZE = Symbol('invalid-household-size');

// Normalize an incoming householdSize into: null (not provided / blank),
// a positive integer, or INVALID_HOUSEHOLD_SIZE. Accepts numbers or numeric
// strings from form submissions.
const parseHouseholdSize = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return INVALID_HOUSEHOLD_SIZE;
  }
  return n;
};

// Decides whether a logged-in user is allowed to manage (update/delete) a request.
// The rule: organizations can manage any request, and a help-seeker can manage
// only the request they submitted themselves. Everyone else is not allowed.
const canManageRequest = (user, request) => {
  if (user.role === 'organization') {
    return true;
  }
  return user.role === 'help-seeker' && request.userId === user.id;
};

// Create a new help request
// Requires authentication: the submitter's identity comes from the logged-in
// user (req.user), NOT from the request body, so clients can't spoof who they are.
export const createRequest = async (req, res) => {
  try {
    // Only help-seekers can submit help requests.
    if (req.user.role !== 'help-seeker') {
      return res.status(403).json({
        success: false,
        message: 'Only help-seekers can submit a help request.'
      });
    }

    const { category, urgency, location, description, householdSize } = req.body;

    // Validation
    if (!category || !urgency || !location || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: category, urgency, location, and description are required'
      });
    }

    // Household size is required and must be a positive whole number.
    const parsedHouseholdSize = parseHouseholdSize(householdSize);
    if (parsedHouseholdSize === null) {
      return res.status(400).json({
        success: false,
        message: 'Household size is required.'
      });
    }
    if (parsedHouseholdSize === INVALID_HOUSEHOLD_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'Household size must be a whole number of 1 or more.'
      });
    }

    // Validate category
    const validCategories = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be one of: Food, Shelter, Medical, Transport, Other'
      });
    }

    // Validate urgency
    const validUrgencies = ['Low', 'Medium', 'High', 'Critical'];
    if (!validUrgencies.includes(urgency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid urgency. Must be one of: Low, Medium, High, Critical'
      });
    }

    // Create request, stamping it with the logged-in user's real identity.
    const newRequest = await requestModel.createRequest({
      userId: req.user.id,
      submitterName: req.user.name,
      submitterRole: req.user.role,
      category,
      urgency,
      location,
      description,
      householdSize: parsedHouseholdSize
    });

    res.status(201).json({
      success: true,
      message: 'Help request submitted successfully',
      data: newRequest
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
      error: error.message
    });
  }
};

// Get all requests
export const getAllRequests = async (req, res) => {
  try {
    const requests = await requestModel.getAllRequests();

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
};

// Get the logged-in user's own requests
export const getMyRequests = async (req, res) => {
  try {
    const requests = await requestModel.getRequestsByUser(req.user.id);

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your requests',
      error: error.message
    });
  }
};

// Get request by ID
export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await requestModel.getRequestById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request',
      error: error.message
    });
  }
};

// Get prioritized requests
export const getPrioritizedRequests = async (req, res) => {
  try {
    const requests = await requestModel.getPrioritizedRequests();

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching prioritized requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prioritized requests',
      error: error.message
    });
  }
};

// Update request status
// Allowed for organizations, or the help-seeker who owns the request.
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['pending', 'in-progress', 'matched', 'fulfilled', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Load the request so we can check the caller is allowed to manage it.
    const request = await requestModel.getRequestById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (!canManageRequest(req.user, request)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to update this request.'
      });
    }

    const updatedRequest = await requestModel.updateRequestStatus(id, status);

    res.status(200).json({
      success: true,
      message: 'Request status updated successfully',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request status',
      error: error.message
    });
  }
};

// Delete request
// Allowed for organizations, or the help-seeker who owns the request.
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Load the request so we can check the caller is allowed to manage it.
    const request = await requestModel.getRequestById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (!canManageRequest(req.user, request)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this request.'
      });
    }

    await requestModel.deleteRequest(id);

    res.status(200).json({
      success: true,
      message: 'Request deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete request',
      error: error.message
    });
  }
};

// Edit a request's details.
// PATCH /api/requests/:id
// Organizations triage incoming requests (correcting category, adding detail),
// and a help-seeker can edit the requests they submitted themselves. Any of
// category, urgency, location, and description may be changed; omitted fields
// are left as-is.
export const updateRequestDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, urgency, location, description, householdSize } = req.body;

    // Make sure the request exists before we check ownership or update it.
    const request = await requestModel.getRequestById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Orgs can edit any request; a help-seeker can edit only their own.
    if (!canManageRequest(req.user, request)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this request.'
      });
    }

    // Build the set of fields to change; only include what was provided.
    const fields = {};

    if (category !== undefined) {
      const validCategories = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Must be one of: Food, Shelter, Medical, Transport, Other'
        });
      }
      fields.category = category;
    }

    if (urgency !== undefined) {
      const validUrgencies = ['Low', 'Medium', 'High', 'Critical'];
      if (!validUrgencies.includes(urgency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid urgency. Must be one of: Low, Medium, High, Critical'
        });
      }
      fields.urgency = urgency;
    }

    if (location !== undefined) {
      if (typeof location !== 'string' || location.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Location must be a non-empty string.'
        });
      }
      fields.location = location;
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Description must be a non-empty string.'
        });
      }
      fields.description = description;
    }

    if (householdSize !== undefined) {
      const parsedHouseholdSize = parseHouseholdSize(householdSize);
      if (parsedHouseholdSize === INVALID_HOUSEHOLD_SIZE) {
        return res.status(400).json({
          success: false,
          message: 'Household size must be a whole number of 1 or more.'
        });
      }
      fields.householdSize = parsedHouseholdSize;
    }

    // The caller must actually be changing something.
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update.'
      });
    }

    const updatedRequest = await requestModel.updateRequestDetails(id, fields);

    res.status(200).json({
      success: true,
      message: 'Request updated successfully',
      data: updatedRequest
    });
  } catch (error) {
    console.error('Error updating request details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request',
      error: error.message
    });
  }
};

// Express interest in a request (volunteer clicks "I can help with this")
// POST /api/requests/:id/interact
// Creates a Response linking the logged-in volunteer to the request.
// This is what later shows up in GET /api/dashboard/volunteer ("My Interests").
export const interactWithRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Only volunteers can express interest this way.
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({
        success: false,
        message: 'Only volunteers can express interest in a request.'
      });
    }

    // Make sure the request actually exists before responding to it.
    const request = await requestModel.getRequestById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Don't let the same volunteer express interest twice on one request.
    const existing = await prisma.response.findFirst({
      where: {
        requestId: id,
        responderId: req.user.id,
        responderType: 'volunteer'
      }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'You have already expressed interest in this request.',
        data: existing
      });
    }

    const response = await prisma.response.create({
      data: {
        requestId: id,
        responderId: req.user.id,
        responderType: 'volunteer',
        status: 'offered',
        notes: notes || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Interest recorded. Thanks for stepping up to help!',
      data: response
    });
  } catch (error) {
    console.error('Error recording interest in request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record interest',
      error: error.message
    });
  }
};

export default {
  createRequest,
  getMyRequests,
  getAllRequests,
  getRequestById,
  getPrioritizedRequests,
  updateRequestStatus,
  updateRequestDetails,
  deleteRequest,
  interactWithRequest
};
