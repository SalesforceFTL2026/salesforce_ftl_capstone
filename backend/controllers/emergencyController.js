import { resolveZip, buildContacts } from '../services/emergency/localContacts.js';

/**
 * Emergency Controller
 * Looks up local emergency contact info for a US zipcode.
 */

// GET /api/emergency/:zipcode
// Validates the zip, resolves it to a real city/state, and returns the
// emergency contacts (national hotlines + 211) tailored to that area.
export const getLocalContacts = async (req, res) => {
  try {
    const { zipcode } = req.params;

    // Basic shape check before we hit the external service.
    if (!/^\d{5}$/.test(zipcode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 5-digit US zipcode.',
      });
    }

    const location = await resolveZip(zipcode);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: `We couldn't find the zipcode ${zipcode}. Double-check and try again.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        location,
        contacts: buildContacts(location),
      },
    });
  } catch (error) {
    console.error('Error looking up local contacts:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not look up local contacts right now. Please try again.',
    });
  }
};
