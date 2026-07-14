import * as requestModel from '../models/requestModel.js';
import prisma from '../services/database/prisma.js';

/**
 * Request Controller
 * Handles business logic for help request endpoints
 */

// Create a new help request
export const createRequest = async (req, res) => {
  try {
    const { submitterName, category, urgency, location, description } = req.body;

    // Validation
    if (!category || !urgency || !location || !description) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: category, urgency, location, and description are required'
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

    // Create request
    const newRequest = await requestModel.createRequest({
      submitterName,
      category,
      urgency,
      location,
      description
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
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

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
  getAllRequests,
  getRequestById,
  getPrioritizedRequests,
  updateRequestStatus,
  deleteRequest,
  interactWithRequest
};
