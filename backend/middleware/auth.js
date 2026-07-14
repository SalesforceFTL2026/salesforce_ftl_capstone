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
 * requireRole: restrict a route to specific user roles.
 *
 * Use it AFTER requireAuth so req.user is already set, e.g.
 *   router.get('/organization', requireAuth, requireRole('organization'), handler)
 *
 * @param {...string} allowedRoles - the roles permitted to continue
 * @returns {import('express').RequestHandler} middleware enforcing the roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // requireAuth should have set req.user. If it didn't, fail closed.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to do that.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }

    next();
  };
}
