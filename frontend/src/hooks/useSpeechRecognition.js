import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Browser speech-to-text for the voice agent, via the Web Speech API.
//
// Why in the browser instead of uploading audio to Whisper (as the one-shot
// VoiceIntake flow does): this runs on the user's device, so it costs nothing and
// consumes none of our metered AI quota — which is what makes a multi-turn voice
// conversation affordable. It also streams interim results, so the caller sees
// their words appear as they speak instead of waiting on an upload.
//
// The tradeoff is accuracy (Whisper handles accents and background noise better)
// and support: Chrome, Edge, and Safari implement this; Firefox does not. Callers
// MUST check `supported` and offer the typed form or the Whisper dictation flow
// as a fallback.
//
// @param {object} [options]
// @param {(transcript: string) => void} [options.onResult] - fires once per
//   finalized utterance, i.e. when the speaker stops talking
// @param {(error: string) => void} [options.onError]

// Vendor prefix: Chrome and Safari still expose this as webkitSpeechRecognition.
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

// Map the app's i18n language codes to BCP-47 tags the speech engine expects.
// Anything not listed falls through to the bare code, which the engine resolves
// to a regional default on its own.
const SPEECH_LOCALES = {
  en: 'en-US',
  es: 'es-US',
  zh: 'zh-CN',
  tl: 'fil-PH',
  vi: 'vi-VN',
  fr: 'fr-FR',
  ko: 'ko-KR',
  ru: 'ru-RU',
  ht: 'fr-FR', // No Haitian Creole engine ships in browsers; French is the closest.
  hi: 'hi-IN',
  ne: 'ne-NP',
};

// Pause before reopening the mic after the engine ends a session. Restarting
// synchronously inside onend throws InvalidStateError in Chrome.
const RESTART_DELAY_MS = 250;

// Opt-in lifecycle logging for debugging the speech loop, which is otherwise
// invisible: run localStorage.setItem('voiceDebug', '1') and reload.
const debug = (...parts) => {
  try {
    if (localStorage.getItem('voiceDebug') === '1') console.log('[speech]', ...parts);
  } catch {
    // Private-mode localStorage can throw; debugging is never worth a crash.
  }
};

// How many silent reopens to allow before concluding the caller isn't going to
// speak. Chrome's no-speech timeout is a few seconds, so this is roughly a
// minute of patience — long enough for someone shaken to collect themselves,
// short enough that a broken microphone doesn't loop indefinitely.
const MAX_EMPTY_RESTARTS = 12;

export const isSpeechRecognitionSupported = () => Boolean(SpeechRecognitionAPI);

export function useSpeechRecognition({ onResult, onError } = {}) {
  const { i18n } = useTranslation();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');

  const recognitionRef = useRef(null);
  // Whether the caller still wants the microphone open. The speech engine ends a
  // session on its own after a few seconds of silence (a `no-speech` error
  // followed by `onend`), which would silently close the mic while the user is
  // still gathering their thoughts — they then speak into nothing. We keep
  // reopening it while this is true, so "your turn" really means the mic is live.
  const wantListeningRef = useRef(false);
  // Consecutive reopens that captured nothing. Bounded so a broken mic (which
  // ends sessions instantly) can't spin in a restart loop forever.
  const emptyRestartsRef = useRef(0);
  const restartTimerRef = useRef(null);
  // Most recent interim transcript of the session in progress, kept as a fallback
  // for when the engine ends without ever finalizing a result.
  const lastInterimRef = useRef('');

  // Keep the callbacks in refs so the recognition instance always calls the
  // latest version without us tearing down and rebuilding it on every render.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  // start() and the restart path are mutually recursive; a ref breaks the cycle
  // without making either depend on the other's identity.
  const startRef = useRef(null);

  // Stop listening and release the engine. Safe to call when already stopped.
  const stop = useCallback(() => {
    wantListeningRef.current = false;
    emptyRestartsRef.current = 0;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const recognition = recognitionRef.current;
    if (recognition) {
      // Detach handlers first: aborting fires onend, and we don't want that to
      // re-enter our state setters after the caller asked us to stop.
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    }
    setListening(false);
    setInterim('');
  }, []);

  // Hand a completed utterance to the caller, exactly once per turn. Both the
  // normal final-result path and the interim fallback route through here so the
  // turn can't be delivered twice or dropped.
  const deliver = useCallback((text, source) => {
    if (!wantListeningRef.current) {
      debug('deliver ignored (turn already ended)', { text, source });
      return;
    }

    debug('deliver', { text, source });
    wantListeningRef.current = false;
    emptyRestartsRef.current = 0;
    lastInterimRef.current = '';
    setInterim('');
    onResultRef.current?.(text);
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      onErrorRef.current?.('unsupported');
      return;
    }
    // Starting an already-running instance throws InvalidStateError.
    if (recognitionRef.current) {
      debug('start ignored (session already open)');
      return;
    }

    // Hold the mic open until we get a result, hit a real fault, or the caller
    // stops us — the engine's own silence timeout must not end the turn.
    wantListeningRef.current = true;
    // A restart is a fresh utterance; don't let stale interim text from the
    // previous silent session get delivered as this turn's answer.
    lastInterimRef.current = '';

    const recognition = new SpeechRecognitionAPI();
    const lang = i18n.language || 'en';
    recognition.lang = SPEECH_LOCALES[lang] || lang;
    debug('start', { lang: recognition.lang });
    // One utterance per start: the agent replies between turns, and continuous
    // mode would keep capturing our own synthesized speech.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = '';
      let pending = '';

      // Results accumulate across the session; walk from where this event began.
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }

      debug('onresult', { final: finalText, interim: pending });

      // Remember the interim text: Chrome sometimes ends a session without ever
      // marking a result final, and that text is the only record of what was said.
      if (pending.trim()) lastInterimRef.current = pending.trim();
      setInterim(pending);

      if (finalText.trim()) {
        deliver(finalText.trim(), 'final');
      }
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are ordinary — the caller just hasn't started
      // talking yet, or we stopped the engine ourselves. Surfacing those as errors
      // makes the UI look broken. onend runs next and handles reopening the mic.
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      // A real fault (not-allowed, audio-capture, network): give up on the mic
      // rather than restart-looping against a problem we can't fix.
      wantListeningRef.current = false;
      onErrorRef.current?.(event.error);
    };

    // Fires when the engine ends the session — either because it finalized an
    // utterance, or because it heard nothing for a few seconds. In the second
    // case the caller still expects an open mic, so reopen it.
    recognition.onend = () => {
      recognitionRef.current = null;
      setInterim('');
      debug('onend', {
        wantListening: wantListeningRef.current,
        heldInterim: lastInterimRef.current,
        emptyRestarts: emptyRestartsRef.current,
      });

      if (!wantListeningRef.current) {
        setListening(false);
        return;
      }

      // Chrome can end a session having only ever produced interim results — the
      // user plainly spoke, but no result was flagged final, so waiting for one
      // would silently discard the whole utterance. Treat what we heard as final.
      if (lastInterimRef.current) {
        deliver(lastInterimRef.current, 'interim-fallback');
        setListening(false);
        return;
      }

      emptyRestartsRef.current += 1;
      if (emptyRestartsRef.current > MAX_EMPTY_RESTARTS) {
        wantListeningRef.current = false;
        setListening(false);
        onErrorRef.current?.('no-speech-timeout');
        return;
      }

      // Small delay: restarting synchronously inside onend throws
      // InvalidStateError in Chrome, as the previous session is still tearing down.
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (wantListeningRef.current) startRef.current?.();
      }, RESTART_DELAY_MS);
    };

    recognitionRef.current = recognition;
    setListening(true);

    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      wantListeningRef.current = false;
      setListening(false);
      onErrorRef.current?.(err?.message || 'startFailed');
    }
    // `deliver` is a stable useCallback with an empty dependency list, so it
    // never needs to invalidate this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  // Lets the onend restart path call the current start() without either
  // depending on the other's identity.
  startRef.current = start;

  // Never leave the engine (and the browser's recording indicator) running after
  // the component unmounts.
  useEffect(() => stop, [stop]);

  return { start, stop, listening, interim, supported: Boolean(SpeechRecognitionAPI) };
}

export default useSpeechRecognition;
