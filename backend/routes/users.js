import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadAvatar, getMe } from '../controllers/userController.js';

const router = express.Router();

// Wrap multer so its errors (too big, wrong type) return a clean 400
// instead of falling through to the generic 500 handler.
const handleImageUpload = (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
};

router.get('/me', requireAuth, getMe);
router.post('/me/avatar', requireAuth, handleImageUpload, uploadAvatar);

export default router;
