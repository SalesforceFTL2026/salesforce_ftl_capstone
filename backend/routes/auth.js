import express from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * Authentication routes
 * Base path: /api/auth  (set in server.js)
 */

// The credential-facing endpoints (signup/login/google) get the strict
// authLimiter to blunt credential-stuffing and account-probing. The protected
// /me routes below are already gated by requireAuth and covered by the general
// /api limiter, so they don't need it.

// Create a new user account
// POST /api/auth/signup
router.post('/signup', authLimiter, authController.signup);

// Log in an existing user
// POST /api/auth/login
router.post('/login', authLimiter, authController.login);

// Sign in / sign up with Google (an additional option to password login)
// POST /api/auth/google
router.post('/google', authLimiter, authController.googleAuth);

// Get the currently logged-in user (protected route)
// GET /api/auth/me
router.get('/me', requireAuth, authController.me);

// Update the logged-in user's profile (e.g. display name) (protected route)
// PATCH /api/auth/me
router.patch('/me', requireAuth, authController.updateProfile);

export default router;
