import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM boundary so these tests are fast, free, and offline. Each test
// controls exactly what the "model" returns (or makes it throw). Same pattern
// as extractor.test.js.
vi.mock('./chatbot.js', () => ({
  askLLM: vi.fn(),
}));

import { askLLM } from './chatbot.js';
import { classifyLifeSafety } from './lifeSafetyClassifier.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyLifeSafety', () => {
  it('does not call the model for an empty description and returns keyword result', async () => {
    const result = await classifyLifeSafety({ category: 'Food', description: '   ' });
    expect(askLLM).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isLifeSafety: false, source: 'keyword' });
  });

  it('returns the LLM verdict when it replies with clean JSON', async () => {
    askLLM.mockResolvedValue(
      JSON.stringify({ isLifeSafety: true, confidence: 0.92, reason: 'anaphylaxis, no epinephrine' })
    );
    const result = await classifyLifeSafety({
      category: 'Medical',
      description: 'my daughter is having a severe allergic reaction and we have no epinephrine',
    });
    expect(result).toEqual({
      isLifeSafety: true,
      confidence: 0.92,
      reason: 'anaphylaxis, no epinephrine',
      source: 'llm',
    });
  });

  it('catches a paraphrase the keyword list would miss', async () => {
    // "turning blue and won't respond" contains no life-safety KEYWORD, so the
    // deterministic scan would say false; the LLM is what saves this case.
    askLLM.mockResolvedValue(
      JSON.stringify({ isLifeSafety: true, confidence: 0.8, reason: 'possible respiratory arrest' })
    );
    const result = await classifyLifeSafety({
      category: 'Other',
      description: "he's turning blue and won't respond",
    });
    expect(result.isLifeSafety).toBe(true);
    expect(result.source).toBe('llm');
  });

  it('parses JSON even when wrapped in code fences and prose', async () => {
    askLLM.mockResolvedValue(
      'Assessment:\n```json\n' +
        JSON.stringify({ isLifeSafety: false, confidence: 0.7, reason: 'non-urgent shortage' }) +
        '\n```'
    );
    const result = await classifyLifeSafety({ category: 'Food', description: 'running low on groceries' });
    expect(result.isLifeSafety).toBe(false);
    expect(result.source).toBe('llm');
  });

  it('clamps an out-of-range confidence to a safe default', async () => {
    askLLM.mockResolvedValue(JSON.stringify({ isLifeSafety: true, confidence: 5, reason: 'x' }));
    const result = await classifyLifeSafety({ category: 'Medical', description: 'diabetic out of insulin' });
    expect(result.confidence).toBe(0.5);
  });

  it('falls back to the keyword scan (not blind false) when every provider fails', async () => {
    askLLM.mockRejectedValue(new Error('all providers down'));
    // Description contains the "insulin" keyword, so the deterministic fallback
    // must still flag it as life-safety.
    const result = await classifyLifeSafety({
      category: 'Medical',
      description: 'diabetic patient is out of insulin',
    });
    expect(result).toMatchObject({ isLifeSafety: true, source: 'keyword' });
  });

  it('falls back to the keyword scan when the reply has no parseable verdict', async () => {
    askLLM.mockResolvedValue('I am not sure how to answer that.');
    const result = await classifyLifeSafety({ category: 'Food', description: 'need some snacks' });
    expect(result).toMatchObject({ isLifeSafety: false, source: 'keyword' });
  });
});
