import * as requestModel from '../models/requestModel.js';

/**
 * Request Controller
 * Handles business logic for help request endpoints
 */

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

    const { category, urgency, location, description } = req.body;

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

    // Create request, stamping it with the logged-in user's real identity.
    const newRequest = await requestModel.createRequest({
      userId: req.user.id,
      submitterName: req.user.name,
      submitterRole: req.user.role,
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

export default {
  createRequest,
  getAllRequests,
  getRequestById,
  getPrioritizedRequests,
  updateRequestStatus,
  deleteRequest
};
