import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculatePriorityScore, getScoreBreakdown } from './scoring.js';

// The score includes a time-decay component based on Date.now(), so we freeze
// the clock. "NOW" is our fixed reference; helpers build createdAt timestamps
// a given number of hours in the past relative to it.
const NOW = new Date('2026-01-15T12:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculatePriorityScore', () => {
  it('adds urgency points by level (Critical highest)', () => {
    // Same recency (fresh) and no cluster, so only urgency varies.
    const base = { createdAt: hoursAgo(0.5) };
    const low = calculatePriorityScore({ ...base, urgency: 'Low' });
    const critical = calculatePriorityScore({ ...base, urgency: 'Critical' });
    // Fresh (<1h) = 30 time points, 0 cluster. Low=10, Critical=40.
    expect(low).toBe(40);
    expect(critical).toBe(70);
    expect(critical).toBeGreaterThan(low);
  });

  it('defaults unknown urgency to the Low weight (10)', () => {
    const score = calculatePriorityScore({ urgency: 'Bogus', createdAt: hoursAgo(0.5) });
    expect(score).toBe(40); // 10 urgency + 0 cluster + 30 time
  });

  it('increases with cluster density but caps the cluster component at 30', () => {
    const req = { urgency: 'Low', createdAt: hoursAgo(0.5) };
    const three = calculatePriorityScore(req, new Array(3).fill({}));
    const ten = calculatePriorityScore(req, new Array(10).fill({}));
    // cluster = min(n*5, 30): 3 -> 15, 10 -> 30 (capped, not 50).
    expect(three).toBe(10 + 15 + 30);
    expect(ten).toBe(10 + 30 + 30);
  });

  it('decays the time component as the request ages', () => {
    const req = { urgency: 'Low' };
    expect(calculatePriorityScore({ ...req, createdAt: hoursAgo(0.5) })).toBe(40); // <1h -> 30
    expect(calculatePriorityScore({ ...req, createdAt: hoursAgo(3) })).toBe(35); // <6h -> 25
    expect(calculatePriorityScore({ ...req, createdAt: hoursAgo(12) })).toBe(30); // <24h -> 20
    expect(calculatePriorityScore({ ...req, createdAt: hoursAgo(48) })).toBe(20); // <72h -> 10
    expect(calculatePriorityScore({ ...req, createdAt: hoursAgo(200) })).toBe(15); // older -> 5
  });

  it('never exceeds 100', () => {
    const score = calculatePriorityScore(
      { urgency: 'Critical', createdAt: hoursAgo(0.5) },
      new Array(20).fill({})
    );
    // 40 + 30 + 30 = 100 exactly; larger inputs can't push it past the cap.
    expect(score).toBe(100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('treats a missing similarRequests argument as an empty cluster', () => {
    const withDefault = calculatePriorityScore({ urgency: 'High', createdAt: hoursAgo(0.5) });
    const withEmpty = calculatePriorityScore({ urgency: 'High', createdAt: hoursAgo(0.5) }, []);
    expect(withDefault).toBe(withEmpty);
  });
});

describe('getScoreBreakdown', () => {
  it('returns components that sum to the total (when uncapped)', () => {
    const b = getScoreBreakdown({ urgency: 'High', createdAt: hoursAgo(3) }, [{}, {}]);
    expect(b).toMatchObject({
      urgencyScore: 30,
      clusterScore: 10, // 2 * 5
      timeScore: 25, // <6h
      totalScore: 65,
      similarRequestCount: 2,
    });
    expect(b.urgencyScore + b.clusterScore + b.timeScore).toBe(b.totalScore);
  });

  it('caps totalScore at 100 while leaving components uncapped-summed', () => {
    const b = getScoreBreakdown({ urgency: 'Critical', createdAt: hoursAgo(0.5) }, new Array(10).fill({}));
    expect(b.totalScore).toBe(100);
  });

  it('agrees with calculatePriorityScore on the total', () => {
    const req = { urgency: 'Medium', createdAt: hoursAgo(12) };
    const similar = [{}, {}, {}];
    expect(getScoreBreakdown(req, similar).totalScore).toBe(
      calculatePriorityScore(req, similar)
    );
  });
});
