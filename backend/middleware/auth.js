import { verifyToken } from '../services/auth/authService.js';
import prisma from '../services/database/prisma.js';

/**
 * requireAuth: a gatekeeper for protected routes.
 *
 * It reads the login token from the request, verifies it, loads the user,
 * and attaches that user to req.user so the next handler can use it.
 * If anything is wrong, it stops the request with a 401.
 */
export async function requireAuth(req, res, next) {
  try {
    // 1. The token arrives in the "Authorization" header, formatted as:
    //    "Bearer <token>". Grab the header and split off the token part.
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to do that.',
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify the token. This throws if it's fake, tampered, or expired.
    const payload = verifyToken(token);

    // 3. Load the user named in the token so handlers have fresh user data.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Your account could no longer be found.',
      });
    }

    // 4. Attach the user to the request so the next handler can read it.
    req.user = user;

    // 5. All good — let the request continue to the actual route handler.
    next();
  } catch (error) {
    // verifyToken throws for invalid/expired tokens — treat as unauthorized.
    return res.status(401).json({
      success: false,
      message: 'Your session is invalid or has expired. Please log in again.',
    });
  }
}

/**
 * attachUserIfPresent: soft version of requireAuth.
 * If a valid token is present, attach req.user. If not, just continue
 * (used for routes that work for both logged-in and anonymous users).
 */
export async function attachUserIfPresent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user) req.user = user;
    }
  } catch (error) {
    // Bad/expired token on an optional route — ignore and continue anonymously.
  }
  next();
}
