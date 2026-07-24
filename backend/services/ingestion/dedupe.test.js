import { describe, it, expect } from 'vitest';
import { dedupeEvents } from './dedupe.js';

// Coordinates ~5 miles apart in the SF Bay Area (well inside the 100mi window).
const SF = { latitude: 37.7749, longitude: -122.4194 };
const NEAR_SF = { latitude: 37.8044, longitude: -122.2712 }; // Oakland, ~10mi
const LA = { latitude: 34.0522, longitude: -118.2437 }; // ~347mi, distinct

const at = (iso) => new Date(iso).toISOString();

// Build a normalized-event-shaped object with sensible defaults.
const evt = (over = {}) => ({
  source: 'GDACS',
  externalId: 'x1',
  severity: 'Medium',
  occurredAt: at('2026-01-15T12:00:00Z'),
  ...SF,
  ...over,
});

describe('dedupeEvents', () => {
  it('keeps distinct events untouched', () => {
    const events = [
      evt({ externalId: 'a', ...SF }),
      evt({ externalId: 'b', ...LA }), // far away -> not a duplicate
    ];
    const { events: kept, removed } = dedupeEvents(events);
    expect(kept).toHaveLength(2);
    expect(removed).toBe(0);
  });

  it('merges events close in both space and time', () => {
    const events = [
      evt({ source: 'GDACS', ...SF }),
      evt({ source: 'EONET', ...NEAR_SF }), // ~10mi, same time -> duplicate
    ];
    const { events: kept, removed } = dedupeEvents(events);
    expect(kept).toHaveLength(1);
    expect(removed).toBe(1);
  });

  it('does NOT merge nearby events that are far apart in time', () => {
    const events = [
      evt({ occurredAt: at('2026-01-01T00:00:00Z') }),
      evt({ occurredAt: at('2026-01-15T00:00:00Z') }), // 14 days later > 72h
    ];
    const { removed } = dedupeEvents(events);
    expect(removed).toBe(0);
  });

  it('keeps the higher-severity event when merging', () => {
    const events = [
      evt({ source: 'EONET', severity: 'Low' }),
      evt({ source: 'GDACS', severity: 'Critical', ...NEAR_SF }),
    ];
    const { events: kept } = dedupeEvents(events);
    expect(kept).toHaveLength(1);
    expect(kept[0].severity).toBe('Critical');
  });

  it('breaks severity ties by the more recent event', () => {
    const older = evt({ severity: 'High', occurredAt: at('2026-01-15T00:00:00Z') });
    const newer = evt({ severity: 'High', occurredAt: at('2026-01-16T00:00:00Z'), ...NEAR_SF });
    const { events: kept } = dedupeEvents([older, newer]);
    expect(kept).toHaveLength(1);
    expect(kept[0].occurredAt).toBe(newer.occurredAt);
  });

  it('treats events with missing coordinates as never-duplicate', () => {
    const events = [
      evt({ latitude: undefined, longitude: undefined }),
      evt({ latitude: undefined, longitude: undefined }),
    ];
    const { removed } = dedupeEvents(events);
    expect(removed).toBe(0);
  });

  it('does not mutate the input array', () => {
    const events = [evt({ ...SF }), evt({ ...NEAR_SF })];
    const snapshot = JSON.stringify(events);
    dedupeEvents(events);
    expect(JSON.stringify(events)).toBe(snapshot);
  });

  it('returns an empty result for no events', () => {
    expect(dedupeEvents([])).toEqual({ events: [], removed: 0 });
  });
});
