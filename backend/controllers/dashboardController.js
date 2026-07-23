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
 * GET /api/dashboard/volunteer/profile
 * Returns the signed-in volunteer's profile skills, so the dashboard can show
 * which disaster-response skill areas they already list, along with a
 * self-rated proficiency (1–5) for each.
 *
 * `skills` is stored as a JSON array string on the Volunteer profile. We parse
 * it into an array of { name, level } here. A volunteer with no profile row yet
 * (or no skills) simply gets an empty array — this is not an error.
 */
export async function getVolunteerProfile(req, res) {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for volunteers only.',
      });
    }

    const profile = await prisma.volunteer.findUnique({
      where: { userId: req.user.id },
    });

    return res.status(200).json({
      success: true,
      data: {
        skills: parseSkills(profile?.skills),
      },
    });
  } catch (error) {
    console.error('Error fetching volunteer profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch volunteer profile',
      error: error.message,
    });
  }
}

/**
 * PUT /api/dashboard/volunteer/profile/skills
 * Replace the signed-in volunteer's skills. Body: { skills: [{ name, level }] }
 * where `level` is a self-rated proficiency from 1 to 5. Volunteers use this to
 * add skills beyond the ones they chose at signup and to set how confident they
 * feel at each. Names are trimmed and de-duplicated (case-insensitively).
 */
export async function updateVolunteerSkills(req, res) {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for volunteers only.',
      });
    }

    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: 'Provide skills as an array of { name, level }.',
      });
    }

    // Clean each entry: name must be a non-empty string, level a 1–5 integer.
    // Duplicates (same name, case-insensitive) are dropped, keeping the first.
    const seen = new Set();
    const cleaned = [];
    for (const entry of skills) {
      const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;

      const level = Number(entry?.level);
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        return res.status(400).json({
          success: false,
          message: `Proficiency for "${name}" must be a whole number from 1 to 5.`,
        });
      }

      seen.add(key);
      cleaned.push({ name, level });
    }

    // Persist to the Volunteer profile, creating the row if it doesn't exist yet.
    const profile = await prisma.volunteer.upsert({
      where: { userId: req.user.id },
      update: { skills: JSON.stringify(cleaned) },
      create: { userId: req.user.id, skills: JSON.stringify(cleaned) },
    });

    return res.status(200).json({
      success: true,
      message: 'Skills updated.',
      data: { skills: parseSkills(profile.skills) },
    });
  } catch (error) {
    console.error('Error updating volunteer skills:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update skills',
      error: error.message,
    });
  }
}

// Safely turn the stored skills JSON string into an array of { name, level }.
// Legacy profiles stored a plain array of skill-name strings; those come back
// with a default mid-range level of 3. Returns [] for missing or malformed
// data so callers never have to guard against it.
function parseSkills(skillsJson) {
  if (!skillsJson) return [];
  try {
    const parsed = JSON.parse(skillsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => {
        if (typeof s === 'string') {
          return s.trim() ? { name: s.trim(), level: 3 } : null;
        }
        if (s && typeof s.name === 'string' && s.name.trim()) {
          const level = Number(s.level);
          return {
            name: s.name.trim(),
            level: Number.isInteger(level) && level >= 1 && level <= 5 ? level : 3,
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
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
