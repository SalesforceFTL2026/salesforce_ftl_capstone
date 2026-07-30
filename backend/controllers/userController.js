import { randomUUID } from 'crypto';
import prisma from '../services/database/prisma.js';
import { uploadToS3, getSignedViewUrl, deleteFromS3 } from '../services/s3.js';

// Map an upload's mimetype to a file extension for a clean S3 key.
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** POST /api/users/me/avatar — upload or replace the logged-in user's avatar. */
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({ success: false, message: 'No image file was uploaded' });
    }

    const userId = req.user.id;
    const ext = EXT[req.file.mimetype] || 'jpg';
    const key = `avatars/${userId}/${randomUUID()}.${ext}`;

    // 1. Push the image bytes to S3.
    await uploadToS3({ key, buffer: req.file.buffer, contentType: req.file.mimetype });

    // 2. Delete the previous avatar (if any) so old files don't pile up.
    if (req.user.avatarKey) {
      await deleteFromS3(req.user.avatarKey).catch(() => {}); // best-effort
    }

    // 3. Save the new key on the user row.
    await prisma.user.update({ where: { id: userId }, data: { avatarKey: key } });

    // 4. Return a signed URL so the frontend can display it immediately.
    const avatarUrl = await getSignedViewUrl(key);
    return res.json({ success: true, avatarUrl });
  } catch (error) {
    console.error('Avatar upload failed:', error);
    return res.status(500).json({ success: false, message: 'Could not upload profile image' });
  }
};

/** GET /api/users/me — return the profile plus a fresh signed avatar URL. */
export const getMe = async (req, res) => {
  const { passwordHash, avatarKey, ...safe } = req.user;
  const avatarUrl = await getSignedViewUrl(avatarKey);
  return res.json({ success: true, user: { ...safe, avatarUrl } });
};
