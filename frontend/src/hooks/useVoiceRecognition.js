import { useCallback, useMemo, useRef } from 'react';
import {
  useSpeechRecognition,
  isSpeechRecognitionSupported,
} from './useSpeechRecognition';
import { useDeepgramRecognition } from './useDeepgramRecognition';

// Speech-to-text selector for the voice agent.
//
// Two engines back the voice call:
//   - Deepgram streaming (useDeepgramRecognition) — higher accuracy on accents
//     and noise, at a per-minute cost. Opt-in via VITE_STT_PROVIDER=deepgram.
//   - Browser Web Speech (useSpeechRecognition) — free, on-device, the default.
//
// This hook picks between them so VoiceCall doesn't have to, and makes the
// fallback seamless: if Deepgram can't run (server not configured, unsupported
// language) or fails mid-session, we transparently continue on Web Speech within
// the same caller action, so the mic never goes dead under them.
//
// Both underlying hooks are always called — the Rules of Hooks forbid calling
// one conditionally — but only the selected one is ever started, so the idle
// engine holds no mic or socket.
//
// The returned shape matches useSpeechRecognition
// ({ start, stop, listening, interim, supported }) so callers are unaffected by
// which engine is live.
//
// @param {object} options - onResult / onError, forwarded to the active engine

// STT engine preference. Deepgram is the default because it's markedly more
// accurate on accents and noise (the disaster-relief caller profile); Web Speech
// is the automatic fallback whenever Deepgram can't run. Set
// VITE_STT_PROVIDER=web-speech to force the free, on-device engine and never
// touch Deepgram — e.g. to guarantee zero cost or keep audio off the network.
//
// Note: "default on" is safe even with no Deepgram key configured. The backend
// answers /api/voice/token with 501, the first mic open falls back to Web Speech,
// and every turn after that skips Deepgram entirely (see `available` below).
const DEEPGRAM_ENABLED =
  String(import.meta.env.VITE_STT_PROVIDER || 'deepgram').toLowerCase() !== 'web-speech';

export function useVoiceRecognition({ onResult, onError } = {}) {
  // Web Speech is the fallback target; declared first so the Deepgram error
  // interceptor can reach its start() via a ref.
  const webSpeech = useSpeechRecognition({ onResult, onError });
  const webSpeechStartRef = useRef(webSpeech.start);
  webSpeechStartRef.current = webSpeech.start;

  // Intercept Deepgram's own "I can't run" signal and turn it into a Web Speech
  // start, rather than surfacing it to VoiceCall as an error. Every other code
  // (notably 'not-allowed', a blocked mic, which Web Speech can't fix either)
  // passes straight through to the caller.
  const handleDeepgramError = useCallback(
    (code) => {
      if (code === 'deepgram-unavailable') {
        webSpeechStartRef.current?.();
        return;
      }
      onError?.(code);
    },
    [onError]
  );

  const deepgram = useDeepgramRecognition({
    onResult,
    onError: handleDeepgramError,
    enabled: DEEPGRAM_ENABLED,
  });

  // Prefer Deepgram only while it reports itself available. `available` flips
  // false on any Deepgram setup/stream failure, so once it bails, subsequent
  // turns go straight to Web Speech without the interceptor round-trip.
  const useDeepgram = DEEPGRAM_ENABLED && deepgram.available;
  const active = useDeepgram ? deepgram : webSpeech;

  const start = useCallback(() => {
    // If Deepgram's start() fails, it calls handleDeepgramError, which starts Web
    // Speech — so the same tap always ends with a live mic on some engine.
    active.start();
  }, [active]);

  const stop = useCallback(() => {
    // Stop both: the inactive one is already idle (a safe no-op), and this
    // guarantees nothing is left holding the mic after a mid-session handoff.
    deepgram.stop();
    webSpeech.stop();
  }, [deepgram, webSpeech]);

  return useMemo(
    () => ({
      start,
      stop,
      listening: active.listening,
      interim: active.interim,
      // Supported as long as SOME engine can run. Web Speech support is the
      // floor; Deepgram availability layers on top but never removes it.
      supported:
        isSpeechRecognitionSupported() || (DEEPGRAM_ENABLED && deepgram.available),
      // Which engine is actually live, for debugging/telemetry.
      engine: useDeepgram ? 'deepgram' : 'web-speech',
    }),
    [start, stop, active.listening, active.interim, useDeepgram, deepgram.available]
  );
}

export default useVoiceRecognition;
