import prisma from '../services/database/prisma.js';
import { hashPassword, comparePassword, createToken } from '../services/auth/authService.js';

/**
 * The three roles a user is allowed to pick at signup.
 * We check against this list so nobody can invent a fake role
 * like "admin" by editing the request.
 */
const VALID_ROLES = ['help-seeker', 'volunteer', 'organization'];

/**
 * Handle POST /api/auth/signup
 * Creates a new user account with a hashed password.
 */
export async function signup(req, res) {
  try {
    // 1. Pull the fields the browser sent in the request body.
    const { name, email, password, role } = req.body;

    // 2. Validate: make sure nothing important is missing.
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are all required.',
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

    // 7. Save the new user in the database.
    const user = await prisma.user.create({
      data: { name, email, role, passwordHash },
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
    },
  });
}

/**
 * Update the logged-in user's profile.
 * PATCH /api/auth/me  (protected)
 * Currently supports changing the display name. Returns the updated safe fields.
 */
export async function updateProfile(req, res) {
  try {
    const { name } = req.body;

    // Validate: a name change must be a real, non-empty string.
    if (name === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name to update.',
      });
    }
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name must not be empty.',
      });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
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
