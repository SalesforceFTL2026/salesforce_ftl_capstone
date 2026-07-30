/**
 * Startup environment validation.
 *
 * Fails fast at boot if a secret the app genuinely cannot run without is
 * missing, instead of surfacing the problem later as a confusing 500 (e.g. a
 * missing JWT_SECRET_KEY only blows up at the first login/token verify). Call
 * this once, right after dotenv loads, before wiring up the app.
 *
 * We only hard-require what breaks the core request path:
 *   - DATABASE_URL:   no database, no app.
 *   - JWT_SECRET_KEY:  no auth (login/verify) without it.
 * AI provider keys are intentionally NOT required — the app degrades gracefully
 * when a provider is absent (see services/ai), so a missing one shouldn't stop
 * the server from booting.
 */
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET_KEY'];

export function validateEnv() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        'Set them (see backend/.env.example) and restart. Refusing to start.'
    );
    // Exit non-zero so the process manager / Render marks the deploy failed
    // rather than serving a half-working app.
    process.exit(1);
  }
}
