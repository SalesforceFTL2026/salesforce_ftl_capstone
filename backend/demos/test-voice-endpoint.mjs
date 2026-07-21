// Ad-hoc tester for the voice intake endpoint (#154), pointed at prod by default.
//
// Usage:
//   node demos/test-voice-endpoint.mjs \
//     --email you@example.com --password 'yourpass' \
//     [--api https://mapresponse-api.onrender.com] \
//     [--audio ../frontend/public/samples/demo-request.m4a]
//
// It logs in, uploads the sample audio to POST /api/requests/voice, and prints
// the full response so we can see the transcript + extracted fields, or the
// exact error if extraction fails.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- tiny arg parser: --flag value ---
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}

const API = args.api || 'https://mapresponse-api.onrender.com';
const EMAIL = args.email;
const PASSWORD = args.password;
const AUDIO = resolve(
  __dirname,
  args.audio || '../../frontend/public/samples/demo-request.m4a'
);

if (!EMAIL || !PASSWORD) {
  console.error('Missing --email / --password. See the usage comment at the top of this file.');
  process.exit(1);
}

const log = (label, obj) =>
  console.log(`\n=== ${label} ===\n` + (typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)));

async function main() {
  console.log(`Target API: ${API}`);
  console.log(`Audio file: ${AUDIO}`);

  // 1. Log in to get a JWT.
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginBody?.data?.token) {
    log(`LOGIN FAILED (HTTP ${loginRes.status})`, loginBody);
    process.exit(1);
  }
  const token = loginBody.data.token;
  console.log(`Logged in as ${loginBody.data.user?.email} (role: ${loginBody.data.user?.role})`);
  if (loginBody.data.user?.role !== 'help-seeker') {
    console.warn('WARNING: this account is not a help-seeker; the voice endpoint will 403.');
  }

  // 2. Build multipart body with the sample audio and POST it.
  const bytes = readFileSync(AUDIO);
  const form = new FormData();
  form.append('audio', new Blob([bytes], { type: 'audio/mp4' }), 'demo-request.m4a');

  const t0 = Date.now();
  const voiceRes = await fetch(`${API}/api/requests/voice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const ms = Date.now() - t0;
  const voiceBody = await voiceRes.json().catch(() => ({}));

  log(`VOICE RESPONSE (HTTP ${voiceRes.status}, ${ms}ms)`, voiceBody);

  if (voiceRes.ok && voiceBody?.success) {
    console.log('\n✅ SUCCESS — transcript + fields returned. The endpoint works.');
  } else {
    console.log('\n❌ FAILED — see the message above.');
    console.log('   • 502 "Could not understand..." => extraction (OpenRouter) failed in prod.');
    console.log('   • 502 "Could not transcribe..."  => Whisper (OPENAI_API_KEY) failed in prod.');
    console.log('   • 403                            => account is not a help-seeker.');
  }
}

main().catch((err) => {
  console.error('\nRequest threw:', err.message);
  process.exit(1);
});
