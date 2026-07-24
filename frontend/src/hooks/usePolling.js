import { useEffect, useRef } from 'react';

// Periodically re-run a callback so dashboards pick up new requests without a
// manual refresh (issue #157). Meant to sit alongside a dashboard's existing
// one-time load: pass a *silent* refresh (one that doesn't toggle the loading
// spinner) so the feed updates in place rather than flashing a spinner.
//
// Behavior:
// - Skips polling while the browser tab is hidden (no point refetching for a
//   tab nobody is looking at), and fires one immediate refresh when the tab
//   becomes visible again so it's current the moment the user returns.
// - Always calls the latest callback via a ref, so the interval never runs a
//   stale closure even as the callback's dependencies change.
//
// @param {() => (void | Promise<void>)} callback - the refresh to run
// @param {number} [intervalMs=15000] - how often to poll, in ms
// @param {boolean} [enabled=true] - set false to pause polling entirely
export function usePolling(callback, intervalMs = 15000, enabled = true) {
  const savedCallback = useRef(callback);

  // Keep the ref pointed at the newest callback without restarting the timer.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      // Don't refetch for a backgrounded tab.
      if (document.visibilityState === 'visible') {
        savedCallback.current?.();
      }
    };

    const id = setInterval(tick, intervalMs);

    // When the user returns to the tab, refresh right away instead of waiting
    // out the rest of the interval.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        savedCallback.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
