import express from 'express';
import {
  prioritizeRequest,
  prioritizeRequestsBatch,
  reprioritizeAll,
} from '../services/ai/prioritizer.js';

const router = express.Router();

/**
 * POST /api/prioritize/:requestId
 * Prioritize a single request
 */
router.post('/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await prioritizeRequest(requestId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in prioritize route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prioritize request',
      error: error.message,
    });
  }
});

/**
 * POST /api/prioritize/batch
 * Prioritize multiple requests
 * Body: { requestIds: ["id1", "id2", ...] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { requestIds } = req.body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'requestIds must be a non-empty array',
      });
    }

    const results = await prioritizeRequestsBatch(requestIds);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error in batch prioritize route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prioritize requests',
      error: error.message,
    });
  }
});

/**
 * POST /api/prioritize/all
 * Re-prioritize all pending requests
 */
router.post('/all', async (req, res) => {
  try {
    const count = await reprioritizeAll();

    res.json({
      success: true,
      data: {
        reprioritizedCount: count,
      },
    });
  } catch (error) {
    console.error('Error in reprioritize all route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reprioritize all requests',
      error: error.message,
    });
  }
});

export default router;
