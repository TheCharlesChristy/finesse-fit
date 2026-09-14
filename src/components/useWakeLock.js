import { useEffect, useState } from 'react';

// Keeps the screen on while `active` — a locked phone stops timers from
// beeping on time and pauses GPS for web apps. The browser releases the lock
// whenever the page is hidden, so it's re-requested on return.
export function useWakeLock(active) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let sentinel = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          sentinel.release();
          return;
        }
        setHeld(true);
        sentinel.addEventListener('release', () => {
          sentinel = null;
          if (!cancelled) setHeld(false);
        });
      } catch {
        // Denied (battery saver, iframe) — timers still work, just not on a sleeping screen.
        setHeld(false);
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      sentinel?.release().catch(() => {});
      setHeld(false);
    };
  }, [active]);

  return held;
}
