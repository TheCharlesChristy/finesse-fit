import { useEffect, useRef, useState } from 'react';

let audioContext = null;
function beep() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch {
    // Audio is a nice-to-have; vibration or the visual cue still fire.
  }
}

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
        navigator.vibrate?.([200, 100, 200]);
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
    try { audioContext ??= new (window.AudioContext || window.webkitAudioContext)(); } catch { /* unsupported */ }
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
