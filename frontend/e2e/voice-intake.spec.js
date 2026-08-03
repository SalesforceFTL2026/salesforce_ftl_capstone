import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Voice intake (#152–158, #256) — the conversational voice agent, up to and
// through its "Confirm What We Heard" review step. This protects a flashy,
// demo-critical feature that had zero E2E coverage.
//
// Why this needs heavy shimming:
//   - The LIVE flow (VoiceCallFlow -> VoiceCall) does speech-to-text and
//     text-to-speech IN THE BROWSER via the Web Speech API. Headless Chromium
//     ships neither window.webkitSpeechRecognition nor a working
//     speechSynthesis, so VoiceCall would render its "Use the form instead"
//     unsupported branch and there'd be nothing to test.
//   - So we inject deterministic fakes (before any app code runs) for:
//       * window.webkitSpeechRecognition — on .start(), fires one final
//         onresult with a scripted utterance, then onend.
//       * window.speechSynthesis + SpeechSynthesisUtterance — resolve
//         immediately (fire onend) so the agent's spoken replies don't block.
//       * navigator.mediaDevices.getUserMedia — resolves with a dummy stream
//         (VoiceCall.begin settles the mic permission up front).
//     We also delete window.MediaRecorder so the Deepgram engine reports itself
//     unavailable and the app cleanly uses Web Speech (no WebSocket, no token).
//   - Network: POST /api/voice/turn is mocked to drive the conversation to
//     readyToSubmit with known slots. POST /api/requests (the final submit) is
//     mocked too, so the test asserts that what gets submitted equals "what we
//     heard" WITHOUT creating a real row.
//
// The one thing we do NOT fake is the review UI itself — the whole point is that
// the confirmed slots land, prefilled, on a real VoiceReview form the user can
// eyeball before submitting.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const helpSeekerState = () =>
  JSON.parse(readFileSync(path.join(__dirname, '.auth', 'help-seeker.json'), 'utf-8'));

// The slots the (mocked) agent "heard". These are what must appear on the
// review form and, unchanged, in the final submit payload.
const HEARD = {
  category: 'Food',
  urgency: 'High',
  location: '123 Relief Rd, Austin, TX',
  description: 'Two cases of drinking water for a family',
  householdSize: 4,
};

// Injected before app code. Makes the Web Speech API present + deterministic and
// forces the app onto it (no Deepgram, no real mic).
function installVoiceShims() {
  // --- Speech recognition: one scripted final utterance per .start() ---------
  class FakeSpeechRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    start() {
      // Deliver a final result on the next tick, then end the session — exactly
      // the shape useSpeechRecognition expects (event.resultIndex + results with
      // isFinal + [0].transcript).
      setTimeout(() => {
        const transcript = window.__E2E_VOICE_SAID__ || 'I need help';
        if (this.onresult) {
          this.onresult({
            resultIndex: 0,
            results: [
              Object.assign([{ transcript, confidence: 0.99 }], { isFinal: true, length: 1 }),
            ],
          });
        }
        if (this.onend) this.onend();
      }, 0);
    }
    stop() {
      if (this.onend) this.onend();
    }
    abort() {
      if (this.onend) this.onend();
    }
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;

  // --- Speech synthesis: resolve instantly so replies don't block the flow ---
  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.onend = null;
      this.onerror = null;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
    }
  }
  const fakeSynth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    speak: (u) => {
      // Fire onend on the next tick so the caller's onDone (which hands the mic
      // back / advances the flow) runs.
      setTimeout(() => u && u.onend && u.onend(), 0);
    },
  };
  // On macOS window.speechSynthesis is REAL and read-only, so a plain assignment
  // silently fails — leaving the real synth to receive our fake utterance and
  // throw. Force both consistently via defineProperty so they always match,
  // whether the platform ships a real Web Speech API (macOS) or not (headless
  // Linux CI).
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    value: fakeSynth,
    configurable: true,
    writable: true,
  });

  // --- Mic permission: resolve getUserMedia with a stub stream ---------------
  const fakeStream = { getTracks: () => [{ stop() {} }] };
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  }
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(fakeStream);

  // --- Force Web Speech: no MediaRecorder => Deepgram reports unavailable -----
  try {
    delete window.MediaRecorder;
  } catch {
    window.MediaRecorder = undefined;
  }
}

async function voicePage(browser) {
  const { token, user } = helpSeekerState();
  const context = await browser.newContext({ permissions: ['microphone'] });
  await context.addInitScript(
    ([t, u]) => {
      sessionStorage.setItem('token', t);
      sessionStorage.setItem('user', u);
    },
    [token, JSON.stringify(user)],
  );
  await context.addInitScript(installVoiceShims);
  const page = await context.newPage();
  return { context, page };
}

test.describe('voice intake', () => {
  test('a spoken request lands, prefilled, on the "Confirm What We Heard" step and submits what we heard', async ({
    browser,
  }) => {
    const { context, page } = await voicePage(browser);

    // Drive the conversation: one turn -> readyToSubmit with the heard slots.
    await page.route('**/api/voice/turn', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            say: "Got everything. Here's what I heard — please review.",
            slots: HEARD,
            missing: [],
            readyToSubmit: true,
            lifeSafety: false,
            handoff: false,
          },
        }),
      }),
    );

    // Capture the final submit and short-circuit it (no real row created).
    let submitted = null;
    await page.route('**/api/requests', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'e2e-voice-fake', ...submitted } }),
      });
    });

    // What the (faked) mic "hears" when recognition starts.
    await page.addInitScript((said) => {
      window.__E2E_VOICE_SAID__ = said;
    }, 'I need two cases of drinking water for a family of four in Austin');

    await page.goto('/requests/new');

    // Open the voice agent from the dashboard.
    await page.getByRole('button', { name: 'Talk to Us' }).click();
    await expect(page.getByRole('heading', { name: 'Talk to Us' })).toBeVisible();

    // Start the conversation: begin() settles the mic, speaks the greeting
    // (instant, via our shim), then opens the mic; our fake recognition delivers
    // an utterance, the turn is POSTed (mocked) and comes back readyToSubmit.
    await page.getByRole('button', { name: 'Start the conversation' }).click();

    // The flow hands the confirmed draft to the review step.
    await expect(page.getByRole('heading', { name: 'Confirm What We Heard' })).toBeVisible({
      timeout: 15_000,
    });

    // The review form is PREFILLED with exactly what the agent heard.
    await expect(page.locator('#v-category')).toHaveValue(HEARD.category);
    await expect(page.locator('#v-urgency')).toHaveValue(HEARD.urgency);
    await expect(page.locator('#v-location')).toHaveValue(HEARD.location);
    await expect(page.locator('#v-description')).toHaveValue(HEARD.description);
    await expect(page.locator('#v-householdSize')).toHaveValue(String(HEARD.householdSize));

    // Submitting sends exactly the reviewed fields — "what we heard".
    await page.getByRole('button', { name: 'Submit Request' }).click();
    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted).toMatchObject({
      category: HEARD.category,
      urgency: HEARD.urgency,
      location: HEARD.location,
      description: HEARD.description,
      householdSize: String(HEARD.householdSize),
    });

    await context.close();
  });

  test('the review step lets the user correct a misheard field before submitting', async ({
    browser,
  }) => {
    // The safety guarantee: recognition mishears, but the human edits the field
    // before anything is created. Here the agent mis-heard the location.
    const { context, page } = await voicePage(browser);

    await page.route('**/api/voice/turn', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            say: 'Please review.',
            slots: { ...HEARD, location: 'wrong misheard address' },
            missing: [],
            readyToSubmit: true,
            lifeSafety: false,
            handoff: false,
          },
        }),
      }),
    );

    let submitted = null;
    await page.route('**/api/requests', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'e2e-voice-fake', ...submitted } }),
      });
    });

    await page.goto('/requests/new');
    await page.getByRole('button', { name: 'Talk to Us' }).click();
    await page.getByRole('button', { name: 'Start the conversation' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm What We Heard' })).toBeVisible({
      timeout: 15_000,
    });

    // Correct the misheard location, then submit.
    await expect(page.locator('#v-location')).toHaveValue('wrong misheard address');
    await page.locator('#v-location').fill('123 Relief Rd, Austin, TX');
    await page.getByRole('button', { name: 'Submit Request' }).click();

    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted.location).toBe('123 Relief Rd, Austin, TX');

    await context.close();
  });
});
