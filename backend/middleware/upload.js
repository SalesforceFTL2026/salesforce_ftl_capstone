import multer from 'multer';

/**
 * Audio upload middleware for the voice-intake endpoint.
 *
 * We keep the file in memory (not on disk) because it is immediately forwarded
 * to Whisper as a buffer and never needs to persist. A size cap protects the
 * server from oversized uploads, and the mimetype filter rejects non-audio.
 */
const ONE_MB = 1024 * 1024;

const storage = multer.memoryStorage();

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 25 * ONE_MB, // Whisper's own upload ceiling is 25MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Uploaded file must be audio'));
    }
  },
}).single('audio');
