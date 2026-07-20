import express from 'express';
import * as emergencyController from '../controllers/emergencyController.js';

const router = express.Router();

/**
 * Emergency Routes
 * Base path: /api/emergency
 *
 * Public: emergency contact info should be reachable without logging in.
 */

// Get local emergency contacts for a US zipcode.
// GET /api/emergency/:zipcode
router.get('/:zipcode', emergencyController.getLocalContacts);

export default router;
