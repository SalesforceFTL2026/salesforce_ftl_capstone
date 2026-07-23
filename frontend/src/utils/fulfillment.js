// Estimate a request's "expected fulfillment" date from its urgency, since the
// backend doesn't store a real fulfillment date yet. The estimate is relative
// to when the request was created:
//   Critical → same day, High → +1 day, Medium → +3 days, Low → +7 days.
// This gives the calendar something meaningful to plot today; swap for a real
// request.fulfillmentDate once the backend provides one.

const DAYS_BY_URGENCY = {
  Critical: 0,
  High: 1,
  Medium: 3,
  Low: 7,
};

// Returns a Date for the request's estimated fulfillment, or null if we can't
// determine a base date. Prefers a real fulfillmentDate if the API ever sets one.
export function estimateFulfillment(request) {
  if (request?.fulfillmentDate) {
    return new Date(request.fulfillmentDate);
  }
  if (!request?.createdAt) return null;

  const base = new Date(request.createdAt);
  const offset = DAYS_BY_URGENCY[request.urgency] ?? 3; // default to Medium
  base.setDate(base.getDate() + offset);
  return base;
}
