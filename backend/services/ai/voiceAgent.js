import { askLLM } from './chatbot.js';
import { hasLifeSafetySignal } from './scoring.js';

/**
 * Voice Agent
 *
 * Drives a spoken back-and-forth that ends in a complete help request. Where the
 * one-shot voice intake (transcriber -> extractor) hopes a single recording
 * contains everything, this holds the half-filled request across turns and asks
 * for whatever is still missing — which is what callers in a crisis actually
 * produce ("I need water" tells us nothing about where to send it).
 *
 * Speech-to-text and text-to-speech both happen in the BROWSER (Web Speech API),
 * so this module never touches audio. That is a deliberate cost decision: it
 * keeps the entire feature on free quota, and it means the endpoint is plain
 * JSON in / JSON out and can be tested with curl.
 *
 * Quota shape this is designed around (Gemini free tier, per model):
 *   ~20 requests/day, 5-10 requests/minute, but 250K tokens/minute.
 * Requests are the scarce resource and tokens are effectively free, so we make
 * FEW, FAT calls: exactly one LLM round-trip per user turn, carrying the whole
 * conversation and the full slot state rather than trimming context to save
 * tokens we have no shortage of. Anything decidable without a model — the
 * life-safety check, "which slots are still empty" — is computed here for free.
 */

// The fields createRequest (and the VoiceReview form) require before a request
// can be submitted. Order matters: it's the order we ask for them in, chosen so
// the caller states the need before the logistics.
const REQUIRED_SLOTS = ['category', 'description', 'location', 'urgency', 'householdSize'];

// Kept in sync with requestController.createRequest and extractor.js.
const VALID_CATEGORIES = ['Food', 'Shelter', 'Medical', 'Transport', 'Other'];
const VALID_URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

// Hard ceiling on turns. A voice agent that can't close in this many exchanges
// is stuck in a loop, and every extra turn spends a scarce daily request — so we
// hand off to the manual form instead of grinding through the quota.
const MAX_TURNS = 12;

// Spoken verbatim when either life-safety layer fires. NOT model-generated: a
// model that is rate-limited, or that decides to be reassuring instead of
// directive, must never be what stands between a caller and 911.
// Note what this deliberately does NOT say: that a responder has been notified.
// Nothing is submitted during the conversation, so promising that help is coming
// could leave someone in a life-threatening situation waiting on us instead of
// calling 911.
const EMERGENCY_SCRIPT =
  'This sounds like a life-threatening emergency. Please call 911 right now — they can ' +
  "reach you faster than we can. I've marked your request critical, and it's here on " +
  'screen ready for you to send when you are safe.';

// Spoken verbatim on the closing turn, replacing whatever the model wrote.
// Nothing has been submitted at this point — the review screen comes next and the
// caller still has to press Submit there. Left to the model, it reliably signs off
// with "your request has been submitted", which is false and would leave someone
// believing help is on the way when their request was never filed.
const REVIEW_HANDOFF_SCRIPT =
  "Thanks. I've put your request on the screen now. Please check the details and " +
  'fix anything I got wrong, then press Submit to send it.';

// Spoken-crisis phrasings the shared keyword list in scoring.js doesn't carry.
// That list is tuned for typed request descriptions and feeds prioritization
// scoring, so it isn't ours to widen unilaterally — these supplement it for the
// voice path only, where people say "she's not waking up", not "unconscious".
const SPOKEN_LIFE_SAFETY_PHRASES = [
  'unresponsive', 'not responding', 'wont respond', "won't respond",
  'not waking', 'wont wake', "won't wake", 'passed out',
  'turning blue', 'no pulse', 'not breathing', 'stopped breathing',
  'barely breathing', 'choking', 'drowning', 'seizing',
  'bleeding a lot', 'bleeding badly', 'lost a lot of blood',
  'seriously hurt', 'badly hurt', 'about to give birth', 'having a baby',
];

// Phrases that mean an emergency when they describe a PERSON and something
// mundane when they describe a building. "The roof collapsed" is one of the most
// common things anyone says in a disaster, so treating a bare "collapsed" as
// life-safety would fire the 911 script on a large share of Shelter requests and
// derail the intake. These fire only when no structural subject is present;
// Layer 2 still catches "the ceiling collapsed on my mother".
const AMBIGUOUS_LIFE_SAFETY_PHRASES = ['collapsed', 'collapse', 'not moving'];

// A plain "yes" to our readback. Small free models are reluctant to commit
// `confirmed: true` and will happily read the request back a third and fourth
// time, which traps the caller in a loop until the turn cap dumps them to the
// form. When every field is already filled and the caller agrees, that's a
// confirmation whatever the model thinks.
//
// Anchored at the start and paired with a length limit below, so "right on Bay
// Street" isn't mistaken for "right".
const AFFIRMATION =
  /^(yes|yeah|yep|yup|ya|sure|correct|right|ok|okay|confirm(ed)?|exactly|perfect|good|fine|(that('| i)?s )?(right|correct|good|it)|sounds good|uh huh|mhm|mm hmm)\b/i;

// Longest utterance we'll treat as a bare confirmation. Anything wordier is
// probably a correction ("yes but make it five people"), which must reach the
// model so the change is actually applied.
const MAX_AFFIRMATION_WORDS = 5;

/**
 * Whether an utterance is a bare "yes" and nothing more.
 *
 * @param {string} said
 * @returns {boolean}
 */
function isAffirmation(said) {
  const cleaned = said.trim().replace(/[.,!?;]+$/g, '');
  if (cleaned.split(/\s+/).length > MAX_AFFIRMATION_WORDS) return false;
  return AFFIRMATION.test(cleaned);
}

const STRUCTURAL_SUBJECTS = [
  'roof', 'ceiling', 'building', 'wall', 'floor', 'bridge', 'house', 'home',
  'garage', 'porch', 'deck', 'structure', 'stairs', 'road', 'tunnel', 'apartment',
];

/**
 * Voice-side life-safety scan: the shared keyword list plus spoken phrasings.
 *
 * Runs before any model call, so it is instant, free, and works even when every
 * provider is rate-limited. It has deliberately generous recall — a false
 * positive tells someone to call 911 when they didn't need to, which is a far
 * cheaper mistake than the reverse.
 *
 * @param {string} text - Everything we've heard, plus the current utterance
 * @param {string} category
 * @returns {boolean}
 */
export function detectLifeSafety(text, category = '') {
  if (hasLifeSafetySignal({ category, description: text })) return true;

  const haystack = text.toLowerCase();
  if (SPOKEN_LIFE_SAFETY_PHRASES.some((phrase) => haystack.includes(phrase))) {
    return true;
  }

  // Ambiguous phrases only count when nothing structural is being discussed.
  const structural = STRUCTURAL_SUBJECTS.some((noun) => haystack.includes(noun));
  return (
    !structural && AMBIGUOUS_LIFE_SAFETY_PHRASES.some((phrase) => haystack.includes(phrase))
  );
}

/**
 * The turn we return whenever life-safety fires, from either layer. Shared so
 * the caller gets identical behaviour no matter which one caught it.
 *
 * @param {Object} slots - Fields gathered so far
 * @returns {Object} - A completed turn result
 */
function emergencyTurn(slots) {
  // Force Critical so the request outranks everything else the moment it lands,
  // regardless of what urgency the caller or the model assigned.
  const escalated = { ...slots, urgency: 'Critical' };

  return {
    say: EMERGENCY_SCRIPT,
    slots: escalated,
    missing: missingSlots(escalated),
    readyToSubmit: false,
    lifeSafety: true,
    handoff: false,
  };
}

/**
 * Run one turn of the voice conversation.
 *
 * @param {Object} params
 * @param {Object} params.user - The authenticated help-seeker { name, location }
 * @param {Array} params.requests - Their existing requests, so the agent can
 *   answer "what's the status of my request?" without a database round-trip here
 * @param {Object} params.slots - Fields gathered so far; starts as {}
 * @param {Array<{role: string, content: string}>} params.history - Prior turns
 * @param {string} params.message - What the caller just said (browser transcript)
 * @returns {Promise<{say: string, slots: Object, missing: string[],
 *   readyToSubmit: boolean, lifeSafety: boolean, handoff: boolean}>}
 *   `say` is spoken aloud by the browser; `readyToSubmit` means every required
 *   slot is filled and the caller confirmed, so the caller should create the
 *   request; `handoff` means give up and show the manual form.
 */
export async function runVoiceTurn({ user, requests = [], slots = {}, history = [], message }) {
  const said = (message || '').trim();
  if (!said) {
    throw new Error('Cannot run a voice turn with an empty message');
  }

  // --- Layer 1: zero-cost guardrail, before any model call ------------------
  // Instant and immune to rate limits, but limited recall: it only catches
  // phrasings we thought to list. Layer 2 below covers what it misses.
  if (detectLifeSafety(`${slots.description || ''} ${said}`, slots.category)) {
    return emergencyTurn(slots);
  }

  // --- Give up rather than loop --------------------------------------------
  if (history.length >= MAX_TURNS * 2) {
    return {
      say:
        "I'm having trouble getting all the details over voice. I've put what you told me " +
        'on the screen — please finish the rest there and press Submit to send it.',
      slots,
      missing: missingSlots(slots),
      readyToSubmit: false,
      lifeSafety: false,
      handoff: true,
    };
  }

  // --- One LLM round-trip: understand + update slots + decide what to say ---
  const reply = await askLLM(buildTurnPrompt(said, slots), {
    systemPrompt: buildSystemPrompt(user, requests),
    history,
    // Reject anything we can't parse so askLLM rotates to the next Gemini model
    // (or on to OpenRouter) instead of us failing the call.
    validate: (r) => parseJsonObject(r) !== null,
  });

  const parsed = parseJsonObject(reply);
  if (!parsed) {
    throw new Error('Voice agent model did not return parseable JSON');
  }

  // Never let the model delete something the caller already established: merge
  // its updates over the existing slots, ignoring nulls and empty strings.
  const merged = mergeSlots(slots, parsed.slots);

  // --- Layer 2: the model's own life-safety read -----------------------------
  // Free: this is the same call we already made. It exists because Layer 1's
  // keyword scan has poor recall on paraphrase and on garbled speech-to-text
  // ("isn't breathing" is routinely transcribed as "his breathing"), while the
  // model understands the sentence regardless. Either layer firing is enough —
  // we deliberately never require agreement, because a missed emergency is a
  // categorically worse error than an unnecessary "call 911".
  if (parsed.lifeSafety === true) {
    return emergencyTurn(merged);
  }

  const missing = missingSlots(merged);

  // The model only gets to PROPOSE submission; we verify independently.
  //
  // Both directions are enforced here. A hallucinated `confirmed: true` can't
  // create a half-empty request, because every required slot must actually be
  // filled. And a model that won't commit can't trap the caller either: if the
  // request was already complete before this turn (so our last line was a
  // readback) and the caller just said yes, that's a confirmation.
  const wasCompleteBeforeThisTurn = missingSlots(slots).length === 0;
  const readyToSubmit =
    missing.length === 0 &&
    (parsed.confirmed === true || (wasCompleteBeforeThisTurn && isAffirmation(said)));

  return {
    // On the closing turn we say our own line rather than the model's, so the
    // caller is told to verify the request — never that it was already sent.
    say: readyToSubmit
      ? REVIEW_HANDOFF_SCRIPT
      : String(parsed.say || '').trim() || 'Sorry, could you say that again?',
    slots: merged,
    missing,
    readyToSubmit,
    lifeSafety: false,
    handoff: false,
  };
}

/**
 * Which required fields are still empty.
 *
 * @param {Object} slots
 * @returns {string[]} - Missing field names, in the order we should ask for them
 */
export function missingSlots(slots = {}) {
  return REQUIRED_SLOTS.filter((key) => {
    const value = slots[key];
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  });
}

/**
 * Persona and grounding. Rebuilt each turn (tokens are not the scarce resource)
 * so the agent always sees the caller's current requests.
 *
 * @param {Object} user
 * @param {Array} requests
 * @returns {string}
 */
function buildSystemPrompt(user, requests) {
  const requestLines = requests.length
    ? requests
        .map((r) => `- ${r.category} (${r.status}) at ${r.location}: "${r.description}"`)
        .join('\n')
    : '- (none yet)';

  return `You are the voice intake agent for MapResponse, a disaster-relief platform. You are
SPEAKING with someone who may be frightened, injured, or in a hurry. Your job is to collect
one complete help request through natural conversation.

How to speak, since your words are read aloud by a screen reader and not displayed:
- One or two short sentences. Never lists, headings, markdown, or emoji.
- Ask for ONE missing detail at a time. Never stack two questions in a turn.
- Briefly reflect back what you understood before asking the next thing, so the caller can
  catch a misheard address or number.
- Plain spoken language. No jargon, no "please provide", no reading field names aloud.

You are talking to:
- Name: ${user.name}
- Profile location: ${user.location || 'not provided'}

Their existing requests (${requests.length}):
${requestLines}

Never invent a request that is not listed above. Never promise a specific responder, arrival
time, or supply quantity — you are taking down the request, not fulfilling it.

You reply with ONLY a single JSON object. No code fences, no commentary.`;
}

/**
 * The per-turn instruction: current slot state, what's missing, and the strict
 * output contract.
 *
 * @param {string} said - The caller's latest utterance
 * @param {Object} slots - Fields gathered so far
 * @returns {string}
 */
function buildTurnPrompt(said, slots) {
  const missing = missingSlots(slots);

  return `The caller just said:
"""
${said}
"""

Details collected so far (JSON):
${JSON.stringify(slots, null, 2)}

Still missing: ${missing.length ? missing.join(', ') : 'nothing — everything is collected'}

Return ONLY this JSON object:
{
  "say": string — exactly what to speak next, one or two short sentences,
  "slots": {
    "category": one of ${JSON.stringify(VALID_CATEGORIES)},
    "urgency": one of ${JSON.stringify(VALID_URGENCIES)},
    "location": string — where help should go, as specifically as they gave it,
    "description": string — a neutral 1-2 sentence summary of the need,
    "householdSize": integer — how many people need help
  },
  "confirmed": boolean,
  "lifeSafety": boolean
}

Rules:
- "lifeSafety": true when a PERSON is in danger of dying within hours without
  help — not breathing, unresponsive, not waking up, severe bleeding, chest pain,
  a seizure, choking, drowning, an overdose, childbirth in progress, someone
  trapped, or no insulin/oxygen/dialysis for someone who depends on it.
  The transcript comes from imperfect speech-to-text, so judge the caller's
  evident MEANING rather than the exact words: "collapsed and his breathing"
  almost certainly means "collapsed and isn't breathing".
  Damage to property with nobody hurt is NOT life-safety, however severe — a
  collapsed roof, a flooded house, or no power is an urgent Shelter need, not a
  911 call. But a person trapped or injured BY that damage is life-safety.
  If a person's condition is described and you are genuinely unsure how serious
  it is, answer true: an unnecessary "call 911" costs far less than a miss.
- In "slots", include ONLY fields you learned or corrected from what the caller just said.
  Omit the rest entirely. Never output null to clear a field.
- Only use details the caller actually stated. Never guess a location or a headcount.
- urgency: infer it from what they describe; do not ask them to pick a level out loud.
- If details are still missing, ask for the FIRST missing one and set "confirmed": false.
- When nothing is missing, read the whole request back and ask them to confirm; keep
  "confirmed": false on that turn.
- Set "confirmed": true ONLY on a turn where the caller has just said yes to that readback.
- If your previous turn read the request back and the caller has now agreed ("yes",
  "yeah", "that's right", "correct", "yep"), set "confirmed": true on THIS turn. Do not
  read it back a second time — repeating the readback traps the caller in a loop.
- NEVER say or imply that the request has been sent, submitted, filed, or received, and
  never promise that help is on the way. Nothing is submitted while you are talking: the
  caller still has to check the details on screen and press Submit themselves. Saying
  otherwise could leave someone waiting for help that was never requested.
- If they correct something, update it and confirm the correction in "say".`;
}

/**
 * Merge model-proposed slot updates over what we already have, dropping empty
 * values and normalizing to what createRequest accepts. Existing values survive
 * unless the model supplied a genuinely new one, so a vague turn can't wipe an
 * address the caller already gave.
 *
 * @param {Object} current
 * @param {Object} updates
 * @returns {Object}
 */
function mergeSlots(current = {}, updates = {}) {
  const next = { ...current };
  if (!updates || typeof updates !== 'object') return next;

  if (VALID_CATEGORIES.includes(updates.category)) next.category = updates.category;
  if (VALID_URGENCIES.includes(updates.urgency)) next.urgency = updates.urgency;

  for (const key of ['location', 'description']) {
    if (typeof updates[key] === 'string' && updates[key].trim() !== '') {
      next[key] = updates[key].trim();
    }
  }

  // Household size arrives as a number or a spoken numeral string ("four" is
  // already normalized to 4 by the model). Keep only sane positive integers.
  const size = Number(updates.householdSize);
  if (Number.isInteger(size) && size > 0 && size < 1000) {
    next.householdSize = size;
  }

  return next;
}

/**
 * Pull the first JSON object out of a model reply, tolerating code fences and
 * surrounding prose. Same defensive approach as extractor.js — free models are
 * inconsistent about honoring "JSON only".
 *
 * @param {string} reply
 * @returns {Object|null}
 */
function parseJsonObject(reply) {
  if (typeof reply !== 'string') return null;

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(reply.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
