import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Browser text-to-speech for the voice agent, via the Web Speech API.
//
// Chosen over a hosted TTS model for the same reason as useSpeechRecognition: it
// runs on the user's device, so it costs nothing, has no rate limit, and can't
// fail mid-demo because a daily quota ran out.
//
// Quality depends almost entirely on WHICH voice gets used. The browser's default
// for a language is typically its oldest bundled one, which is where the flat,
// synthetic sound comes from; pickVoice below scores what's actually installed and
// prefers network-backed and Enhanced/Premium voices instead. Still short of a
// hosted model, and that trade is reversible — swap the body of `speak` and the
// rest of the voice agent is untouched.
//
// Speaks in the app's active language so a caller who switched to Spanish hears
// Spanish, matching useSpeechRecognition's input locale.

// Same i18n -> BCP-47 mapping as useSpeechRecognition. Duplicated rather than
// shared because the two can legitimately diverge: a browser may ship a voice for
// a language it can't recognize, or vice versa.
const SPEECH_LOCALES = {
  en: 'en-US',
  es: 'es-US',
  zh: 'zh-CN',
  tl: 'fil-PH',
  vi: 'vi-VN',
  fr: 'fr-FR',
  ko: 'ko-KR',
  ru: 'ru-RU',
  ht: 'fr-FR', // No Haitian Creole voice ships in browsers; French is the closest.
  hi: 'hi-IN',
  ne: 'ne-NP',
};

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

// How long after speak() to conclude the browser silently dropped the utterance.
// Playback normally starts within a few tens of ms; this is generous enough not
// to false-positive on a slow voice load.
const DROPPED_UTTERANCE_MS = 400;

// Playback speed. The browser default (1) reads a touch slowly for what are
// short, plain sentences; slightly above sounds conversational rather than like a
// recorded announcement. Not pushed higher: the agent reads addresses and
// headcounts back for verification, and those need to be catchable.
const SPEECH_RATE = 1.08;

// Slightly above default pitch — flat delivery is most of what reads as "robotic".
const SPEECH_PITCH = 1.05;

// Voices whose names contain these are macOS/Safari novelty or low-fidelity
// voices ("Bad News", "Zarvox", "Bubbles"). Some are en-US, so without this the
// browser can hand us a joke voice to read a disaster-relief prompt in.
const NOVELTY_VOICE_PATTERN =
  /albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|whisper|good news|jester|organ|superstar|trinoids|zarvox|junior|ralph|fred|kathy|princess|deranged|hysterical|bruce|agnes|victoria|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|novelty/i;

// Names that indicate a higher-fidelity voice. Google's are network-backed and
// markedly more natural than the bundled system voices; Apple's Enhanced/Premium
// downloads are the best local option.
const PREFERRED_VOICE_PATTERN = /google|natural|enhanced|premium|neural|siri|ava|allison|samantha/i;

// Longest we'll wait for the voice list before speaking anyway. If voiceschanged
// never fires we'd rather attempt playback than block the conversation.
const VOICES_TIMEOUT_MS = 1000;

/**
 * Resolve once the browser's voice list is populated.
 *
 * Chrome loads voices asynchronously and silently discards any utterance queued
 * before they're ready — which is exactly the state a freshly loaded page is in
 * when the user taps the mic for the first time.
 *
 * @returns {Promise<void>}
 */
function voicesReady() {
  if (!synth || synth.getVoices().length > 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', done);
      resolve();
    };
    synth.addEventListener('voiceschanged', done);
    setTimeout(done, VOICES_TIMEOUT_MS);
  });
}

// Chosen voice per BCP-47 tag. Picking is cheap but runs on every utterance
// otherwise, and the answer can't change mid-session.
const voiceCache = new Map();

/**
 * Score a voice for how good it will sound reading our prompts. Higher wins.
 *
 * The default voice the browser hands out unprompted is usually the oldest
 * bundled one, which is where "robotic" comes from — the fix is to look at what
 * else is installed rather than accepting it.
 *
 * @param {SpeechSynthesisVoice} voice
 * @param {string} lang - Desired BCP-47 tag, e.g. "en-US"
 * @returns {number} - Negative means unusable
 */
function scoreVoice(voice, lang) {
  const voiceLang = (voice.lang || '').replace('_', '-');
  const base = lang.split('-')[0];

  // Wrong language is disqualifying — a French voice reading English is worse
  // than a plain English one.
  if (!voiceLang.toLowerCase().startsWith(base.toLowerCase())) return -1;
  if (NOVELTY_VOICE_PATTERN.test(voice.name)) return -1;

  let score = 0;
  if (voiceLang.toLowerCase() === lang.toLowerCase()) score += 3; // exact region
  if (PREFERRED_VOICE_PATTERN.test(voice.name)) score += 4;
  // Network-backed voices are the more natural ones in Chrome. They need
  // connectivity, which we already require to reach our own API.
  if (voice.localService === false) score += 3;
  if (voice.default) score += 1; // mild tiebreak toward the OS's own pick

  return score;
}

/**
 * Best available voice for a language, or null to let the browser decide.
 *
 * @param {string} lang - BCP-47 tag
 * @returns {SpeechSynthesisVoice|null}
 */
function pickVoice(lang) {
  if (!synth) return null;
  if (voiceCache.has(lang)) return voiceCache.get(lang);

  const ranked = synth
    .getVoices()
    .map((voice) => ({ voice, score: scoreVoice(voice, lang) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked.length ? ranked[0].voice : null;
  voiceCache.set(lang, best);

  try {
    if (localStorage.getItem('voiceDebug') === '1') {
      console.log('[tts] picked', best ? `${best.name} (${best.lang})` : 'browser default');
      console.log('[tts] candidates', ranked.map((e) => `${e.voice.name} [${e.score}]`));
    }
  } catch {
    // Private-mode localStorage can throw; debugging is never worth a crash.
  }

  return best;
}

/**
 * List the installed voices, for picking a different one by hand.
 * Run `listSpeechVoices()` in the console — it's attached to window in dev.
 *
 * @returns {Array<{name: string, lang: string, local: boolean}>}
 */
export function listSpeechVoices() {
  if (!synth) return [];
  return synth
    .getVoices()
    .map((v) => ({ name: v.name, lang: v.lang, local: v.localService }));
}

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.listSpeechVoices = listSpeechVoices;
}

export const isSpeechSynthesisSupported = () => Boolean(synth);

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const { i18n } = useTranslation();
  // Hold the current utterance so cancel() can detach its handlers before we
  // stop it — otherwise its onend fires during barge-in and clobbers the state
  // the next turn just set.
  const utteranceRef = useRef(null);

  const cancel = useCallback(() => {
    if (!synth) return;

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    // Only cancel when there is actually something to stop. Calling cancel()
    // immediately before speak() on an idle queue is a known Chrome race that
    // drops the new utterance silently — no onstart, no onend, no error.
    if (synth.speaking || synth.pending) synth.cancel();
    setSpeaking(false);
  }, []);

  /**
   * Speak text aloud, interrupting anything already playing.
   *
   * @param {string} text
   * @param {() => void} [onDone] - called when playback finishes or fails, so
   *   the caller can hand the mic back to the user
   */
  const speak = useCallback(
    async (text, onDone) => {
      // onDone hands the microphone back to the caller, so it MUST fire on every
      // path. Anything that returns without calling it strands the conversation
      // with a dead mic — which looks to the user like the agent ignored them.
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        utteranceRef.current = null;
        setSpeaking(false);
        onDone?.();
      };

      if (!synth || !text) {
        finish();
        return;
      }

      // Interrupt anything still playing: queuing would make the agent talk over
      // itself if a turn resolves while the previous line is running.
      cancel();

      // Chrome populates getVoices() asynchronously, and speaking before it is
      // ready silently discards the utterance. That hits the very first line of
      // the conversation — the greeting — on a freshly loaded page.
      await voicesReady();

      const utterance = new SpeechSynthesisUtterance(text);
      const lang = i18n.language || 'en';
      const locale = SPEECH_LOCALES[lang] || lang;
      utterance.lang = locale;

      // Explicitly pick a voice. Left unset, the browser uses its oldest bundled
      // voice for the language, which is what makes this sound synthetic.
      const voice = pickVoice(locale);
      if (voice) utterance.voice = voice;

      utterance.rate = SPEECH_RATE;
      utterance.pitch = SPEECH_PITCH;

      utterance.onend = finish;
      // Treat a synthesis failure as "done" rather than stranding the caller
      // waiting for a reply they'll never hear.
      utterance.onerror = finish;

      utteranceRef.current = utterance;
      setSpeaking(true);
      synth.speak(utterance);

      // Watchdog. Even with the guards above, browsers drop utterances (tab
      // throttling, an OS voice that fails to load, cancel() racing speak()) and
      // fire no event at all. Detect that the queue never started and continue
      // rather than waiting forever for an onend that isn't coming.
      setTimeout(() => {
        if (!done && !synth.speaking && !synth.pending) finish();
      }, DROPPED_UTTERANCE_MS);
    },
    [cancel, i18n.language]
  );

  // Don't keep talking after the component unmounts — speechSynthesis is a
  // window-level singleton and survives React teardown on its own.
  useEffect(() => cancel, [cancel]);

  return { speak, cancel, speaking, supported: Boolean(synth) };
}

export default useSpeechSynthesis;
