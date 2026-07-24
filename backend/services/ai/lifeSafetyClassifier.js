import { askLLM } from './chatbot.js';
import { hasLifeSafetySignal } from './scoring.js';

/**
 * Life-Safety Classifier
 *
 * Decides whether a help request describes an IMMEDIATE threat to life (someone
 * could die within hours without intervention). This is the single most
 * consequential signal in prioritization: a positive result floors the severity
 * component in scoring.js, so a quietly-worded life-safety need outranks a
 * loudly-worded but non-critical one.
 *
 * Why an LLM here (and nowhere else in scoring): the keyword list in scoring.js
 * catches "needs an epipen" but misses paraphrases a panicked caller actually
 * uses — "he's turning blue and won't respond", "she collapsed and isn't waking
 * up". Language understanding is exactly the LLM's strength, and a miss here is
 * the one place in the pipeline that is genuinely dangerous.
 *
 * The SCORE itself stays pure deterministic math. This classifier only produces
 * a boolean that scoring.js consumes as an override; it never computes points.
 *
 * Safety-first fallback: if the LLM is unavailable or returns something
 * unparseable, we fall back to the deterministic keyword scan (hasLifeSafetySignal)
 * rather than silently returning false — so an outage can only make us *more*
 * cautious via keywords, never blind.
 */

// Keys the model must return. Kept tiny so even weak free models comply.
const SYSTEM_PROMPT =
  'You are a triage classifier for a disaster-relief system. You judge whether a ' +
  "help request describes an IMMEDIATE threat to a person's life — someone who " +
  'could die within hours without intervention (e.g. anaphylaxis, no insulin for a ' +
  'diabetic, not breathing, severe bleeding, cardiac symptoms, overdose, active ' +
  'labor). A shortage that is merely uncomfortable or inconvenient is NOT ' +
  'life-threatening. You reply with ONLY a JSON object and no other text.';

/**
 * Classify whether a request is an immediate life-safety emergency.
 *
 * @param {Object} request - The help request { category, description, urgency }
 * @returns {Promise<{ isLifeSafety: boolean, confidence: number, reason: string,
 *   source: 'llm' | 'keyword' }>} - `source` records which path decided, for
 *   observability/debugging.
 */
export async function classifyLifeSafety(request) {
  const description = (request?.description || '').trim();

  // Nothing to read — defer to the keyword scan (which will also be empty, i.e.
  // false) rather than spending an LLM call on an empty string.
  if (!description) {
    return keywordResult(request);
  }

  try {
    const reply = await askLLM(buildPrompt(request), {
      systemPrompt: SYSTEM_PROMPT,
      // Fall through to the next provider if the reply has no JSON object.
      validate: (r) => parseVerdict(r) !== null,
    });

    const verdict = parseVerdict(reply);
    if (!verdict) {
      // Every provider replied but none gave parseable JSON — be cautious.
      return keywordResult(request);
    }

    return {
      isLifeSafety: verdict.isLifeSafety,
      confidence: verdict.confidence,
      reason: verdict.reason,
      source: 'llm',
    };
  } catch (error) {
    // Every provider failed. Fall back to the deterministic keyword scan so a
    // life-safety phrase we CAN match still floors severity.
    console.error('Life-safety classifier AI failed, using keyword fallback:', error.message);
    return keywordResult(request);
  }
}

/**
 * Deterministic fallback: reuse the keyword scan from scoring.js. Confidence is
 * fixed (a keyword hit is a hard rule, not a probability) and source is tagged
 * so callers can tell the LLM was not consulted.
 */
function keywordResult(request) {
  const isLifeSafety = hasLifeSafetySignal(request);
  return {
    isLifeSafety,
    confidence: isLifeSafety ? 1 : 0,
    reason: isLifeSafety
      ? 'Matched a known life-safety keyword.'
      : 'No life-safety keyword matched.',
    source: 'keyword',
  };
}

function buildPrompt(request) {
  return `Classify this disaster-relief help request.

- Category: ${request.category || 'unspecified'}
- Urgency (self-reported): ${request.urgency || 'unspecified'}
- Description: ${request.description}

Does the description indicate an IMMEDIATE threat to life (death likely within hours without help)?

Respond with ONLY this JSON object, no prose:
{ "isLifeSafety": true or false, "confidence": 0-1, "reason": "<under 15 words>" }`;
}

/**
 * Pull the verdict object out of a model reply. Free models sometimes wrap JSON
 * in prose or code fences, so we locate the outermost braces. Returns null when
 * no object with a boolean `isLifeSafety` can be parsed, so askLLM's `validate`
 * can reject the reply and try the next provider.
 *
 * @param {string} reply - Raw model text
 * @returns {{ isLifeSafety: boolean, confidence: number, reason: string } | null}
 */
function parseVerdict(reply) {
  if (!reply || typeof reply !== 'string') return null;

  const unfenced = reply.replace(/```(?:json)?/gi, '').trim();
  const candidates = [unfenced];
  const first = unfenced.indexOf('{');
  const last = unfenced.lastIndexOf('}');
  if (first !== -1 && last > first) {
    candidates.push(unfenced.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj.isLifeSafety === 'boolean') {
        const confidence = Number(obj.confidence);
        return {
          isLifeSafety: obj.isLifeSafety,
          confidence: Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 ? confidence : 0.5,
          reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 120) : '',
        };
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export default { classifyLifeSafety };
