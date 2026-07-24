import { describe, it, expect } from 'vitest';
import { distanceMiles, parseRadiusFilter, filterWithinRadius } from './distance.js';

describe('distanceMiles (haversine)', () => {
  it('returns 0 for identical points', () => {
    expect(distanceMiles(37.77, -122.42, 37.77, -122.42)).toBe(0);
  });

  it('matches a known city-to-city distance within tolerance', () => {
    // San Francisco -> Los Angeles is ~347 miles great-circle.
    const d = distanceMiles(37.7749, -122.4194, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(360);
  });

  it('is symmetric', () => {
    const a = distanceMiles(40.7128, -74.006, 41.8781, -87.6298);
    const b = distanceMiles(41.8781, -87.6298, 40.7128, -74.006);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('parseRadiusFilter', () => {
  it('parses valid string query params into numbers', () => {
    expect(parseRadiusFilter({ lat: '37.77', lng: '-122.42', radius: '25' })).toEqual({
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 25,
    });
  });

  it('returns null when any param is missing', () => {
    expect(parseRadiusFilter({ lat: '37.77', lng: '-122.42' })).toBeNull();
    expect(parseRadiusFilter({})).toBeNull();
    expect(parseRadiusFilter()).toBeNull();
  });

  it('returns null for out-of-range coordinates', () => {
    expect(parseRadiusFilter({ lat: '91', lng: '0', radius: '10' })).toBeNull();
    expect(parseRadiusFilter({ lat: '0', lng: '181', radius: '10' })).toBeNull();
  });

  it('returns null for a non-positive or non-numeric radius', () => {
    expect(parseRadiusFilter({ lat: '0', lng: '0', radius: '0' })).toBeNull();
    expect(parseRadiusFilter({ lat: '0', lng: '0', radius: '-5' })).toBeNull();
    expect(parseRadiusFilter({ lat: '0', lng: '0', radius: 'abc' })).toBeNull();
  });
});

describe('filterWithinRadius', () => {
  const center = { lat: 37.7749, lng: -122.4194, radiusMiles: 50 }; // San Francisco, 50mi

  const requests = [
    { id: 'oakland', latitude: 37.8044, longitude: -122.2712 }, // ~10mi, in
    { id: 'sanjose', latitude: 37.3382, longitude: -121.8863 }, // ~42mi, in
    { id: 'la', latitude: 34.0522, longitude: -118.2437 }, // ~347mi, out
    { id: 'nocoords', description: 'unlocatable request' }, // dropped
  ];

  it('keeps only requests within the radius', () => {
    const ids = filterWithinRadius(requests, center).map((r) => r.id);
    expect(ids).toContain('oakland');
    expect(ids).toContain('sanjose');
    expect(ids).not.toContain('la');
  });

  it('drops requests without usable coordinates', () => {
    const ids = filterWithinRadius(requests, center).map((r) => r.id);
    expect(ids).not.toContain('nocoords');
  });

  it('annotates survivors with a rounded distanceMiles', () => {
    const oakland = filterWithinRadius(requests, center).find((r) => r.id === 'oakland');
    expect(oakland.distanceMiles).toBeGreaterThan(0);
    // Rounded to one decimal place.
    expect(oakland.distanceMiles).toBe(Math.round(oakland.distanceMiles * 10) / 10);
  });

  it('does not mutate the input objects', () => {
    const input = [{ id: 'a', latitude: 37.8, longitude: -122.27 }];
    filterWithinRadius(input, center);
    expect(input[0]).not.toHaveProperty('distanceMiles');
  });
});
