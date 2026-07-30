import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedRequests, authRole, sessionFor } from './helpers/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = path.join(__dirname, '.auth');

// Path to a role's saved session ({ token, user }), injected into sessionStorage
// by the page fixtures so the test starts already signed in.
export function statePath(role) {
  return path.join(STATE_DIR, `${role}.json`);
}

// Runs once before the whole suite:
//   1. Seeds a known catalog of help requests via the backend API.
//   2. Creates + logs in one account per role via the API, and writes a
//      Playwright storageState per role so specs start already authenticated.
//
// Authenticating once per role (instead of clicking through the UI login in
// every test) keeps us well under the backend's auth rate limit (20 attempts
// / 15 min / IP) and makes the specs much faster.
export default async function globalSetup() {
  try {
    const seeded = await seedRequests();
    await fs.mkdir(STATE_DIR, { recursive: true });

    for (const role of ['help-seeker', 'volunteer', 'organization']) {
      const session = await authRole(role);
      await fs.writeFile(statePath(role), JSON.stringify(sessionFor(session), null, 2));
    }

    console.log(`[e2e] global setup: ${seeded.length} seed requests + 3 role sessions ready.`);
  } catch (err) {
    throw new Error(
      `[e2e] global setup failed — is the backend running on http://localhost:3000 ` +
        `with a migrated database?\n${err.message}`,
    );
  }
}
