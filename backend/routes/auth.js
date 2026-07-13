import express from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Authentication routes
 * Base path: /api/auth  (set in server.js)
 */

// Create a new user account
// POST /api/auth/signup
router.post('/signup', authController.signup);

// Log in an existing user
// POST /api/auth/login
router.post('/login', authController.login);

// Get the currently logged-in user (protected route)
// GET /api/auth/me
router.get('/me', requireAuth, authController.me);

export default router;
