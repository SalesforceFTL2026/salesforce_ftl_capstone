import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM boundary so these tests are fast, free, and offline. Every test
// controls exactly what the "model" returns via askLLM's mock. This is the same
// pattern to use for controller tests (mock the Prisma module) — see TESTING.md.
vi.mock('./chatbot.js', () => ({
  askLLM: vi.fn(),
}));

import { askLLM } from './chatbot.js';
import { extractRequestFields } from './extractor.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// A well-formed model reply covering the full contract.
const goodReply = JSON.stringify({
  category: 'Medical',
  urgency: 'Critical',
  location: 'Portland, OR',
  description: 'Insulin running low, needs a refill soon.',
  householdSize: 1,
  confidence: { category: 0.9, urgency: 0.8, location: 0.95, description: 0.7, householdSize: 0.6 },
});

describe('extractRequestFields', () => {
  it('rejects an empty transcript without calling the model', async () => {
    await expect(extractRequestFields('   ')).rejects.toThrow(/empty transcript/i);
    expect(askLLM).not.toHaveBeenCalled();
  });

  it('parses a clean JSON reply into the field contract', async () => {
    askLLM.mockResolvedValue(goodReply);
    const result = await extractRequestFields('My insulin is almost gone in Portland');
    expect(result).toMatchObject({
      category: 'Medical',
      urgency: 'Critical',
      location: 'Portland, OR',
      householdSize: 1,
    });
    expect(result.confidence.category).toBe(0.9);
  });

  it('extracts JSON even when the model wraps it in code fences and prose', async () => {
    askLLM.mockResolvedValue('Sure! Here is the data:\n```json\n' + goodReply + '\n```\nHope that helps.');
    const result = await extractRequestFields('anything');
    expect(result.category).toBe('Medical');
  });

  it('falls back to safe defaults for out-of-enum values', async () => {
    askLLM.mockResolvedValue(JSON.stringify({ category: 'Spaceship', urgency: 'whenever' }));
    const result = await extractRequestFields('vague transcript');
    expect(result.category).toBe('Other'); // unknown category -> Other
    expect(result.urgency).toBe('Medium'); // unknown urgency -> Medium
  });

  it('clamps invalid confidence values to 0 and normalizes household size', async () => {
    askLLM.mockResolvedValue(
      JSON.stringify({
        category: 'Food',
        urgency: 'Low',
        location: '  Austin, TX  ',
        description: '  water  ',
        householdSize: -3, // invalid -> null
        confidence: { category: 5, urgency: 'nope' }, // out of range / non-numeric -> 0
      })
    );
    const result = await extractRequestFields('...');
    expect(result.householdSize).toBeNull();
    expect(result.location).toBe('Austin, TX'); // trimmed
    expect(result.description).toBe('water'); // trimmed
    expect(result.confidence.category).toBe(0);
    expect(result.confidence.urgency).toBe(0);
    expect(result.confidence.location).toBe(0); // missing -> 0
  });

  it('throws when the model returns no parseable JSON', async () => {
    askLLM.mockResolvedValue('I could not understand that request, sorry.');
    await expect(extractRequestFields('...')).rejects.toThrow(/parseable JSON/i);
  });
});
