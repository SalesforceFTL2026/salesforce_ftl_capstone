import { describe, it, expect, vi, beforeEach } from 'vitest';

// Authorization-focused tests for the request controller: who may read the
// shared feeds, who may read a single request, and the role gates on the
// write/interaction endpoints. The DB and AI boundaries are mocked so these run
// offline; the real authorization logic (and the real utils/roles helper) run.

vi.mock('../models/requestModel.js', () => ({
  getAllRequests: vi.fn(),
  getPrioritizedRequests: vi.fn(),
  getRequestById: vi.fn(),
  getRequestsByUser: vi.fn(),
  createRequest: vi.fn(),
}));
vi.mock('../models/volunteerTaskModel.js', () => ({ withdrawFromRequestTasks: vi.fn() }));
vi.mock('../models/notificationModel.js', () => ({ createNotification: vi.fn() }));
vi.mock('../services/database/prisma.js', () => ({
  default: {
    response: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock('../services/ai/prioritizer.js', () => ({ prioritizeRequest: vi.fn() }));
vi.mock('../services/ai/index.js', () => ({
  transcribeAudio: vi.fn(),
  extractRequestFields: vi.fn(),
}));
vi.mock('../services/geocoding/geocoder.js', () => ({
  geocodeLocation: vi.fn(),
  haversineMiles: vi.fn(),
}));

import * as requestModel from '../models/requestModel.js';
import {
  getAllRequests,
  getPrioritizedRequests,
  getRequestById,
  createRequest,
  interactWithRequest,
  assignToRequest,
} from './requestController.js';

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

const seeker = { id: 'seeker1', role: 'help-seeker', name: 'Seeker' };
const volunteer = { id: 'vol1', role: 'volunteer', name: 'Vol' };
const org = { id: 'org1', role: 'organization', name: 'Org' };
const admin = { id: 'admin1', role: 'admin', name: 'Admin' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAllRequests — feed visibility', () => {
  it('403s a help-seeker (they must not browse everyone else\'s requests)', async () => {
    const res = makeRes();
    await getAllRequests({ user: seeker, query: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(requestModel.getAllRequests).not.toHaveBeenCalled();
  });

  it.each([
    ['volunteer', volunteer],
    ['organization', org],
    ['admin', admin],
  ])('lets a %s read the full feed', async (_label, user) => {
    requestModel.getAllRequests.mockResolvedValue([{ id: 'r1' }]);
    const res = makeRes();
    await getAllRequests({ user, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([{ id: 'r1' }]);
  });
});

describe('getPrioritizedRequests — feed visibility', () => {
  it('403s a help-seeker', async () => {
    const res = makeRes();
    await getPrioritizedRequests({ user: seeker, query: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(requestModel.getPrioritizedRequests).not.toHaveBeenCalled();
  });

  it('lets a volunteer read the prioritized feed', async () => {
    requestModel.getPrioritizedRequests.mockResolvedValue([]);
    const res = makeRes();
    await getPrioritizedRequests({ user: volunteer, query: {} }, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('getRequestById — detail visibility', () => {
  it('lets a help-seeker read their OWN request', async () => {
    requestModel.getRequestById.mockResolvedValue({ id: 'r1', userId: 'seeker1' });
    const res = makeRes();
    await getRequestById({ user: seeker, params: { id: 'r1' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe('r1');
  });

  it('403s a help-seeker reading someone ELSE\'s request', async () => {
    requestModel.getRequestById.mockResolvedValue({ id: 'r2', userId: 'other-seeker' });
    const res = makeRes();
    await getRequestById({ user: seeker, params: { id: 'r2' } }, res);
    expect(res.statusCode).toBe(403);
  });

  it('lets a volunteer read any request', async () => {
    requestModel.getRequestById.mockResolvedValue({ id: 'r3', userId: 'some-seeker' });
    const res = makeRes();
    await getRequestById({ user: volunteer, params: { id: 'r3' } }, res);
    expect(res.statusCode).toBe(200);
  });

  it('404s (not 403) when the request does not exist', async () => {
    requestModel.getRequestById.mockResolvedValue(null);
    const res = makeRes();
    await getRequestById({ user: volunteer, params: { id: 'nope' } }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('role gates on writes/interactions', () => {
  it('403s a non-help-seeker trying to create a request', async () => {
    const res = makeRes();
    await createRequest({ user: volunteer, body: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(requestModel.createRequest).not.toHaveBeenCalled();
  });

  it('403s a non-volunteer expressing interest', async () => {
    const res = makeRes();
    await interactWithRequest({ user: org, params: { id: 'r1' }, body: {} }, res);
    expect(res.statusCode).toBe(403);
  });

  it('403s a non-organization assigning a request', async () => {
    const res = makeRes();
    await assignToRequest({ user: volunteer, params: { id: 'r1' } }, res);
    expect(res.statusCode).toBe(403);
  });
});
