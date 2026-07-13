import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * Auth service: reusable authentication logic lives here.
 */

// How much work bcrypt does when scrambling a password.
// Higher = more secure but slower. 10 is a common, safe default.
const SALT_ROUNDS = 10;

// How long a login token stays valid before the user must log in again.
const TOKEN_EXPIRES_IN = '7d';

/**
 * Turn a plain-text password into a safe, one-way hash for storage.
 *
 * @param {string} plainPassword - the password the user typed
 * @returns {Promise<string>} the hashed password to store in the database
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Check whether a typed password matches the stored hash.
 *
 * @param {string} plainPassword - the password the user typed at login
 * @param {string} passwordHash - the hash we saved at signup
 * @returns {Promise<boolean>} true if they match, false if not
 */
export async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Create a signed login token (JWT) for a user.
 * The payload carries only safe, non-secret identifiers.
 *
 * @param {object} user - the user we're logging in (needs id and role)
 * @returns {string} a signed JWT string
 */
export function createToken(user) {
  const payload = { userId: user.id, role: user.role };
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

/**
 * Verify a token is real and unexpired, and return its payload.
 * Throws if the token is invalid or expired.
 *
 * @param {string} token - the JWT string from the browser
 * @returns {object} the decoded payload, e.g. { userId, role }
 */
export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET_KEY);
}
