import { useEffect, useRef, useState } from 'react';
import { beep, primeAudio, vibrate } from '../cues.js';

// Timestamp-based so the countdown stays correct if the phone locks and timers are throttled.
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!endsAt) return undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt && !firedRef.current) {
        firedRef.current = true;
        vibrate();
        beep();
        setEndsAt(null);
        setFinishedAt(current);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endsAt]);

  useEffect(() => {
    if (!finishedAt) return undefined;
    const timer = window.setTimeout(() => setFinishedAt(null), 4000);
    return () => window.clearTimeout(timer);
  }, [finishedAt]);

  const start = (seconds) => {
    // Prime audio inside the user gesture so the end-of-rest beep is allowed to play.
    primeAudio();
    firedRef.current = false;
    setFinishedAt(null);
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  };

  return {
    running: Boolean(endsAt),
    remaining: endsAt ? Math.max(0, (endsAt - now) / 1000) : 0,
    finished: Boolean(finishedAt),
    start,
    stop: () => { setEndsAt(null); setFinishedAt(null); },
    add: (seconds) => setEndsAt((current) => (current ? current + seconds * 1000 : current))
  };
}
