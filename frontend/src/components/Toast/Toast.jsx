import { useEffect } from 'react';

// A small, temporary notification that floats in the lower-right corner rather
// than pushing page content around. Used for the result of an action (e.g. a
// status change that was rejected), so feedback appears near where the user is
// working and then gets out of the way on its own.
//
// Controlled by the parent: pass a `message` to show it (null/empty hides it).
// It auto-dismisses after `duration` ms, and can be closed early with the ×.
//
// @param {string} message   Text to show; falsy means nothing is rendered.
// @param {'error'|'success'} variant  Color treatment. Defaults to 'error'.
// @param {() => void} onDismiss  Called when it auto-hides or is closed.
// @param {number} duration  Auto-dismiss delay in ms (default 5000).
const Toast = ({ message, variant = 'error', onDismiss, duration = 5000 }) => {
  // Start (or restart) the auto-dismiss timer whenever a new message appears.
  // Re-keyed on `message` so a second toast resets the countdown instead of
  // inheriting the first one's remaining time.
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const styles =
    variant === 'success'
      ? 'bg-green-600 text-white'
      : 'bg-[#c84444] text-white';

  return (
    // role="alert" + aria-live so screen readers announce it. Fixed to the
    // lower-right, capped narrow so it only takes a small slice of the screen.
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-[2000] max-w-sm w-[calc(100%-2rem)] sm:w-auto"
    >
      <div className={`flex items-start gap-3 rounded-2xl shadow-lg px-4 py-3 ${styles}`}>
        <p className="text-sm font-semibold flex-1">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 text-white/80 hover:text-white text-xl leading-none focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
