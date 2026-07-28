import prisma from '../services/database/prisma.js';
import { getSignedViewUrl } from '../services/s3.js';

/**
 * Organization Controller
 * Read-only, public-facing listing of participating organizations, shown to
 * help-seekers ("Participating Non-Profits Near You"). Only exposes safe,
 * non-sensitive fields — never contact emails or internal ids beyond what the
 * UI needs.
 */

// Parse the resourceTypes JSON array string stored on an Organization into a
// real array. Returns [] for null/blank/malformed values so the frontend can
// always map over it safely.
function parseResourceTypes(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/organizations
 * Returns the list of participating organizations for the help-seeker
 * dashboard. Verified orgs first, then most recent. Each item carries the
 * org's display name, the resource types it offers, its verified flag, and the
 * city/location from the linked user account.
 */
export async function listOrganizations(req, res) {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
      include: { user: { select: { location: true, avatarKey: true } } },
    });

    // Sign each org's avatar (if any) so the help-seeker dashboard can show the
    // uploaded logo. Runs in parallel to keep the endpoint fast.
    const data = await Promise.all(
      orgs.map(async (org) => ({
        id: org.id,
        name: org.organizationName,
        resourceTypes: parseResourceTypes(org.resourceTypes),
        verified: org.verified,
        location: org.user?.location || null,
        logoUrl: await getSignedViewUrl(org.user?.avatarKey),
      }))
    );

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error listing organizations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load organizations.',
    });
  }
}
