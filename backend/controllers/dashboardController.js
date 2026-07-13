import prisma from '../services/database/prisma.js';

/**
 * Dashboard Controller
 * Handles role-specific dashboard views for volunteers, organizations, and help-seekers
 */

/**
 * GET /api/dashboard/volunteer
 * Returns requests that the volunteer has expressed interest in
 *
 * Issue #15: Volunteer Dashboard Endpoint
 */
export async function getVolunteerDashboard(req, res) {
  try {
    // Verify user is a volunteer
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for volunteers only.',
      });
    }

    // Get all responses where this volunteer expressed interest
    const interestedRequests = await prisma.response.findMany({
      where: {
        responderId: req.user.id,
        responderType: 'volunteer',
      },
      include: {
        request: true, // Include full request details
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
    });

    // Transform the data to return clean request objects with response metadata
    const formattedRequests = interestedRequests.map((response) => ({
      ...response.request,
      responseId: response.id,
      responseStatus: response.status,
      respondedAt: response.createdAt,
      notes: response.notes,
    }));

    return res.status(200).json({
      success: true,
      data: formattedRequests,
    });
  } catch (error) {
    console.error('Error fetching volunteer dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteer dashboard',
      error: error.message,
    });
  }
}

/**
 * GET /api/dashboard/organization
 * Returns requests that the organization is responding to or has fulfilled
 */
export async function getOrganizationDashboard(req, res) {
  try {
    // Verify user is an organization
    if (req.user.role !== 'organization') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for organizations only.',
      });
    }

    // Get all responses where this org is responding or has fulfilled
    const activeResponses = await prisma.response.findMany({
      where: {
        responderId: req.user.id,
        responderType: 'organization',
      },
      include: {
        request: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedRequests = activeResponses.map((response) => ({
      ...response.request,
      responseId: response.id,
      responseStatus: response.status,
      respondedAt: response.createdAt,
      notes: response.notes,
    }));

    return res.status(200).json({
      success: true,
      data: formattedRequests,
    });
  } catch (error) {
    console.error('Error fetching organization dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch organization dashboard',
      error: error.message,
    });
  }
}

/**
 * GET /api/dashboard/help-seeker
 * Returns requests submitted by the help-seeker
 */
export async function getHelpSeekerDashboard(req, res) {
  try {
    // Verify user is a help-seeker
    if (req.user.role !== 'help-seeker') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for help-seekers only.',
      });
    }

    // Get all requests submitted by this user
    const myRequests = await prisma.request.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        responses: {
          select: {
            id: true,
            responderType: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      data: myRequests,
    });
  } catch (error) {
    console.error('Error fetching help-seeker dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch help-seeker dashboard',
      error: error.message,
    });
  }
}
