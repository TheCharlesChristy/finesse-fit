import { useEffect, useRef, useState } from 'react';
import { ACC, fixFromPosition } from '../geo.js';

// Watches the device position while `enabled`. Everything stays on the device:
// fixes go to `onFix` (the session reducer decides whether to record them).
//
// Browsers pause geolocation for a web app that's in the background or has
// its screen locked — the session keeps the screen awake (useWakeLock) and
// the UI says so, but a pocketed phone with the screen forced off will still
// leave a straight-line gap in the track.
//
// status: 'off' | 'unsupported' | 'acquiring' | 'weak' | 'good' | 'denied' | 'error'
export function useGeolocation({ enabled, onFix }) {
  const [state, setState] = useState({ status: 'off', fix: null, message: null });
  const onFixRef = useRef(onFix);
  useEffect(() => { onFixRef.current = onFix; });

  useEffect(() => {
    if (!enabled) {
      setState((current) => (current.status === 'off' ? current : { ...current, status: 'off' }));
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ status: 'unsupported', fix: null, message: 'This browser can’t share its location.' });
      return undefined;
    }
    setState((current) => ({ ...current, status: current.fix ? current.status : 'acquiring', message: null }));
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const fix = fixFromPosition(position);
        setState({ status: fix[ACC] <= 20 ? 'good' : 'weak', fix, message: null });
        onFixRef.current?.(fix);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setState({ status: 'denied', fix: null, message: 'Location permission is off for this site. Turn it on in your browser settings to track runs.' });
        // TIMEOUT just means no fix yet (indoors, cold start) — keep watching.
        else if (error.code === error.TIMEOUT) setState((current) => ({ ...current, status: current.fix ? 'weak' : 'acquiring' }));
        else setState((current) => ({ ...current, status: 'error', message: 'Can’t get a GPS fix right now.' }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}

// One-off position for centring a map ("Locate me").
export function getCurrentFix({ timeout = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser can’t share its location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(fixFromPosition(position)),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? 'Location permission is off for this site.' : 'Couldn’t find your location.')),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout }
    );
  });
}

// True only when the user has already granted location — lets a map centre
// itself without triggering a permission prompt nobody asked for.
export async function locationAlreadyAllowed() {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' });
    return status?.state === 'granted';
  } catch {
    return false;
  }
}
