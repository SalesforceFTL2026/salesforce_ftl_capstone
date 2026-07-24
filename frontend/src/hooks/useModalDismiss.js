import { useEffect } from 'react';

// Shared modal-dismiss behavior: close on the Escape key.
//
// Every modal in the app should let the user back out with Escape (in addition
// to a visible ✕/Cancel and clicking the backdrop). Rather than repeat the same
// keydown listener in each modal, they call this hook.
//
// @param {boolean} active - whether the modal is currently open. When false the
//   listener is not attached, so a closed modal never swallows Escape from the
//   rest of the page.
// @param {() => void} onClose - called when Escape is pressed while active.
export const useModalDismiss = (active, onClose) => {
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);
};
