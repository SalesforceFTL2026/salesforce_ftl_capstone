import rateLimit from 'express-rate-limit';

/**
 * Rate limiters.
 *
 * Three tiers, tightest where abuse is most costly:
 *   - authLimiter:  login/signup. Blunts credential-stuffing and account probing.
 *   - aiLimiter:    endpoints that spend metered/paid LLM + speech quota
 *                   (chat, voice, prioritization, voice transcription). A single
 *                   authenticated caller could otherwise drain the daily free
 *                   quota or run up paid usage.
 *   - apiLimiter:   a generous catch-all for everything else, so a runaway client
 *                   can't hammer the API.
 *
 * Keyed per user when logged in (req.user set by requireAuth), else per IP, so
 * one abusive account can't spend from behind a shared IP and vice versa. All
 * three return JSON in the app's { success, message } shape rather than the
 * library's default plain-text body.
 */

const keyByUserOrIp = (req /*, res */) => req.user?.id || req.ip;

const jsonLimitMessage = (message) => ({ success: false, message });

// Standard config shared by every limiter: return RateLimit-* headers, drop the
// legacy X-RateLimit-* ones, and key per user/IP.
const base = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
};

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 auth attempts per IP per window
  message: jsonLimitMessage(
    'Too many attempts. Please wait a few minutes and try again.'
  ),
});

export const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 AI turns per user/IP per minute
  message: jsonLimitMessage(
    'You are sending requests too quickly. Please slow down and try again shortly.'
  ),
});

export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000, // 1 minute
  max: 120, // generous catch-all
  message: jsonLimitMessage(
    'Too many requests. Please slow down and try again shortly.'
  ),
});
