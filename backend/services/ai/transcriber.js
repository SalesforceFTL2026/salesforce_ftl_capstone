import { toFile } from 'openai';
import { openai } from './clients.js';

// Whisper model used for voice-intake transcription. Configurable via env so it
// can be swapped without a code change if OpenAI ships a newer speech model.
const TRANSCRIPTION_MODEL = process.env.WHISPER_MODEL || 'whisper-1';

/**
 * Transcribe recorded audio to text via OpenAI Whisper.
 *
 * The frontend records the caller's voice in the browser and uploads it as a
 * single audio file (webm/ogg/mp3/wav/m4a). We hand the raw buffer to Whisper
 * and return the recognized text so it can be fed into field extraction.
 *
 * @param {Buffer} buffer - Raw audio bytes from the uploaded file
 * @param {string} filename - Original filename (Whisper uses the extension to
 *   infer the container format, so keep the real extension)
 * @returns {Promise<string>} - Transcribed text (trimmed)
 * @throws {Error} - If transcription fails (caller should surface a 502)
 */
export async function transcribeAudio(buffer, filename = 'recording.webm') {
  // Whisper wants a File-like object; toFile wraps the buffer with the name so
  // the SDK can set the correct multipart content.
  const file = await toFile(buffer, filename);

  const response = await openai.audio.transcriptions.create({
    file,
    model: TRANSCRIPTION_MODEL,
  });

  return (response.text || '').trim();
}
