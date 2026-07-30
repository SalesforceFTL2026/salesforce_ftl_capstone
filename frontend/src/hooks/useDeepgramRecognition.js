import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { fetchDeepgramToken } from '../utils/voice';

// Streaming speech-to-text for the voice agent, via Deepgram.
//
// This is the higher-accuracy alternative to useSpeechRecognition (the browser's
// Web Speech API). Web Speech is free and runs on-device, but it mishears
// accents and struggles in noise — exactly the conditions a disaster-relief
// caller is in. Deepgram handles both far better, at a per-minute cost.
//
// The browser captures mic audio with MediaRecorder and streams it over a
// WebSocket straight to Deepgram; transcripts (interim, then finalized) stream
// back. Audio does NOT pass through our server — the only thing the backend does
// is mint the short-lived token that authorizes the socket (see
// POST /api/voice/token), so our API key never reaches the browser.
//
// The public interface is deliberately identical to useSpeechRecognition
// ({ start, stop, listening, interim }) so the two are interchangeable. The one
// addition is `available`: false means Deepgram can't be used right now (not
// configured on the server, token mint failed, unsupported language, or no
// MediaRecorder), and the caller should fall back to Web Speech.
//
// @param {object} [options]
// @param {(transcript: string) => void} [options.onResult] - fires once per
//   finalized utterance (i.e. when Deepgram detects the speaker stopped)
// @param {(error: string) => void} [options.onError]
// @param {boolean} [options.enabled] - when false, the hook does nothing and
//   reports unavailable, so the parent can gate it behind an env flag

// App i18n codes -> Deepgram language codes. Deepgram's nova models cover these;
// anything not listed here is treated as unsupported so the caller falls back to
// Web Speech rather than opening a socket Deepgram will reject.
//
// Note ht (Haitian Creole) is intentionally absent: Deepgram has no model for
// it, so it falls back to Web Speech, which itself maps ht -> French. Same net
// behavior as before, just reached one layer up.
const DEEPGRAM_LOCALES = {
  en: 'en-US',
  es: 'es',
  zh: 'zh-CN',
  vi: 'vi',
  fr: 'fr',
  ko: 'ko',
  ru: 'ru',
  hi: 'hi',
};

// Deepgram model. nova-2 is the current general-purpose model with the best
// accuracy/latency balance; overridable in case a newer one ships.
const DEEPGRAM_MODEL = import.meta.env.VITE_DEEPGRAM_MODEL || 'nova-2';

// Silence, in ms, after which Deepgram emits UtteranceEnd — i.e. how long a
// pause counts as "the caller finished talking". A shade over a second lets
// someone shaken pause mid-sentence without getting cut off, while still ending
// the turn promptly once they're actually done.
const UTTERANCE_END_MS = 1200;

// How often MediaRecorder hands us an audio chunk to forward. 250ms keeps
// latency low without flooding the socket with tiny frames.
const RECORDER_TIMESLICE_MS = 250;

// Grant tokens are short-lived; reuse one across turns until it's nearly expired
// rather than minting on every mic open. Module-level so it survives re-renders
// and remounts within a session.
let cachedToken = null;
let cachedTokenExpiresAt = 0; // epoch ms
// Refresh a little before actual expiry so a token can't die mid-connection.
const TOKEN_REFRESH_MARGIN_MS = 10_000;

async function getToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken;
  }
  const minted = await fetchDeepgramToken();
  if (!minted) {
    cachedToken = null;
    cachedTokenExpiresAt = 0;
    return null;
  }
  cachedToken = minted.token;
  cachedTokenExpiresAt = Date.now() + minted.expiresIn * 1000;
  return cachedToken;
}

// Same opt-in debug switch as the Web Speech hook: localStorage.voiceDebug = '1'.
const debug = (...parts) => {
  try {
    if (localStorage.getItem('voiceDebug') === '1') console.log('[deepgram]', ...parts);
  } catch {
    // Private-mode localStorage can throw; debugging is never worth a crash.
  }
};

// Streaming is possible only where we can capture mic audio to forward. The
// language check is per-call (it depends on the active locale), so it's not here.
const canStream =
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

export function useDeepgramRecognition({ onResult, onError, enabled = true } = {}) {
  const { i18n } = useTranslation();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  // Whether this hook is usable at all right now. Flipped false on any setup
  // failure so the parent can switch to Web Speech and not try Deepgram again.
  const [available, setAvailable] = useState(enabled && canStream);

  const connectionRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  // Caller still wants the mic open. Mirrors the Web Speech hook: guards against
  // late socket events resuming a turn the caller already ended.
  const wantListeningRef = useRef(false);
  // Finalized transcript pieces for the utterance in progress, joined and
  // delivered when Deepgram signals the caller stopped talking.
  const finalRef = useRef('');

  // Keep callbacks in refs so the streaming handlers always see the latest ones
  // without tearing the connection down and rebuilding it on every render.
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  // Tear down the socket, recorder, and mic. Safe to call when already stopped.
  const teardown = useCallback(() => {
    if (recorderRef.current) {
      try {
        if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      } catch {
        // Already stopped; nothing to do.
      }
      recorderRef.current = null;
    }
    if (connectionRef.current) {
      try {
        connectionRef.current.requestClose();
      } catch {
        // Socket already closing/closed.
      }
      connectionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    finalRef.current = '';
    teardown();
    setListening(false);
    setInterim('');
  }, [teardown]);

  // Hand a completed utterance to the caller exactly once, then end the session.
  // Deepgram keeps the socket open for more speech, but the agent replies between
  // turns, so we close after each utterance and let the caller reopen — matching
  // the one-utterance-per-turn model of the Web Speech hook.
  const deliver = useCallback(
    (text) => {
      if (!wantListeningRef.current) {
        debug('deliver ignored (turn already ended)', text);
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) return;

      debug('deliver', trimmed);
      wantListeningRef.current = false;
      finalRef.current = '';
      teardown();
      setListening(false);
      setInterim('');
      onResultRef.current?.(trimmed);
    },
    [teardown]
  );

  // Give up on Deepgram for the rest of the session and tell the caller to fall
  // back. Called on any setup or streaming failure.
  const failToFallback = useCallback(
    (reason) => {
      debug('unavailable ->', reason);
      wantListeningRef.current = false;
      teardown();
      setListening(false);
      setInterim('');
      setAvailable(false);
      onErrorRef.current?.('deepgram-unavailable');
    },
    [teardown]
  );

  const start = useCallback(async () => {
    if (!enabled || !canStream) {
      failToFallback('unsupported');
      return;
    }
    // Starting an already-open session would double up recorders/sockets.
    if (connectionRef.current) {
      debug('start ignored (session already open)');
      return;
    }

    const lang = i18n.language || 'en';
    const language = DEEPGRAM_LOCALES[lang];
    // No Deepgram model for this language (e.g. Haitian Creole): let Web Speech
    // handle it instead of opening a socket Deepgram will close on us.
    if (!language) {
      failToFallback(`unsupported-language:${lang}`);
      return;
    }

    wantListeningRef.current = true;
    finalRef.current = '';

    // Fetch (or reuse) a streaming token. Null means the server hasn't enabled
    // Deepgram, or minting failed — either way, fall back.
    let token;
    try {
      token = await getToken();
    } catch {
      token = null;
    }
    if (!token) {
      failToFallback('no-token');
      return;
    }
    // The caller may have stopped us while the token was in flight.
    if (!wantListeningRef.current) return;

    // Open the mic. Do this before the socket so we don't hold an idle
    // connection open if the user denies permission.
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      wantListeningRef.current = false;
      // A blocked mic is a real, actionable error — surface it rather than
      // silently falling back, since Web Speech would be blocked too.
      if (err?.name === 'NotAllowedError') {
        setListening(false);
        onErrorRef.current?.('not-allowed');
        return;
      }
      failToFallback(err?.name || 'getUserMedia-failed');
      return;
    }
    if (!wantListeningRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;

    let connection;
    try {
      const dg = createClient({ accessToken: token });
      connection = dg.listen.live({
        model: DEEPGRAM_MODEL,
        language,
        // Punctuation and formatted numbers/addresses — the agent reads these
        // back for confirmation, so formatted output is easier to verify.
        smart_format: true,
        // Stream partial results so the caller sees words as they speak, the
        // same live-transcript feel as Web Speech's interim results.
        interim_results: true,
        // Endpointing: Deepgram tells us when the caller paused long enough to
        // count as finished, which is what ends the turn.
        utterance_end_ms: UTTERANCE_END_MS,
        vad_events: true,
      });
    } catch (err) {
      failToFallback(err?.message || 'client-init-failed');
      return;
    }
    connectionRef.current = connection;

    connection.on(LiveTranscriptionEvents.Open, () => {
      // Only start capturing once the socket is ready, or early chunks are lost.
      if (!wantListeningRef.current || !streamRef.current) return;

      const recorder = new MediaRecorder(streamRef.current);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && connectionRef.current) {
          connectionRef.current.send(event.data);
        }
      };
      recorder.start(RECORDER_TIMESLICE_MS);
      setListening(true);
      debug('open + recording', { language });
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data?.channel?.alternatives?.[0];
      const text = alt?.transcript || '';

      if (data?.is_final) {
        // A finalized segment of the utterance. Accumulate — a single utterance
        // can span several final segments.
        if (text) finalRef.current = `${finalRef.current} ${text}`.trim();
        setInterim('');
        // speech_final means Deepgram detected the end of speech within this
        // message, so the utterance is complete without waiting for UtteranceEnd.
        if (data?.speech_final && finalRef.current) {
          deliver(finalRef.current);
        }
      } else if (text) {
        // Interim hypothesis — show it, but shown after any finalized text so the
        // caller reads the full utterance so far.
        setInterim(finalRef.current ? `${finalRef.current} ${text}` : text);
      }
    });

    // Fires when the caller has been silent past utterance_end_ms. If speech_final
    // didn't already close the turn, do it here with what we've accumulated.
    connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (finalRef.current) deliver(finalRef.current);
    });

    connection.on(LiveTranscriptionEvents.Error, (err) => {
      debug('socket error', err);
      // If we captured something before the error, don't lose it.
      if (finalRef.current && wantListeningRef.current) {
        deliver(finalRef.current);
        return;
      }
      failToFallback('socket-error');
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      debug('socket closed');
      recorderRef.current = null;
      connectionRef.current = null;
    });
  }, [enabled, i18n.language, deliver, failToFallback]);

  // Never leave the mic or socket open after the component unmounts.
  useEffect(() => stop, [stop]);

  return { start, stop, listening, interim, available };
}

export default useDeepgramRecognition;
