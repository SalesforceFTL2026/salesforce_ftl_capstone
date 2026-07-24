import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculatePriorityScore, getScoreBreakdown, hasLifeSafetySignal } from './scoring.js';

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
  it('ranks higher urgency above lower for the same category/recency/cluster', () => {
    const base = { category: 'Food', createdAt: hoursAgo(0.5) };
    const low = calculatePriorityScore({ ...base, urgency: 'Low' });
    const critical = calculatePriorityScore({ ...base, urgency: 'Critical' });
    expect(critical).toBeGreaterThan(low);
  });

  it('defaults unknown urgency to the Low weight', () => {
    const bogus = calculatePriorityScore({ category: 'Food', urgency: 'Bogus', createdAt: hoursAgo(0.5) });
    const low = calculatePriorityScore({ category: 'Food', urgency: 'Low', createdAt: hoursAgo(0.5) });
    expect(bogus).toBe(low);
  });

  it('ranks a more critical category above a less critical one at equal urgency', () => {
    const base = { urgency: 'High', createdAt: hoursAgo(0.5) };
    const medical = calculatePriorityScore({ ...base, category: 'Medical' });
    const transport = calculatePriorityScore({ ...base, category: 'Transport' });
    expect(medical).toBeGreaterThan(transport);
  });

  it('increases with cluster density but with diminishing returns', () => {
    const req = { category: 'Food', urgency: 'Low', createdAt: hoursAgo(0.5) };
    const none = calculatePriorityScore(req, []);
    const three = calculatePriorityScore(req, new Array(3).fill({}));
    const ten = calculatePriorityScore(req, new Array(10).fill({}));
    // Monotonic increase...
    expect(three).toBeGreaterThan(none);
    expect(ten).toBeGreaterThan(three);
    // ...but diminishing: going 0->3 adds more than 3->10.
    expect(three - none).toBeGreaterThan(ten - three);
  });

  it('decays the score smoothly as the request ages (no bucket jumps)', () => {
    const req = { category: 'Food', urgency: 'Low' };
    const fresh = calculatePriorityScore({ ...req, createdAt: hoursAgo(0.5) });
    const sixHrs = calculatePriorityScore({ ...req, createdAt: hoursAgo(6) });
    const day = calculatePriorityScore({ ...req, createdAt: hoursAgo(24) });
    const old = calculatePriorityScore({ ...req, createdAt: hoursAgo(200) });
    expect(fresh).toBeGreaterThan(sixHrs);
    expect(sixHrs).toBeGreaterThan(day);
    expect(day).toBeGreaterThan(old);
  });

  it('never exceeds 100', () => {
    const score = calculatePriorityScore(
      { category: 'Medical', urgency: 'Critical', description: 'needs epipen now', createdAt: hoursAgo(0.5) },
      new Array(20).fill({})
    );
    expect(score).toBeLessThanOrEqual(100);
  });

  it('treats a missing similarRequests argument as an empty cluster', () => {
    const withDefault = calculatePriorityScore({ category: 'Food', urgency: 'High', createdAt: hoursAgo(0.5) });
    const withEmpty = calculatePriorityScore({ category: 'Food', urgency: 'High', createdAt: hoursAgo(0.5) }, []);
    expect(withDefault).toBe(withEmpty);
  });

  it('is deterministic for a fixed input and clock', () => {
    const req = { category: 'Shelter', urgency: 'Medium', description: 'family of four', createdAt: hoursAgo(3) };
    const similar = [{}, {}];
    expect(calculatePriorityScore(req, similar)).toBe(calculatePriorityScore(req, similar));
  });
});

describe('life-safety detection', () => {
  it('flags immediate threats to life from the description', () => {
    expect(hasLifeSafetySignal({ category: 'Medical', description: 'child needs an EpiPen after a bee sting' })).toBe(true);
    expect(hasLifeSafetySignal({ category: 'Medical', description: 'Diabetic patient out of insulin' })).toBe(true);
    expect(hasLifeSafetySignal({ category: 'Food', description: 'running low on canned goods' })).toBe(false);
  });

  it('floors severity so a life-safety need outranks a non-critical Critical request', () => {
    const base = { createdAt: hoursAgo(0.5) };
    // A low-urgency epipen request...
    const epipen = calculatePriorityScore({ ...base, category: 'Medical', urgency: 'Low', description: 'needs an epipen' });
    // ...beats a Critical transport request with no life-safety signal.
    const transport = calculatePriorityScore({ ...base, category: 'Transport', urgency: 'Critical', description: 'need a ride to a shelter' });
    expect(epipen).toBeGreaterThan(transport);
  });
});

describe('life-safety override (LLM classifier verdict)', () => {
  // A description with no matching KEYWORD, so keyword detection alone says false.
  const paraphrase = { category: 'Other', urgency: 'Low', description: "he's turning blue and won't respond", createdAt: hoursAgo(0.5) };

  it('floors severity when the override is true even without a keyword match', () => {
    const withoutOverride = calculatePriorityScore(paraphrase, []);
    const withOverride = calculatePriorityScore(paraphrase, [], true);
    expect(withOverride).toBeGreaterThan(withoutOverride);
  });

  it('lets a false override suppress a keyword the caller has judged non-critical', () => {
    // "in labor" is a keyword, but say the classifier decided it was a false match.
    const req = { category: 'Medical', urgency: 'Low', description: 'volunteered as a doula, helping someone in labor', createdAt: hoursAgo(0.5) };
    const keywordFloored = calculatePriorityScore(req, []); // keyword path -> floored
    const overridden = calculatePriorityScore(req, [], false); // classifier -> not life-safety
    expect(overridden).toBeLessThan(keywordFloored);
  });

  it('ignores a non-boolean override and falls back to keyword detection', () => {
    const req = { category: 'Medical', urgency: 'Low', description: 'needs an epipen', createdAt: hoursAgo(0.5) };
    // undefined override => keyword scan still flags the epipen.
    expect(calculatePriorityScore(req, [], undefined)).toBe(calculatePriorityScore(req, []));
  });

  it('reports the override verdict in getScoreBreakdown.lifeSafety', () => {
    expect(getScoreBreakdown(paraphrase, [], true).lifeSafety).toBe(true);
    expect(getScoreBreakdown(paraphrase, [], false).lifeSafety).toBe(false);
  });
});

describe('getScoreBreakdown', () => {
  it('returns rounded components that sum to the total (when uncapped)', () => {
    const b = getScoreBreakdown({ category: 'Food', urgency: 'High', createdAt: hoursAgo(3) }, [{}, {}]);
    expect(b.severityScore + b.clusterScore + b.recencyScore).toBe(b.totalScore);
    expect(b.similarRequestCount).toBe(2);
    expect(b.maxima).toEqual({ severity: 50, cluster: 20, recency: 30 });
  });

  it('caps totalScore at 100', () => {
    const b = getScoreBreakdown(
      { category: 'Medical', urgency: 'Critical', description: 'not breathing', createdAt: hoursAgo(0.5) },
      new Array(10).fill({})
    );
    expect(b.totalScore).toBeLessThanOrEqual(100);
  });

  it('reports whether a life-safety signal was detected', () => {
    const withSignal = getScoreBreakdown({ category: 'Medical', urgency: 'Low', description: 'insulin running out', createdAt: hoursAgo(1) });
    const without = getScoreBreakdown({ category: 'Food', urgency: 'Low', description: 'need groceries', createdAt: hoursAgo(1) });
    expect(withSignal.lifeSafety).toBe(true);
    expect(without.lifeSafety).toBe(false);
  });

  it('agrees with calculatePriorityScore on the total', () => {
    const req = { category: 'Medical', urgency: 'Medium', createdAt: hoursAgo(12) };
    const similar = [{}, {}, {}];
    expect(getScoreBreakdown(req, similar).totalScore).toBe(
      calculatePriorityScore(req, similar)
    );
  });
});
