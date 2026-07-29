import prisma from '../services/database/prisma.js';
import { hashPassword, comparePassword, createToken, verifyGoogleToken } from '../services/auth/authService.js';
import { getSignedViewUrl } from '../services/s3.js';

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

    // 5. Check this email isn't already taken FOR THIS ROLE. The same email may
    //    hold a separate account per role, so we check the (email, role) pair.
    const existingUser = await prisma.user.findUnique({
      where: { email_role: { email, role } },
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists for this role.',
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
    const { email, password, role } = req.body;

    // 2. Validate: all three are required. Role is needed because one email can
    //    hold a separate account per role, so email alone doesn't identify one.
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required.',
      });
    }

    // 3. Look up the ONE account for this email + role.
    const user = await prisma.user.findUnique({
      where: { email_role: { email, role } },
    });

    // 4. Check password. We use the SAME generic message whether the account
    //    doesn't exist OR the password is wrong — so attackers can't tell which
    //    emails are registered. A Google-only account has no passwordHash, so
    //    guard the compare and let it fall through to the generic 401.
    const passwordMatches = user?.passwordHash
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
    //    A short-lived signed URL lets the frontend show the avatar right away.
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location,
          phoneNumber: user.phoneNumber,
          householdSize: user.householdSize,
          languagePreference: user.languagePreference,
          avatarUrl: await getSignedViewUrl(user.avatarKey),
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
 * Handle POST /api/auth/google
 * Sign in (or sign up) using a Google ID token, for a chosen role.
 * Flow: verify the token with Google -> find the (email, role) account or
 * create one -> return OUR own JWT (same shape as password login). This is an
 * ADDITIONAL option; password login/signup still work unchanged.
 */
export async function googleAuth(req, res) {
  try {
    const { idToken, role } = req.body;

    // 1. Both are required — role because one email can hold an account per role.
    if (!idToken || !role) {
      return res.status(400).json({
        success: false,
        message: 'Google token and role are required.',
      });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${VALID_ROLES.join(', ')}.`,
      });
    }

    // 2. Prove the token really came from Google. Throws if forged/expired.
    let identity;
    try {
      identity = await verifyGoogleToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Could not verify your Google sign-in. Please try again.',
      });
    }
    if (!identity.emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Your Google email is not verified.',
      });
    }

    // 3. Find the account for THIS email + role, or create it on first use.
    let user = await prisma.user.findUnique({
      where: { email_role: { email: identity.email, role } },
    });

    if (!user) {
      // First time this email uses this role — create the account. No password:
      // this is a Google account. Volunteers get an empty skills profile (they
      // can add skills later on their dashboard), mirroring password signup's
      // volunteerProfile creation.
      user = await prisma.user.create({
        data: {
          email: identity.email,
          name: identity.name,
          role,
          googleId: identity.googleId,
          passwordHash: null,
          ...(role === 'volunteer'
            ? { volunteerProfile: { create: { skills: JSON.stringify([]) } } }
            : {}),
        },
      });
    } else if (!user.googleId) {
      // An existing password account for this role — link the Google id so
      // future Google logins recognize it. They can still use their password.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: identity.googleId },
      });
    }

    // 4. Issue OUR token — identical to password login from here on.
    const token = createToken(user);
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location,
          phoneNumber: user.phoneNumber,
          householdSize: user.householdSize,
          languagePreference: user.languagePreference,
          avatarUrl: await getSignedViewUrl(user.avatarKey),
        },
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong with Google sign-in.',
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
      phoneNumber: user.phoneNumber,
      householdSize: user.householdSize,
      languagePreference: user.languagePreference,
      avatarUrl: await getSignedViewUrl(user.avatarKey),
    },
  });
}

/**
 * Update the logged-in user's profile.
 * PATCH /api/auth/me  (protected)
 * Supports changing the display name, location, and/or UI language preference.
 * Only the fields provided are changed; at least one must be present. Returns
 * the updated safe fields.
 */
// UI languages the app can render. Kept in sync with the frontend i18n config
// (frontend/src/i18n/index.js SUPPORTED_LANGUAGES).
const VALID_LANGUAGES = ['en', 'es', 'zh', 'tl', 'vi', 'fr', 'ko', 'ru', 'ht', 'hi', 'ne'];

export async function updateProfile(req, res) {
  try {
    const { name, location, languagePreference, phoneNumber, householdSize } = req.body;

    // At least one editable field must be provided.
    if (
      name === undefined &&
      location === undefined &&
      languagePreference === undefined &&
      phoneNumber === undefined &&
      householdSize === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name, location, phone number, household size, or language to update.',
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

    // Language (if provided) must be one we actually ship translations for.
    if (languagePreference !== undefined) {
      if (!VALID_LANGUAGES.includes(languagePreference)) {
        return res.status(400).json({
          success: false,
          message: `Language must be one of: ${VALID_LANGUAGES.join(', ')}.`,
        });
      }
      data.languagePreference = languagePreference;
    }

    // Phone (if provided) is optional and format-lenient — numbers vary by
    // country. An empty string clears it; otherwise allow digits and the usual
    // separators (+, -, spaces, parentheses) and cap the length. We don't
    // enforce a strict pattern so international numbers all work.
    if (phoneNumber !== undefined) {
      if (typeof phoneNumber !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be text.',
        });
      }
      const trimmedPhone = phoneNumber.trim();
      if (trimmedPhone === '') {
        // Allow clearing the phone number since it's optional.
        data.phoneNumber = null;
      } else if (!/^[0-9+\-()\s]{4,20}$/.test(trimmedPhone)) {
        return res.status(400).json({
          success: false,
          message:
            'Enter a valid phone number (4–20 characters: digits, spaces, and + - ( ) only).',
        });
      } else {
        data.phoneNumber = trimmedPhone;
      }
    }

    // Household size (if provided) is optional. null / '' clears it; otherwise
    // it must be a positive whole number. Accept a numeric string from the form
    // too. Cap it at a sane upper bound to reject typos.
    if (householdSize !== undefined) {
      if (householdSize === null || householdSize === '') {
        // Allow clearing it since it's optional.
        data.householdSize = null;
      } else {
        const parsed =
          typeof householdSize === 'number' ? householdSize : Number(householdSize);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
          return res.status(400).json({
            success: false,
            message: 'Household size must be a whole number between 1 and 100.',
          });
        }
        data.householdSize = parsed;
      }
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
        phoneNumber: updated.phoneNumber,
        householdSize: updated.householdSize,
        languagePreference: updated.languagePreference,
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
