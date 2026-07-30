import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { postVoiceTurn } from '../../utils/voice';
import { requestErrorMessage } from '../../utils/requests';

// Conversational voice agent screen.
//
// Where VoiceIntake takes ONE recording and hopes it contained everything, this
// holds a spoken back-and-forth: the agent asks for whatever field is still
// missing until the request is complete, reads it back, and hands the confirmed
// draft to VoiceReview for a final visual check before submitting.
//
// The visual confirmation is deliberate and not skippable. Speech recognition
// mishears addresses and headcounts, and this creates disaster-relief requests —
// so a human sees the fields before anything is created, even though the agent
// already confirmed them out loud.
//
// Speech in and out both happen in the browser, so a turn costs one backend call
// and no audio upload. See useSpeechRecognition for the browser-support caveat.
//
// Every exit — confirmed, agent gave up, provider out of quota, unsupported
// browser — routes through onComplete with whatever was collected, so the caller
// always lands on the review form rather than losing the conversation.
//
// @param {(draft: {transcript: string, fields: object}) => void} onComplete
// @param {() => void} [onCancel] - close without submitting

// Opt-in turn logging, paired with the one in useSpeechRecognition so the whole
// loop can be traced: localStorage.setItem('voiceDebug', '1') and reload.
const voiceDebug = (...parts) => {
  try {
    if (localStorage.getItem('voiceDebug') === '1') console.log('[voice]', ...parts);
  } catch {
    // Private-mode localStorage can throw; debugging is never worth a crash.
  }
};

// Conversation states. `speaking` and `listening` come from the hooks; this
// tracks what the *turn* is doing.
const PHASE = {
  IDLE: 'idle',       // not started yet
  ACTIVE: 'active',   // conversation in progress
  THINKING: 'thinking', // waiting on POST /api/voice/turn
  DONE: 'done',       // collected + confirmed, handing off to review
  ERROR: 'error',
};

const VoiceCall = ({ onComplete, onCancel }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [error, setError] = useState('');
  // Rendered as a transcript so the caller can read back what was heard — vital
  // when recognition mishears, and it makes the feature usable with the sound off.
  const [turns, setTurns] = useState([]);
  const [slots, setSlots] = useState({});

  // Slots/turns live in refs too: handleTurn runs from a speech-recognition
  // callback, which closes over stale state otherwise.
  const slotsRef = useRef({});
  const turnsRef = useRef([]);
  // Guards against a late-arriving turn response resuming the mic after the
  // caller has already closed the screen.
  const cancelledRef = useRef(false);

  const { speak, cancel: stopSpeaking, speaking } = useSpeechSynthesis();

  // Send what the caller said, speak the reply, then hand the mic back.
  const handleTurn = useCallback(
    async (said) => {
      voiceDebug('handleTurn', { said, cancelled: cancelledRef.current });
      if (cancelledRef.current) return;

      const nextTurns = [...turnsRef.current, { role: 'user', content: said }];
      turnsRef.current = nextTurns;
      setTurns(nextTurns);
      setPhase(PHASE.THINKING);

      try {
        const result = await postVoiceTurn({
          message: said,
          slots: slotsRef.current,
          // The agent's own lines are the assistant half of the history.
          history: turnsRef.current.slice(0, -1),
        });
        if (cancelledRef.current) return;

        if (!result || typeof result !== 'object') {
          throw new Error(t('voice.call.errors.turnFailed'));
        }

        slotsRef.current = result?.slots || {};
        setSlots(slotsRef.current);

        const withReply = [...turnsRef.current, { role: 'assistant', content: result?.say || '' }];
        turnsRef.current = withReply;
        setTurns(withReply);

        // The agent gave up (too many turns) — send the partial draft onward so
        // the caller finishes on the review form.
        if (result?.handoff) {
          setPhase(PHASE.DONE);
          speak(result?.say || t('voice.call.errors.turnFailed'), () => finish());
          return;
        }

        // Everything collected and confirmed aloud: stop here and let the caller
        // eyeball the fields. We do NOT auto-submit.
        if (result?.readyToSubmit) {
          setPhase(PHASE.DONE);
          speak(result?.say || t('voice.call.errors.turnFailed'), () => finish());
          return;
        }

        // Life-safety turns still continue the conversation — the caller may be
        // calling 911 while we keep the request open — so fall through.
        setPhase(PHASE.ACTIVE);
        speak(result?.say || t('voice.call.errors.turnFailed'), () => {
          if (!cancelledRef.current) startListening();
        });
      } catch (err) {
        voiceDebug('turn failed', err?.message);
        if (cancelledRef.current) return;

        // Free quota exhausted is the expected failure. Don't dead-end the
        // caller: offer the form with whatever we already collected.
        setPhase(PHASE.ERROR);
        setError(requestErrorMessage(err, t('voice.call.errors.turnFailed')));
      }
    },
    // startListening and finish are defined below and read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onComplete, speak, t]
  );

  const { start, stop, listening, interim, supported } = useVoiceRecognition({
    onResult: handleTurn,
    onError: (code) => {
      // Hearing nothing for a while isn't a fault — stay on the call so the
      // caller can tap "Speak again" instead of being dumped into an error state.
      if (code === 'no-speech-timeout') {
        setPhase(PHASE.ACTIVE);
        setError(t('voice.call.errors.stillThere'));
        return;
      }

      setPhase(PHASE.ERROR);
      setError(
        code === 'not-allowed'
          ? t('voice.errors.micBlocked')
          : t('voice.call.errors.listenFailed')
      );
    },
  });

  // Wrapped so handleTurn can call it without depending on the hook's identity.
  const startListeningRef = useRef(start);
  startListeningRef.current = start;
  const startListening = () => startListeningRef.current?.();

  // Leave the call and hand everything gathered to the review step. Reads the
  // refs rather than state so it stays correct when called from a speech
  // callback that captured an earlier render.
  const finish = () => {
    // Idempotent: a synthesis utterance can fire both onend and onerror, and the
    // "finish on the form" button can be tapped while a reply is still playing.
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    stop();
    stopSpeaking();
    onComplete?.({
      transcript: transcriptOf(turnsRef.current),
      fields: slotsRef.current,
    });
  };

  // Barge-in: the moment the caller speaks, stop talking over them.
  useEffect(() => {
    if (listening && speaking) stopSpeaking();
  }, [listening, speaking, stopSpeaking]);

  // Release the mic and silence playback if the screen closes mid-conversation.
  //
  // The flag is reset on mount, not just set on unmount: React StrictMode mounts,
  // unmounts, and remounts in development, and a ref survives that cycle — so
  // setting it only in the cleanup left it stuck true from the first render, and
  // every turn was dropped by handleTurn's guard before it could be sent.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      stop();
      stopSpeaking();
    };
  }, [stop, stopSpeaking]);

  const begin = async () => {
    setError('');
    // Tapping the mic is an explicit "I want to talk", so clear any stale
    // cancellation — e.g. after coming back from the review step.
    cancelledRef.current = false;

    // Settle the microphone permission BEFORE the greeting plays. SpeechRecognition
    // triggers the prompt itself, but it does so silently and captures nothing
    // while the prompt is open — so the caller says their first line into a dialog
    // box and the agent appears to ignore them. Asking up front means recognition
    // starts against an already-granted mic.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only wanted the permission; SpeechRecognition opens its own stream.
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setPhase(PHASE.ERROR);
      setError(
        err?.name === 'NotAllowedError'
          ? t('voice.errors.micBlocked')
          : t('voice.call.errors.listenFailed')
      );
      return;
    }

    setPhase(PHASE.ACTIVE);

    const greeting = t('voice.call.greeting');
    turnsRef.current = [{ role: 'assistant', content: greeting }];
    setTurns(turnsRef.current);
    // Greeting is templated, not model-generated: it's identical every time, so
    // spending a metered request on it would be waste.
    speak(greeting, startListening);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stop();
    stopSpeaking();
    onCancel?.();
  };

  // No browser support (Firefox) — say so and route to the form instead of
  // showing a mic button that can't work.
  if (!supported) {
    return (
      <Panel title={t('voice.call.title')}>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          {t('voice.call.unsupported')}
        </p>
        <PrimaryButton onClick={() => onComplete?.({ transcript: '', fields: {} })}>
          {t('voice.call.useForm')}
        </PrimaryButton>
      </Panel>
    );
  }

  const isBusy = phase === PHASE.THINKING || speaking;
  const missingCount = 5 - Object.keys(slots).filter((k) => slots[k] != null && slots[k] !== '').length;

  return (
    <Panel title={t('voice.call.title')} subtitle={t('voice.call.subtitle')}>
      {error && (
        <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm mb-2">{error}</p>
          <button
            type="button"
            onClick={finish}
            className="text-sm font-semibold text-red-900 dark:text-red-200 underline underline-offset-2"
          >
            {t('voice.call.continueOnForm')}
          </button>
        </div>
      )}

      {/* Live transcript. Also the accessible record of the call — a caller who
          can't hear the synthesized voice can still follow along by reading. */}
      {turns.length > 0 && (
        <div
          className="mb-5 max-h-56 overflow-y-auto space-y-3 p-3 bg-gray-50 dark:bg-[#1a2f1a] border border-gray-200 dark:border-[#3a4f30] rounded-xl"
          aria-live="polite"
        >
          {turns.map((turn, i) => (
            <p
              key={i}
              className={
                turn.role === 'user'
                  ? 'text-sm text-gray-600 dark:text-gray-400 italic text-right'
                  : 'text-sm font-medium text-gray-900 dark:text-gray-100'
              }
            >
              {turn.content}
            </p>
          ))}
          {interim && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic text-right">
              {interim}…
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 my-6">
        {phase === PHASE.IDLE ? (
          <button
            type="button"
            onClick={begin}
            aria-label={t('voice.call.start')}
            className="w-24 h-24 rounded-full flex items-center justify-center text-white bg-[#7F9764] hover:bg-[#6b8354] transition-all"
          >
            <MicIcon />
          </button>
        ) : (
          <div
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white transition-all ${
              listening ? 'bg-red-600' : 'bg-[#7F9764]'
            }`}
          >
            {listening && (
              <span className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" />
            )}
            {phase === PHASE.THINKING ? <Spinner /> : <MicIcon />}
          </div>
        )}

        <p className="text-sm font-medium text-gray-700 dark:text-gray-300" role="status">
          {phase === PHASE.IDLE && t('voice.call.tapToStart')}
          {phase === PHASE.THINKING && t('voice.call.thinking')}
          {phase === PHASE.DONE && t('voice.call.done')}
          {phase === PHASE.ACTIVE &&
            (listening
              ? t('voice.call.listening')
              : speaking
              ? t('voice.call.speaking')
              : t('voice.call.yourTurn'))}
        </p>

        {/* Progress without reading field names aloud — reassurance that the
            conversation is converging. */}
        {phase !== PHASE.IDLE && missingCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('voice.call.remaining', { count: missingCount })}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        {phase === PHASE.ACTIVE && !listening && !isBusy && (
          <button
            type="button"
            onClick={startListening}
            className="flex-1 py-3 px-5 rounded-xl font-semibold uppercase text-sm tracking-wide border-2 border-[#7F9764] text-[#1C2A16] dark:text-[#a8c187] hover:bg-[#7F9764]/10 transition-colors"
          >
            {t('voice.call.speakAgain')}
          </button>
        )}
        {phase !== PHASE.IDLE && phase !== PHASE.DONE && (
          <button
            type="button"
            onClick={finish}
            className="flex-1 py-3 px-5 rounded-xl font-semibold uppercase text-sm tracking-wide border-2 border-gray-300 dark:border-[#3a4f30] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1a2f1a] transition-colors"
          >
            {t('voice.call.switchToForm')}
          </button>
        )}
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={handleCancel}
          className="mt-4 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {t('voice.call.cancel')}
        </button>
      )}
    </Panel>
  );
};

// Flatten the conversation into the single "you said" string VoiceReview shows.
const transcriptOf = (turns) =>
  turns
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.content)
    .join(' ');

const Panel = ({ title, subtitle, children }) => (
  <div className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-8 transition-colors duration-300 text-center">
    <h2 className="text-2xl font-bold text-black dark:text-white mb-1">{title}</h2>
    {subtitle && <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{subtitle}</p>}
    {children}
  </div>
);

const PrimaryButton = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-[#1C2A16] dark:bg-[#7F9764] text-white py-3.5 px-6 rounded-xl font-semibold uppercase text-sm tracking-wide hover:opacity-90 transition-opacity"
  >
    {children}
  </button>
);

const MicIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5a7 7 0 0014 0M12 17.5V21m-3 0h6" />
  </svg>
);

const Spinner = () => (
  <svg className="w-9 h-9 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export default VoiceCall;
