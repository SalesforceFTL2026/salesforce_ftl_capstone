# Request Feed Filter & Search Contract

The contract the frontend relies on for narrowing the request feeds (issues
#81, #82, #83). It covers the query params the two feed endpoints accept, how
they compose, and how invalid input is handled.

## Endpoints

Both endpoints require authentication (`Authorization: Bearer <token>`) and
return the standard envelope `{ success, data: [ ...requests ] }`.

| Endpoint | What it returns | Sorted by |
| --- | --- | --- |
| `GET /api/requests/prioritized` | Active requests (`pending`, `in-progress`), each annotated with `volunteerInterestCount` and `organizationRespondingCount` | AI `priorityScore`, high → low |
| `GET /api/requests` | Every request, any status | `createdAt`, newest first |

All query params below apply to **both** endpoints.

## Query params

| Param | Type | Example | Meaning |
| --- | --- | --- | --- |
| `search` | string | `?search=water` | Keyword. Case-insensitive substring match against the request's **description, location, category, and submitter name**. |
| `category` | enum | `?category=Food` | Exact category. One of `Food`, `Shelter`, `Medical`, `Transport`, `Other`. Case-insensitive on input; matched to the canonical spelling. |
| `urgency` | enum | `?urgency=Critical` | Exact urgency. One of `Low`, `Medium`, `High`, `Critical`. Case-insensitive on input. |
| `lat`, `lng`, `radius` | number | `?lat=30.26&lng=-97.74&radius=10` | Geo-radius filter (issues #115/#116). Keeps requests within `radius` **miles** of the point and annotates each with `distanceMiles`. All three are required together. |

### Composition

Filters are **AND**-combined — a request must satisfy every provided filter to
appear. Any combination is valid, e.g.:

```
GET /api/requests/prioritized?category=Medical&urgency=Critical&search=insulin&lat=30.26&lng=-97.74&radius=25
```

The result stays sorted by the endpoint's default order (priority for the
prioritized feed) — filtering never reorders the feed.

### Invalid / missing input

Filters are **lenient**: a param that is absent, blank, or invalid is simply
**ignored** (that dimension is not filtered) rather than returning an error or
an empty list.

- `category`/`urgency` values outside the allowed set → ignored.
- `search` that is blank/whitespace → ignored.
- A geo-radius filter missing any of `lat`/`lng`/`radius`, or with an
  out-of-range/non-numeric value → ignored.

So `GET /api/requests/prioritized` (no params) and
`GET /api/requests/prioritized?category=&search=` both return the full feed.

## Frontend usage

`frontend/src/utils/requests.js` builds these params for you:

```js
// near:    { lat, lng, radiusMiles } | undefined     ("Near me")
// filters: { search, category, urgency }              (empty strings = no filter)
getPrioritizedRequests(near, filters);
getAllRequests(near, filters); // same filter object shape
```

The keyword box (`components/RequestFilterBar/RequestFilterBar.jsx`) debounces
the `search` term (300 ms, via `hooks/useDebounce.js`) before it reaches the
query, so typing doesn't fire a request per keystroke (issue #85).

## Where this lives on the backend

- Parsing + matching: `backend/services/filters/requestFilters.js`
- Applied in: `getPrioritizedRequests` and `getAllRequests` in
  `backend/controllers/requestController.js`
- Geo-radius filter: `backend/services/geocoding/distance.js`
