import { useEffect, useState } from 'react';

// Return a debounced copy of `value` that only updates after it has stopped
// changing for `delayMs`. Used by the keyword search box (issue #85) so the
// feed isn't re-filtered on every keystroke — we wait until the user pauses
// typing before letting the new term flow through to the query.
//
// @param {*} value - the fast-changing value (e.g. the search input text)
// @param {number} [delayMs=300] - quiet period before the value settles
// @returns {*} the value as of `delayMs` after the last change
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    // Reset the timer whenever `value` changes again before it fires, so only
    // a genuine pause in typing lets the value through.
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
