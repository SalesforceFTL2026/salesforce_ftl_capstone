import { useState } from 'react';
import VoiceIntake from './VoiceIntake';
import VoiceReview from './VoiceReview';

// Orchestrates the two-step voice intake flow (issues #155 + #156):
//   1. VoiceIntake  — record audio, transcribe + extract fields
//   2. VoiceReview  — confirm/edit the extracted fields, then submit
// Parents mount this single component and get onSubmitted when a request is
// created (so they can refresh their list and close the modal).
//
// @param {(request: object) => void} [onSubmitted]
// @param {() => void} [onCancel] - close before anything is submitted
const VoiceIntakeFlow = ({ onSubmitted, onCancel }) => {
  // Holds { transcript, fields } once recording is transcribed; null while
  // still on the recording step.
  const [draft, setDraft] = useState(null);

  if (!draft) {
    return <VoiceIntake onTranscribed={setDraft} onCancel={onCancel} />;
  }

  return (
    <VoiceReview
      result={draft}
      onSubmitted={onSubmitted}
      onBack={() => setDraft(null)}
    />
  );
};

export default VoiceIntakeFlow;
