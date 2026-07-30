import { describe, it, expect } from 'vitest';
import {
  parseCategoryFilter,
  parseUrgencyFilter,
  parseSearchTerm,
  parseCoverageFilter,
  applyRequestFilters,
  filterRequestsFromQuery,
} from './requestFilters.js';

describe('parseCategoryFilter', () => {
  it('normalizes case to the canonical spelling', () => {
    expect(parseCategoryFilter('food')).toBe('Food');
    expect(parseCategoryFilter('MEDICAL')).toBe('Medical');
    expect(parseCategoryFilter('  shelter  ')).toBe('Shelter');
  });

  it('returns null for unknown or blank values', () => {
    expect(parseCategoryFilter('spaceship')).toBeNull();
    expect(parseCategoryFilter('')).toBeNull();
    expect(parseCategoryFilter(undefined)).toBeNull();
  });
});

describe('parseUrgencyFilter', () => {
  it('normalizes known urgencies', () => {
    expect(parseUrgencyFilter('critical')).toBe('Critical');
    expect(parseUrgencyFilter('Low')).toBe('Low');
  });

  it('returns null for unknown values', () => {
    expect(parseUrgencyFilter('whenever')).toBeNull();
  });
});

describe('parseSearchTerm', () => {
  it('trims and lower-cases the term', () => {
    expect(parseSearchTerm('  Water Needed  ')).toBe('water needed');
  });

  it('returns null for blank or non-string input', () => {
    expect(parseSearchTerm('   ')).toBeNull();
    expect(parseSearchTerm(42)).toBeNull();
    expect(parseSearchTerm(undefined)).toBeNull();
  });
});

describe('parseCoverageFilter', () => {
  it('normalizes known coverage values', () => {
    expect(parseCoverageFilter('uncovered')).toBe('uncovered');
    expect(parseCoverageFilter('COVERED')).toBe('covered');
  });

  it('returns null for unknown or blank values', () => {
    expect(parseCoverageFilter('partial')).toBeNull();
    expect(parseCoverageFilter('')).toBeNull();
    expect(parseCoverageFilter(undefined)).toBeNull();
  });
});

describe('applyRequestFilters', () => {
  const requests = [
    { id: 1, category: 'Food', urgency: 'High', description: 'Need water and canned food', location: 'Oakland', submitterName: 'Maria' },
    { id: 2, category: 'Medical', urgency: 'Critical', description: 'Insulin running low', location: 'Portland', submitterName: 'David' },
    { id: 3, category: 'Food', urgency: 'Low', description: 'Baby formula', location: 'Seattle', submitterName: 'Jordan' },
  ];

  it('returns everything when no filters are given', () => {
    expect(applyRequestFilters(requests, {})).toHaveLength(3);
  });

  it('filters by category', () => {
    const ids = applyRequestFilters(requests, { category: 'Food' }).map((r) => r.id);
    expect(ids).toEqual([1, 3]);
  });

  it('filters by urgency', () => {
    const ids = applyRequestFilters(requests, { urgency: 'Critical' }).map((r) => r.id);
    expect(ids).toEqual([2]);
  });

  it('combines filters with AND semantics', () => {
    const ids = applyRequestFilters(requests, { category: 'Food', urgency: 'Low' }).map((r) => r.id);
    expect(ids).toEqual([3]);
  });

  it('searches across description, location, category, and submitter name', () => {
    // description
    expect(applyRequestFilters(requests, { search: 'insulin' }).map((r) => r.id)).toEqual([2]);
    // location
    expect(applyRequestFilters(requests, { search: 'seattle' }).map((r) => r.id)).toEqual([3]);
    // submitter name
    expect(applyRequestFilters(requests, { search: 'maria' }).map((r) => r.id)).toEqual([1]);
  });

  it('ignores null filter values (the parsers "not provided" signal)', () => {
    const ids = applyRequestFilters(requests, { category: null, urgency: null, search: null, coverage: null }).map((r) => r.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  describe('coverage filter (issue #92)', () => {
    // Same shape the feed annotates each request with: interaction counts.
    const withCoverage = [
      { id: 1, volunteerInterestCount: 0, organizationRespondingCount: 0 }, // uncovered
      { id: 2, volunteerInterestCount: 2, organizationRespondingCount: 0 }, // covered (volunteer)
      { id: 3, volunteerInterestCount: 0, organizationRespondingCount: 1 }, // covered (org)
      { id: 4 }, // counts absent -> treated as uncovered
    ];

    it('keeps only requests with no responders when coverage=uncovered', () => {
      const ids = applyRequestFilters(withCoverage, { coverage: 'uncovered' }).map((r) => r.id);
      expect(ids).toEqual([1, 4]);
    });

    it('keeps only requests with at least one responder when coverage=covered', () => {
      const ids = applyRequestFilters(withCoverage, { coverage: 'covered' }).map((r) => r.id);
      expect(ids).toEqual([2, 3]);
    });
  });
});

describe('filterRequestsFromQuery', () => {
  const requests = [
    { id: 1, category: 'Food', urgency: 'High', description: 'water', location: 'Oakland' },
    { id: 2, category: 'Medical', urgency: 'Critical', description: 'insulin', location: 'Portland' },
  ];

  it('parses raw query params and applies them together', () => {
    const ids = filterRequestsFromQuery(requests, { category: 'food', urgency: 'HIGH' }).map((r) => r.id);
    expect(ids).toEqual([1]);
  });

  it('ignores malformed params rather than returning an empty list', () => {
    const ids = filterRequestsFromQuery(requests, { category: 'nonsense' }).map((r) => r.id);
    expect(ids).toEqual([1, 2]);
  });
});
