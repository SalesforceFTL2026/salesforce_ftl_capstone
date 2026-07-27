import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM boundary so these tests are fast, free, and offline — same pattern
// as extractor.test.js. Every test controls exactly what the "model" returns.
vi.mock('./chatbot.js', () => ({
  askLLM: vi.fn(),
}));

import { askLLM } from './chatbot.js';
import { runVoiceTurn, missingSlots, detectLifeSafety } from './voiceAgent.js';

beforeEach(() => {
  vi.clearAllMocks();
});

const user = { name: 'Test Caller', location: 'Santa Cruz, CA' };

// A well-formed model reply for a turn that still needs a location.
const reply = (overrides = {}) =>
  JSON.stringify({
    say: 'How many people need help?',
    slots: { category: 'Food', description: 'Ran out of food.' },
    confirmed: false,
    lifeSafety: false,
    ...overrides,
  });

describe('detectLifeSafety (Layer 1 — keyword scan, no model call)', () => {
  // Real transcripts, including one that browser speech-to-text actually
  // produced: "isn't breathing" came through as "his breathing". The scan has to
  // catch the caller's meaning despite the garbling.
  it.each([
    'my grandmother collapsed and his breathing',
    'my dad is not breathing',
    'she wont wake up',
    "she won't wake up",
    'he is unresponsive',
    'my son is choking',
    'she is bleeding badly',
    'my mom collapsed',
    'grandpa needs his insulin',
    'he is having a seizure',
  ])('fires on %j', (text) => {
    expect(detectLifeSafety(text)).toBe(true);
  });

  // Structural damage is the single most common thing described in a disaster.
  // Treating a bare "collapsed" as life-safety would fire the 911 script on a
  // large share of ordinary Shelter requests and derail intake.
  it.each([
    'our roof collapsed in the storm',
    'the ceiling collapsed and we need shelter',
    'the garage collapsed',
    'we need drinking water for four people',
    'we ran out of food and diapers',
    'we need a ride to the shelter',
  ])('stays quiet on %j', (text) => {
    expect(detectLifeSafety(text)).toBe(false);
  });
});

describe('runVoiceTurn life-safety handling', () => {
  it('returns the scripted 911 response without calling the model at all', async () => {
    const result = await runVoiceTurn({
      user,
      slots: {},
      history: [],
      message: 'my dad is not breathing',
    });

    // The whole point of Layer 1: it cannot be rate-limited, because it never
    // makes a request.
    expect(askLLM).not.toHaveBeenCalled();
    expect(result.lifeSafety).toBe(true);
    expect(result.say).toMatch(/911/);
    expect(result.slots.urgency).toBe('Critical');
    expect(result.readyToSubmit).toBe(false);
  });

  it('escalates when only the model recognises the emergency (Layer 2)', async () => {
    // Phrasing Layer 1 deliberately ignores, so this exercises the model path.
    askLLM.mockResolvedValue(
      reply({ say: 'How bad is it?', lifeSafety: true, slots: { category: 'Medical' } })
    );

    const result = await runVoiceTurn({
      user,
      slots: {},
      history: [],
      message: 'the ceiling came down on my mother and she is stuck',
    });

    expect(askLLM).toHaveBeenCalledTimes(1);
    expect(result.lifeSafety).toBe(true);
    // The script wins over whatever the model wanted to say.
    expect(result.say).toMatch(/911/);
    expect(result.slots.urgency).toBe('Critical');
  });

  it('preserves already-collected fields when escalating', async () => {
    const result = await runVoiceTurn({
      user,
      slots: { category: 'Medical', location: '412 Seabright Ave', householdSize: 3 },
      history: [],
      message: 'she stopped breathing',
    });

    expect(result.slots.location).toBe('412 Seabright Ave');
    expect(result.slots.householdSize).toBe(3);
    expect(result.slots.urgency).toBe('Critical');
  });
});

describe('runVoiceTurn slot filling', () => {
  it('merges model updates over existing slots', async () => {
    askLLM.mockResolvedValue(reply({ slots: { location: '88 Pine St' } }));

    const result = await runVoiceTurn({
      user,
      slots: { category: 'Food', householdSize: 2 },
      history: [],
      message: 'we are at 88 Pine Street',
    });

    expect(result.slots).toMatchObject({
      category: 'Food',
      householdSize: 2,
      location: '88 Pine St',
    });
  });

  it('lets a correction overwrite an earlier answer', async () => {
    askLLM.mockResolvedValue(reply({ slots: { householdSize: 5 } }));

    const result = await runVoiceTurn({
      user,
      slots: { householdSize: 2 },
      history: [],
      message: 'actually there are five of us',
    });

    expect(result.slots.householdSize).toBe(5);
  });

  it('ignores empty or invalid model values rather than clearing a field', async () => {
    askLLM.mockResolvedValue(
      reply({ slots: { location: '   ', category: 'NotACategory', householdSize: -1 } })
    );

    const result = await runVoiceTurn({
      user,
      slots: { location: '88 Pine St', category: 'Food', householdSize: 2 },
      history: [],
      message: 'um',
    });

    expect(result.slots.location).toBe('88 Pine St');
    expect(result.slots.category).toBe('Food');
    expect(result.slots.householdSize).toBe(2);
  });

  it('refuses to submit while a required field is missing, even if the model says confirmed', async () => {
    // Guards against a hallucinated confirmation creating a half-empty request.
    askLLM.mockResolvedValue(reply({ confirmed: true, slots: { category: 'Food' } }));

    const result = await runVoiceTurn({
      user,
      slots: {},
      history: [],
      message: 'yes that is right',
    });

    expect(result.readyToSubmit).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('submits once every field is filled and the caller confirmed', async () => {
    askLLM.mockResolvedValue(reply({ confirmed: true, slots: {} }));

    const result = await runVoiceTurn({
      user,
      slots: {
        category: 'Food',
        urgency: 'High',
        location: '88 Pine St',
        description: 'Needs food.',
        householdSize: 4,
      },
      history: [],
      message: 'yes',
    });

    expect(result.missing).toEqual([]);
    expect(result.readyToSubmit).toBe(true);
  });

  // Nothing is created until the caller presses Submit on the review screen, so no
  // spoken line may imply otherwise. Left to itself the model signs off with
  // "your request has been submitted", which would leave someone believing help
  // was on the way when their request was never filed.
  describe('never claims the request was submitted', () => {
    const CLAIMS_SENT = /\b(submitted|has been sent|we've sent|filed|on (its|the) way|dispatched|help is coming)\b/i;

    it('overrides the model closing line with an instruction to verify', async () => {
      askLLM.mockResolvedValue(
        reply({ say: 'Your request has been submitted. Stay safe!', confirmed: true, slots: {} })
      );

      const result = await runVoiceTurn({
        user,
        slots: {
          category: 'Food',
          urgency: 'High',
          location: '88 Pine St',
          description: 'Needs food.',
          householdSize: 4,
        },
        history: [],
        message: 'yes',
      });

      expect(result.readyToSubmit).toBe(true);
      expect(result.say).not.toMatch(CLAIMS_SENT);
      // Must actively tell them to check and send it themselves.
      expect(result.say).toMatch(/check|review/i);
      expect(result.say).toMatch(/submit|send/i);
    });

    it('does not promise a responder on the life-safety turn', async () => {
      const result = await runVoiceTurn({
        user,
        slots: {},
        history: [],
        message: 'my dad is not breathing',
      });

      expect(result.say).toMatch(/911/);
      expect(result.say).not.toMatch(CLAIMS_SENT);
    });

    it('does not claim submission when handing off', async () => {
      const result = await runVoiceTurn({
        user,
        slots: { category: 'Food' },
        history: new Array(40).fill({ role: 'user', content: 'x' }),
        message: 'hello',
      });

      expect(result.handoff).toBe(true);
      expect(result.say).not.toMatch(CLAIMS_SENT);
    });
  });

  describe('accepts a spoken yes even when the model will not commit', () => {
    const complete = {
      category: 'Food',
      urgency: 'High',
      location: '88 Pine St',
      description: 'Needs food.',
      householdSize: 4,
    };

    it.each(['yes', 'yeah', "that's right", 'correct', 'yep', 'sounds good'])(
      'treats %j after a readback as confirmation',
      async (said) => {
        // Model re-reads the request instead of committing — the loop we're avoiding.
        askLLM.mockResolvedValue(reply({ say: 'Does that all sound right?', confirmed: false }));

        const result = await runVoiceTurn({ user, slots: complete, history: [], message: said });

        expect(result.readyToSubmit).toBe(true);
      }
    );

    it('does not treat a wordy reply as a bare confirmation', async () => {
      // "yes but..." is a correction and has to reach the model to be applied.
      askLLM.mockResolvedValue(reply({ say: 'How many now?', confirmed: false }));

      const result = await runVoiceTurn({
        user,
        slots: complete,
        history: [],
        message: 'yes but there are actually six of us now not four',
      });

      expect(result.readyToSubmit).toBe(false);
    });

    it('does not mistake an address containing "right" for a yes', async () => {
      askLLM.mockResolvedValue(reply({ say: 'Got it.', confirmed: false }));

      const result = await runVoiceTurn({
        user,
        slots: complete,
        history: [],
        message: 'right on Bay Street past the bridge',
      });

      expect(result.readyToSubmit).toBe(false);
    });

    it('ignores a yes while fields are still missing', async () => {
      askLLM.mockResolvedValue(reply({ confirmed: false, slots: {} }));

      const result = await runVoiceTurn({
        user,
        slots: { category: 'Food' },
        history: [],
        message: 'yes',
      });

      expect(result.readyToSubmit).toBe(false);
    });
  });

  it('hands off rather than looping forever', async () => {
    const result = await runVoiceTurn({
      user,
      slots: { category: 'Food' },
      history: new Array(40).fill({ role: 'user', content: 'x' }),
      message: 'hello',
    });

    expect(result.handoff).toBe(true);
    expect(askLLM).not.toHaveBeenCalled();
    // The draft has to survive the handoff or the caller re-answers everything.
    expect(result.slots.category).toBe('Food');
  });

  it('throws when the model returns something unparseable', async () => {
    askLLM.mockResolvedValue('I am afraid I cannot do that.');

    await expect(
      runVoiceTurn({ user, slots: {}, history: [], message: 'we need water' })
    ).rejects.toThrow(/JSON/i);
  });

  it('rejects an empty utterance before spending a request', async () => {
    await expect(
      runVoiceTurn({ user, slots: {}, history: [], message: '   ' })
    ).rejects.toThrow();
    expect(askLLM).not.toHaveBeenCalled();
  });
});

describe('missingSlots', () => {
  it('lists every required field for an empty draft', () => {
    expect(missingSlots({})).toEqual([
      'category',
      'description',
      'location',
      'urgency',
      'householdSize',
    ]);
  });

  it('treats whitespace-only strings as missing', () => {
    expect(missingSlots({ location: '   ' })).toContain('location');
  });

  it('returns nothing when the draft is complete', () => {
    expect(
      missingSlots({
        category: 'Food',
        urgency: 'High',
        location: '88 Pine St',
        description: 'Needs food.',
        householdSize: 4,
      })
    ).toEqual([]);
  });
});
