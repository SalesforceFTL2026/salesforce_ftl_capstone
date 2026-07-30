// Category / urgency / keyword filtering for the request feeds (issues #81,
// #82). These run in-memory over an already-loaded list of requests, the same
// way the geo-radius filter (services/geocoding/distance.js) does, so a single
// feed query can be narrowed by any combination of location, category,
// urgency, and free-text search without extra database round trips.
//
// Every parser follows the same contract as parseRadiusFilter: it returns a
// normalized value when the param is present and valid, or null when it is
// absent or malformed — so callers skip that filter rather than erroring out.

// The category / urgency vocabularies the rest of the app validates against
// (see requestController). Kept here so the filter parsers can reject values
// outside the known set instead of silently returning an empty feed.
const VALID_CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const VALID_URGENCIES = ['Low', 'Medium', 'High', 'Critical'];
// Coverage filter (issue #92): "uncovered" keeps only needs no one has picked
// up yet; "covered" keeps only ones with at least one responder.
const VALID_COVERAGE = ['uncovered', 'covered'];

// Case-insensitively match a raw query value against a known vocabulary,
// returning the canonical spelling (e.g. "food" -> "Food"). Returns null when
// the value is absent or not in the vocabulary, so an unknown filter is
// ignored rather than filtering everything out.
const normalizeEnum = (value, vocabulary) => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const match = vocabulary.find((v) => v.toLowerCase() === value.trim().toLowerCase());
  return match || null;
};

// Parse the ?category= query param into a canonical category, or null.
export const parseCategoryFilter = (value) => normalizeEnum(value, VALID_CATEGORIES);

// Parse the ?urgency= query param into a canonical urgency, or null.
export const parseUrgencyFilter = (value) => normalizeEnum(value, VALID_URGENCIES);

// Parse the ?search= keyword into a trimmed, lower-cased term, or null when
// absent/blank. Lower-casing here keeps the match itself case-insensitive.
export const parseSearchTerm = (value) => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.trim().toLowerCase();
};

// Parse the ?coverage= query param into 'uncovered' | 'covered', or null.
export const parseCoverageFilter = (value) => normalizeEnum(value, VALID_COVERAGE);

// A request is "covered" once any volunteer or org has responded. Reads the
// counts the feed already annotates each request with (see requestModel).
const isCovered = (r) =>
  (r.volunteerInterestCount || 0) > 0 || (r.organizationRespondingCount || 0) > 0;

// Keep only the requests matching every provided filter. Any argument left
// null (the parsers' "not provided" signal) is skipped, so callers can pass
// the parsed params straight through and the result is narrowed only by the
// filters the client actually sent. The keyword search matches the request's
// description, location, category, and submitter name.
export const applyRequestFilters = (requests, { category, urgency, search, coverage } = {}) => {
  return requests.filter((r) => {
    if (category && r.category !== category) return false;
    if (urgency && r.urgency !== urgency) return false;

    if (coverage === 'uncovered' && isCovered(r)) return false;
    if (coverage === 'covered' && !isCovered(r)) return false;

    if (search) {
      const haystack = [r.description, r.location, r.category, r.submitterName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
};

// Convenience wrapper: parse the raw query object and apply whatever filters
// it contains in one call. Malformed/absent params are ignored (see parsers).
export const filterRequestsFromQuery = (requests, query = {}) =>
  applyRequestFilters(requests, {
    category: parseCategoryFilter(query.category),
    urgency: parseUrgencyFilter(query.urgency),
    search: parseSearchTerm(query.search),
    coverage: parseCoverageFilter(query.coverage),
  });

export default {
  parseCategoryFilter,
  parseUrgencyFilter,
  parseSearchTerm,
  parseCoverageFilter,
  applyRequestFilters,
  filterRequestsFromQuery,
};
