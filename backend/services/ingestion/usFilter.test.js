import { describe, it, expect } from 'vitest';
import { isInUnitedStates, filterUnitedStates } from './usFilter.js';

describe('isInUnitedStates', () => {
  it('accepts points in the contiguous US', () => {
    expect(isInUnitedStates(37.7749, -122.4194)).toBe(true); // San Francisco
    expect(isInUnitedStates(40.7128, -74.006)).toBe(true); // New York
  });

  it('accepts Alaska, Hawaii, and major territories', () => {
    expect(isInUnitedStates(61.2181, -149.9003)).toBe(true); // Anchorage, AK
    expect(isInUnitedStates(21.3069, -157.8583)).toBe(true); // Honolulu, HI
    expect(isInUnitedStates(18.4655, -66.1057)).toBe(true); // San Juan, PR
    expect(isInUnitedStates(13.4443, 144.7937)).toBe(true); // Guam
  });

  it('rejects points outside the US', () => {
    expect(isInUnitedStates(51.5074, -0.1278)).toBe(false); // London
    expect(isInUnitedStates(19.4326, -99.1332)).toBe(false); // Mexico City
    expect(isInUnitedStates(-33.8688, 151.2093)).toBe(false); // Sydney
  });

  it('rejects non-finite / missing coordinates', () => {
    expect(isInUnitedStates(NaN, -122)).toBe(false);
    expect(isInUnitedStates(37, undefined)).toBe(false);
    expect(isInUnitedStates(null, null)).toBe(false);
  });
});

describe('filterUnitedStates', () => {
  it('keeps only US events and drops the rest', () => {
    const events = [
      { id: 'sf', latitude: 37.7749, longitude: -122.4194 },
      { id: 'london', latitude: 51.5074, longitude: -0.1278 },
      { id: 'anchorage', latitude: 61.2181, longitude: -149.9003 },
      { id: 'nocoords' }, // undefined lat/lng -> dropped
    ];
    const ids = filterUnitedStates(events).map((e) => e.id);
    expect(ids).toEqual(['sf', 'anchorage']);
  });

  it('returns an empty array when nothing is in the US', () => {
    const events = [{ id: 'sydney', latitude: -33.8688, longitude: 151.2093 }];
    expect(filterUnitedStates(events)).toEqual([]);
  });
});
