import * as dashboardService from '../services/dashboard/dashboardService.js';

/**
 * Dashboard Controller
 * Orchestrates role dashboard endpoints. Business logic lives in the service.
 */

/**
 * Handle GET /api/dashboard/organization
 * Returns the signed-in organization's dashboard data.
 * (requireAuth + requireRole('organization') already ran, so req.user is a
 * verified organization user.)
 */
export const getOrganizationDashboard = async (req, res) => {
  try {
    const dashboard = await dashboardService.getOrganizationDashboard(req.user.id);

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    // Log the real error server-side; never leak the stack trace to clients.
    console.error('Error building organization dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load organization dashboard',
    });
  }
};

export default { getOrganizationDashboard };
