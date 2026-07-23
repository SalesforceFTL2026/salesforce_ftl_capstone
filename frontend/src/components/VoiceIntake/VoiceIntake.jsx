import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { submitVoiceIntake, requestErrorMessage } from '../../utils/requests';

// Voice "call" intake screen (issue #155).
//
// Lets a help-seeker describe their need out loud instead of filling the form.
// Records mic audio with MediaRecorder, uploads it to POST /api/requests/voice,
// and hands the returned { transcript, fields } to onTranscribed so the parent
// can show the "confirm what we heard" review step (#156). Nothing is submitted
// here — the review step creates the request.
//
// @param {(result: {transcript: string, fields: object}) => void} onTranscribed
// @param {() => void} [onCancel] - close the screen without recording

// Bundled demo recording served from public/. Respects Vite's base URL so it
// resolves correctly whether the app is hosted at the root or a sub-path.
const SAMPLE_AUDIO_URL = `${import.meta.env.BASE_URL}samples/demo-request.m4a`;

// Recording lifecycle: idle -> recording -> processing (upload + AI) -> error.
const STATUS = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  ERROR: 'error',
};

// Pick a mime type the browser actually supports; Whisper accepts webm/ogg/mp4.
const pickMimeType = () => {
  const candidates = ['audio/webm', 'audio/ogg', 'audio/mp4'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
};

const extensionFor = (mimeType) => {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
};

const VoiceIntake = ({ onTranscribed, onCancel }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);

  // Refs hold mutable recording machinery that must survive re-renders without
  // triggering them: the recorder, captured chunks, the mic stream, and the
  // elapsed-time interval.
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Always release the mic and timer when we leave the screen, so the browser's
  // "recording" indicator doesn't linger.
  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    setError('');
    setSeconds(0);

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus(STATUS.ERROR);
      setError(t('voice.errors.unsupportedBrowser'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;

      recorder.start();
      setStatus(STATUS.RECORDING);

      // Tick the on-screen timer once a second.
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setStatus(STATUS.ERROR);
      // getUserMedia rejects with NotAllowedError when the user blocks the mic.
      setError(
        err?.name === 'NotAllowedError'
          ? t('voice.errors.micBlocked')
          : t('voice.errors.startFailed')
      );
    }
  };

  // Stop the recorder; the actual upload happens in onstop once the final
  // chunk has flushed.
  const stopRecording = () => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      setStatus(STATUS.PROCESSING);
      recorderRef.current.stop();
    }
  };

  const handleStop = async () => {
    releaseStream();

    const mimeType = recorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });

    if (blob.size === 0) {
      setStatus(STATUS.ERROR);
      setError(t('voice.errors.noAudio'));
      return;
    }

    processBlob(blob, `recording.${extensionFor(mimeType)}`);
  };

  // Upload an audio blob through the intake pipeline and hand the result up.
  // Shared by live recordings and the pre-recorded demo sample.
  const processBlob = async (blob, filename) => {
    setStatus(STATUS.PROCESSING);
    try {
      const result = await submitVoiceIntake(blob, filename);
      onTranscribed?.(result);
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(requestErrorMessage(err, t('voice.errors.processFailed')));
    }
  };

  // Demo fallback (#158): run a bundled sample recording through the real
  // pipeline, so the flow can be shown without a working mic or a quiet room.
  const useSampleRecording = async () => {
    setError('');
    setStatus(STATUS.PROCESSING);
    try {
      const res = await fetch(SAMPLE_AUDIO_URL);
      if (!res.ok) throw new Error('sample fetch failed');
      const blob = await res.blob();
      await processBlob(blob, 'demo-request.m4a');
    } catch {
      setStatus(STATUS.ERROR);
      setError(t('voice.errors.sampleLoadFailed'));
    }
  };

  const isRecording = status === STATUS.RECORDING;
  const isProcessing = status === STATUS.PROCESSING;

  return (
    <div className="bg-white dark:bg-[#273A20] rounded-2xl shadow-md p-8 transition-colors duration-300 text-center">
      <h2 className="text-2xl font-bold text-black dark:text-white mb-1">{t('voice.intake.title')}</h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
        {t('voice.intake.subtitle')}
      </p>

      {error && (
        <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Big mic "call" button + pulsing ring while recording. */}
      <div className="flex flex-col items-center gap-4 my-8">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          aria-label={isRecording ? t('voice.intake.stopRecording') : t('voice.intake.startRecording')}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-60 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-[#7F9764] hover:bg-[#6b8354]'
          }`}
        >
          {isRecording && (
            <span className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" />
          )}
          {isProcessing ? (
            <Spinner />
          ) : isRecording ? (
            <StopIcon />
          ) : (
            <MicIcon />
          )}
        </button>

        <p className="text-sm font-medium text-gray-700 dark:text-gray-300" role="status">
          {isProcessing
            ? t('voice.intake.transcribing')
            : isRecording
            ? t('voice.intake.recording', { time: formatTime(seconds) })
            : t('voice.intake.tapToStart')}
        </p>
      </div>

      {/* Demo fallback: skip the mic and run a bundled sample through the flow.
          Only offered when not actively recording/processing. */}
      {!isRecording && !isProcessing && (
        <div className="mb-3">
          <button
            type="button"
            onClick={useSampleRecording}
            className="text-xs font-medium text-[#7F9764] hover:text-[#6b8354] underline underline-offset-2 transition-colors"
          >
            {t('voice.intake.useSample')}
          </button>
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          {t('voice.intake.cancel')}
        </button>
      )}
    </div>
  );
};

const formatTime = (total) => {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const MicIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5a7 7 0 0014 0M12 17.5V21m-3 0h6" />
  </svg>
);

const StopIcon = () => (
  <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const Spinner = () => (
  <svg className="w-9 h-9 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export default VoiceIntake;
