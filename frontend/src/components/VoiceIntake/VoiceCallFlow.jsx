import { useState } from 'react';
import VoiceCall from './VoiceCall';
import VoiceReview from './VoiceReview';

// Orchestrates the conversational voice agent flow:
//   1. VoiceCall   — spoken back-and-forth until the request is complete
//   2. VoiceReview — the same visual confirmation step the dictation flow uses
//
// Both the success path and the give-up path land on VoiceReview. It already is
// a pre-filled create form with per-field editing, so a half-finished draft and a
// fully confirmed one need the same screen — the caller just has more left to fill
// in on one of them. (HelpRequestForm's `request` prop can't serve here: it
// switches that form into edit mode and PATCHes an existing request.)
//
// The escape hatch matters: the agent can give up, the browser may lack speech
// support, and free AI quota WILL run out mid-conversation. None of those may
// dead-end someone filing a request in an emergency.
//
// Mirrors VoiceIntakeFlow's contract so it can be mounted the same way.
//
// @param {(request: object) => void} [onSubmitted]
// @param {() => void} [onCancel]

const VoiceCallFlow = ({ onSubmitted, onCancel }) => {
  // { transcript, fields } once the call ends, however it ended; null until then.
  const [draft, setDraft] = useState(null);

  if (draft) {
    return (
      <VoiceReview
        result={draft}
        onSubmitted={onSubmitted}
        onBack={() => setDraft(null)}
      />
    );
  }

  return <VoiceCall onComplete={setDraft} onCancel={onCancel} />;
};

export default VoiceCallFlow;
