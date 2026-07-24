# Backend Testing Guide

We use [Vitest](https://vitest.dev/) for backend tests. It runs our ESM code
natively (no Babel/Jest config), and it's the same runner the frontend can use.

## Running tests

```bash
cd backend

npm test              # run the whole suite once (CI-style)
npm run test:watch    # re-run on file change while developing
npm run test:coverage # run with a coverage report
```

## Where tests live

Tests sit **next to the code they test**, named `<file>.test.js`:

```
services/ai/scoring.js         -> services/ai/scoring.test.js
services/geocoding/distance.js -> services/geocoding/distance.test.js
services/filters/requestFilters.js -> services/filters/requestFilters.test.js
services/ingestion/usFilter.js -> services/ingestion/usFilter.test.js
```

Vitest auto-discovers anything matching `*.test.js` / `*.spec.js`
(see `vitest.config.js`). `describe`, `it`, and `expect` are global — no import needed.

## What's covered today

Pure-logic services with no database or network dependencies — the fastest,
most reliable things to test:

- **`scoring.js`** — priority score math (urgency + cluster density + time decay)
- **`distance.js`** — haversine distance, radius filter parsing/validation
- **`requestFilters.js`** — category/urgency/search parsing + filtering
- **`usFilter.js`** — US bounding-box geo-filtering
- **`dedupe.js`** — cross-source event de-duplication (space + time window)
- **`extractor.js`** — voice-transcript field extraction, with the LLM mocked
  (`extractor.test.js` is our reference example for **mocking a dependency** —
  copy its `vi.mock(...)` pattern for controller tests)

## Writing a new test

1. Create `yourModule.test.js` next to `yourModule.js`.
2. Import what you're testing and assert against it:

```js
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule.js';

describe('myFunction', () => {
  it('does the thing', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```

### Testing code that reads the clock

`scoring.js` uses `Date.now()`. Freeze time so tests are deterministic:

```js
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());
```

## Good next targets (not yet done)

Ordered easiest → hardest:

1. **Adapter `normalize()` functions** — `services/ingestion/{eonet,fema,gdacs,nws,usgs}.js`
   turn a raw source payload into our normalized event shape. Save one real
   sample response per source as a fixture and assert `normalize()` maps it
   correctly (no network needed).
2. **Controllers** — mock Prisma (`vi.mock('../services/database/prisma.js')`)
   and assert the controller returns the right status/shape. This tests our
   validation and error handling without a real database.
3. **Route/integration tests** — add `supertest`, spin up the Express app
   against a **test database** (a separate `DATABASE_URL`), and hit real
   endpoints end-to-end. Do this once the mocked-controller layer is solid.

Keep AI calls (Claude/OpenAI) **out** of unit tests — mock the client so tests
stay fast, free, and offline.
