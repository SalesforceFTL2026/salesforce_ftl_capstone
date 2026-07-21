import prisma from '../services/database/prisma.js';
import { hashPassword, comparePassword, createToken } from '../services/auth/authService.js';

/**
 * The three roles a user is allowed to pick at signup.
 * We check against this list so nobody can invent a fake role
 * like "admin" by editing the request.
 */
const VALID_ROLES = ['help-seeker', 'volunteer', 'organization'];

/**
 * Clean up the skills a volunteer submits at signup.
 * Accepts an array of strings (anything else becomes an empty list), then
 * trims each entry, drops blanks, and removes case-insensitive duplicates.
 * The result is stored as a JSON array string on the Volunteer profile.
 *
 * @param {unknown} skills - raw value from the request body
 * @returns {string[]} a cleaned, de-duplicated list of skill labels
 */
function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const skill of skills) {
    if (typeof skill !== 'string') continue;
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }
  return cleaned;
}

/**
 * Handle POST /api/auth/signup
 * Creates a new user account with a hashed password.
 */
export async function signup(req, res) {
  try {
    // 1. Pull the fields the browser sent in the request body.
    //    `location` is required for everyone. `skills` only matters for
    //    volunteers — it seeds their Volunteer profile (see step 7).
    const { name, email, password, role, location, skills } = req.body;

    // 2. Validate: make sure nothing important is missing.
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are all required.',
      });
    }

    // 2b. Location is required for all users so requests and resources can be
    //     matched geographically ("Near me").
    const trimmedLocation =
      typeof location === 'string' ? location.trim() : '';
    if (!trimmedLocation) {
      return res.status(400).json({
        success: false,
        message: 'Location is required.',
      });
    }

    // 3. Validate: password must meet our security policy.
    //    - at least 12 characters (length matters most)
    //    - a mix of upper, lower, and a number
    //    - no longer than 72 bytes, since bcrypt silently ignores the rest
    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters long.',
      });
    }
    if (password.length > 72) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 72 characters or fewer.',
      });
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must include an uppercase letter, a lowercase letter, and a number.',
      });
    }

    // 4. Validate: role must be one we allow.
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${VALID_ROLES.join(', ')}.`,
      });
    }

    // 4b. Volunteers must tell us what they can help with. Skills power the
    //     dashboard's "My Interests" view and (later) AI matching, so we
    //     require at least one for the volunteer role. Everyone else may omit
    //     it. `normalizeSkills` trims, de-dupes, and drops blanks.
    const cleanSkills = normalizeSkills(skills);
    if (role === 'volunteer' && cleanSkills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Volunteers must select at least one skill.',
      });
    }

    // 5. Check the email isn't already taken.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // 6. Scramble the password BEFORE saving it. We never store plain text.
    const passwordHash = await hashPassword(password);

    // 7. Save the new user. For volunteers we also create their Volunteer
    //    profile in the SAME transaction so a user never exists without the
    //    profile the dashboard expects. Skills are stored as a JSON array
    //    string, matching how getVolunteerProfile() reads them back.
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        passwordHash,
        location: trimmedLocation,
        ...(role === 'volunteer'
          ? {
              volunteerProfile: {
                create: { skills: JSON.stringify(cleanSkills) },
              },
            }
          : {}),
      },
    });

    // 8. Respond WITHOUT the password hash — never send that to the browser.
    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // 9. Any unexpected failure: log it, return a safe generic message.
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong creating your account.',
    });
  }
}

/**
 * Handle POST /api/auth/login
 * Verifies email + password, then returns a signed JWT.
 */
export async function login(req, res) {
  try {
    // 1. Pull the login fields from the request body.
    const { email, password } = req.body;

    // 2. Validate: both fields are required.
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // 3. Look up the user by email.
    const user = await prisma.user.findUnique({ where: { email } });

    // 4. Check password. We use the SAME generic message whether the email
    //    doesn't exist OR the password is wrong — so attackers can't tell
    //    which emails are registered.
    const passwordMatches = user
      ? await comparePassword(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 5. Success! Create a signed token carrying { userId, role }.
    const token = createToken(user);

    // 6. Send back the token + safe user info (never the password hash).
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    // 7. Unexpected failure: log it, return a safe generic message.
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong logging in.',
    });
  }
}

/**
 * Handle GET /api/auth/me
 * Returns the currently logged-in user's info.
 * (requireAuth has already verified the token and set req.user.)
 */
export async function me(req, res) {
  // requireAuth put the user on req.user for us. Just return the safe fields.
  const user = req.user;

  return res.status(200).json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      location: user.location,
    },
  });
}

/**
 * Update the logged-in user's profile.
 * PATCH /api/auth/me  (protected)
 * Supports changing the display name and/or location. Only the fields provided
 * are changed; at least one must be present. Returns the updated safe fields.
 */
export async function updateProfile(req, res) {
  try {
    const { name, location } = req.body;

    // At least one editable field must be provided.
    if (name === undefined && location === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name or location to update.',
      });
    }

    const data = {};

    // Name (if provided) must be a real, non-empty string.
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Name must not be empty.',
        });
      }
      data.name = name.trim();
    }

    // Location (if provided) can be changed but not cleared — it's required.
    if (location !== undefined) {
      if (typeof location !== 'string' || location.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Location is required and cannot be cleared.',
        });
      }
      data.location = location.trim();
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        location: updated.location,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update your profile. Please try again.',
    });
  }
}
