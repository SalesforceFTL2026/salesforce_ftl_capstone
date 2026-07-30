import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two boundaries requireAuth/requireAdmin depend on: the JWT verifier
// and the user lookup. Same offline pattern as the AI-service tests — every case
// controls exactly what the token decodes to and what the DB returns.
vi.mock('../services/auth/authService.js', () => ({
  verifyToken: vi.fn(),
}));
vi.mock('../services/database/prisma.js', () => ({
  default: { user: { findUnique: vi.fn() } },
}));

import { verifyToken } from '../services/auth/authService.js';
import prisma from '../services/database/prisma.js';
import { requireAuth, requireAdmin, attachUserIfPresent } from './auth.js';

// Minimal Express req/res/next doubles. res.status(n).json(body) records both so
// assertions can read them back.
const makeRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  it('401s when the Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('401s when the header is not a Bearer token', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when the token is invalid or expired (verifyToken throws)', async () => {
    verifyToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const req = { headers: { authorization: 'Bearer badtoken' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/invalid or has expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when the token is valid but the user no longer exists', async () => {
    verifyToken.mockReturnValue({ userId: 'gone', role: 'help-seeker' });
    prisma.user.findUnique.mockResolvedValue(null);
    const req = { headers: { authorization: 'Bearer good' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/could no longer be found/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the freshly-loaded user and calls next on success', async () => {
    const dbUser = { id: 'u1', role: 'volunteer', name: 'Vol' };
    verifyToken.mockReturnValue({ userId: 'u1', role: 'help-seeker' }); // role from DB, not token
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const req = { headers: { authorization: 'Bearer good' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual(dbUser);
    // The role must come from the fresh DB record, not the (possibly stale) token.
    expect(req.user.role).toBe('volunteer');
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('401s (defensively) when requireAuth did not run first', () => {
    const req = {}; // no req.user
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s a logged-in non-admin', () => {
    const req = { user: { id: 'u1', role: 'organization' } };
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for an admin', () => {
    const req = { user: { id: 'a1', role: 'admin' } };
    const res = makeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('attachUserIfPresent', () => {
  it('continues anonymously (no req.user) when no token is present', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await attachUserIfPresent(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('continues anonymously when the token is bad, never erroring', async () => {
    verifyToken.mockImplementation(() => {
      throw new Error('bad token');
    });
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = makeRes();
    const next = vi.fn();

    await attachUserIfPresent(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('attaches the user when a valid token is present', async () => {
    const dbUser = { id: 'u2', role: 'help-seeker' };
    verifyToken.mockReturnValue({ userId: 'u2' });
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const req = { headers: { authorization: 'Bearer good' } };
    const res = makeRes();
    const next = vi.fn();

    await attachUserIfPresent(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual(dbUser);
  });
});
