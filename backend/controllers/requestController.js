import * as requestModel from '../models/requestModel.js';
import prisma from '../services/database/prisma.js';
import { prioritizeRequest } from '../services/ai/prioritizer.js';
import { geocodeLocation, haversineMiles } from '../services/geocoding/geocoder.js';
import { parseRadiusFilter, filterWithinRadius } from '../services/geocoding/distance.js';
import { transcribeAudio, extractRequestFields } from '../services/ai/index.js';

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

    // Best-effort geocode so the request can be plotted on the map. A location
    // we can't resolve just saves without coordinates (never blocks creation).
    const coords = await geocodeLocation(location);

    // Create request, stamping it with the logged-in user's real identity.
    const newRequest = await requestModel.createRequest({
      userId: req.user.id,
      submitterName: req.user.name,
      submitterRole: req.user.role,
      category,
      urgency,
      location,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      description,
      householdSize: parsedHouseholdSize
    });

    // Run the AI prioritization pipeline so the request gets a real priority
    // score (and reasoning) right away. This is best-effort: if scoring fails
    // the request is still created — it just stays at its default score of 0
    // until something re-prioritizes it.
    let scored = newRequest;
    try {
      const { priorityScore, reasoning } = await prioritizeRequest(newRequest.id);
      scored = { ...newRequest, priorityScore, reasoning };
    } catch (scoreError) {
      console.error('Prioritization failed for new request:', scoreError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Help request submitted successfully',
      data: scored
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
// Optional geo-radius filter (issue #115): pass ?lat=&lng=&radius= (radius in
// miles) to keep only requests within that distance of the point. Each returned
// request is annotated with `distanceMiles`. An absent or malformed filter is
// ignored and all requests are returned.
export const getAllRequests = async (req, res) => {
  try {
    let requests = await requestModel.getAllRequests();

    const radiusFilter = parseRadiusFilter(req.query);
    if (radiusFilter) {
      requests = filterWithinRadius(requests, radiusFilter);
    }

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
// Optional geo-radius filter (issue #115): pass ?lat=&lng=&radius= (radius in
// miles) to keep only requests within that distance — this is what the "Near
// me" toggle (issue #116) on the volunteer/org feeds calls. Each returned
// request is annotated with `distanceMiles`. An absent or malformed filter is
// ignored and the full prioritized feed is returned.
export const getPrioritizedRequests = async (req, res) => {
  try {
    let requests = await requestModel.getPrioritizedRequests();

    const radiusFilter = parseRadiusFilter(req.query);
    if (radiusFilter) {
      requests = filterWithinRadius(requests, radiusFilter);
    }

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

// Get the distance (in miles) from a given origin to each active request.
// GET /api/requests/distances?origin=<free-text location>
// Used by organizations to sort the request feed by "nearest". We geocode only
// the origin here; each request's coordinates are already stored on the row
// (geocoded at creation), so no per-request network calls are needed. Requests
// without stored coordinates come back with distanceMiles: null (unknown).
export const getRequestDistances = async (req, res) => {
  try {
    const { origin } = req.query;

    if (!origin || origin.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'An origin location is required to measure distance.'
      });
    }

    const originCoords = await geocodeLocation(origin);
    if (!originCoords) {
      return res.status(422).json({
        success: false,
        message: `Could not find the location "${origin}".`
      });
    }

    // Only measure distance for the active feed (what the org actually sorts).
    const requests = await requestModel.getPrioritizedRequests();

    const distances = requests.map((request) => {
      const hasCoords =
        typeof request.latitude === 'number' && typeof request.longitude === 'number';
      return {
        id: request.id,
        distanceMiles: hasCoords
          ? Math.round(haversineMiles(originCoords, request) * 10) / 10
          : null
      };
    });

    res.status(200).json({
      success: true,
      data: distances
    });
  } catch (error) {
    console.error('Error computing request distances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compute distances',
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

    const validStatuses = ['pending', 'assigned', 'in-progress', 'matched', 'completed', 'fulfilled', 'closed'];
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
      // Location changed, so its map coordinates are stale — re-geocode. A
      // location we can't resolve clears the coordinates (falls off the map).
      const coords = await geocodeLocation(location);
      fields.latitude = coords?.latitude ?? null;
      fields.longitude = coords?.longitude ?? null;
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

    // A volunteer stepping up moves the request from pending to assigned so the
    // help-seeker sees someone is on it. Only upgrade from pending — don't
    // override a status an organization has already advanced.
    if (request.status === 'pending') {
      await requestModel.updateRequestStatus(id, 'assigned');
    }

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

// Volunteer marks a request they claimed as helped ("I've helped with this").
// POST /api/requests/:id/complete
// Requires the volunteer to already have a Response on the request. Sets both
// their Response and the request itself to completed.
export const completeRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Only volunteers can mark a request as helped.
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({
        success: false,
        message: 'Only volunteers can mark a request as helped.'
      });
    }

    // The request must exist before we can complete it.
    const request = await requestModel.getRequestById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // The volunteer can only complete a request they actually offered to help
    // with, so we look up their existing interest first.
    const existing = await prisma.response.findFirst({
      where: {
        requestId: id,
        responderId: req.user.id,
        responderType: 'volunteer'
      }
    });

    if (!existing) {
      return res.status(403).json({
        success: false,
        message: 'You can only complete a request you offered to help with.'
      });
    }

    // Mark both the volunteer's response and the request itself as completed.
    await prisma.response.update({
      where: { id: existing.id },
      data: { status: 'completed' }
    });
    const updated = await requestModel.updateRequestStatus(id, 'completed');

    res.status(200).json({
      success: true,
      message: 'Marked as helped. Thank you!',
      data: updated
    });
  } catch (error) {
    console.error('Error completing request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as helped',
      error: error.message
    });
  }
};

// Voice intake: accept a recorded audio clip, transcribe it, and extract the
// help-request fields with Claude. This does NOT create the request — it returns
// the draft fields + transcript so the frontend can show a "confirm what we
// heard" review step (#156) before the user submits through createRequest.
// Requires authentication; only help-seekers can file requests.
export const transcribeVoiceRequest = async (req, res) => {
  try {
    if (req.user.role !== 'help-seeker') {
      return res.status(403).json({
        success: false,
        message: 'Only help-seekers can submit help requests'
      });
    }

    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({
        success: false,
        message: 'No audio file was uploaded'
      });
    }

    // Step 1: speech-to-text via Whisper.
    let transcript;
    try {
      transcript = await transcribeAudio(req.file.buffer, req.file.originalname);
    } catch (error) {
      console.error('Voice intake transcription failed:', error);
      return res.status(502).json({
        success: false,
        message: 'Could not transcribe the audio. Please try recording again.'
      });
    }

    if (!transcript) {
      return res.status(422).json({
        success: false,
        message: "We couldn't hear anything in that recording. Please try again."
      });
    }

    // Step 2: pull structured fields out of the transcript via Claude.
    let fields;
    try {
      fields = await extractRequestFields(transcript);
    } catch (error) {
      console.error('Voice intake field extraction failed:', error);
      return res.status(502).json({
        success: false,
        message: 'Could not understand the request details. Please try again or fill the form manually.',
        // Still hand back the transcript so the user doesn't lose what they said.
        data: { transcript }
      });
    }

    // Return a draft for review — nothing is saved yet.
    return res.status(200).json({
      success: true,
      message: 'Transcribed and extracted request details for review',
      data: {
        transcript,
        fields
      }
    });
  } catch (error) {
    console.error('Error handling voice intake:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process voice intake',
      error: error.message
    });
  }
};

// Assign a request to the signed-in organization ("we'll help with this").
// POST /api/requests/:id/assign
// Creates a Response linking this organization to the request, which is what
// makes the request show up under the org's "Your Requests" and unlocks
// allocating resources to it. Idempotent — assigning twice is a no-op. Multiple
// organizations can assign themselves to the same request so that resources
// from different places can all be allocated to it.
export const assignToRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Only organizations can assign requests to themselves.
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can assign requests to themselves.'
      });
    }

    // The request must exist before we can assign it.
    const request = await requestModel.getRequestById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Don't create a second assignment if this org already claimed it.
    const existing = await prisma.response.findFirst({
      where: {
        requestId: id,
        responderId: req.user.id,
        responderType: 'organization'
      }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'This request is already assigned to your organization.',
        data: existing
      });
    }

    const response = await prisma.response.create({
      data: {
        requestId: id,
        responderId: req.user.id,
        responderType: 'organization',
        status: 'accepted'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Request assigned to your organization.',
      data: response
    });
  } catch (error) {
    console.error('Error assigning request to organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign request',
      error: error.message
    });
  }
};

// Remove the signed-in organization's assignment from a request.
// DELETE /api/requests/:id/assign
// Only affects this org's own assignment; other organizations that assigned
// themselves to the same request are untouched.
export const unassignFromRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Only organizations can unassign requests.'
      });
    }

    await prisma.response.deleteMany({
      where: {
        requestId: id,
        responderId: req.user.id,
        responderType: 'organization'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Request unassigned from your organization.'
    });
  } catch (error) {
    console.error('Error unassigning request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign request',
      error: error.message
    });
  }
};

export default {
  createRequest,
  transcribeVoiceRequest,
  getMyRequests,
  getAllRequests,
  getRequestById,
  getPrioritizedRequests,
  getRequestDistances,
  updateRequestStatus,
  updateRequestDetails,
  deleteRequest,
  interactWithRequest,
  completeRequest,
  assignToRequest,
  unassignFromRequest
};
