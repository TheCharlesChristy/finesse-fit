// Audio, vibration and spoken cues for timers and runs — so a rest ending or
// an interval changing is noticed without looking at the phone.
//
// Speech only ever uses voices the browser marks `localService`: some
// browsers offer cloud voices that would send the spoken text (paces,
// distances) to a speech server, which this app doesn't do. With no local
// voice available, cues fall back to beeps.

let audioContext = null;

function context() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

// Browsers only allow audio that was unlocked by a user gesture — call this
// from a tap (Start, Done) so later automatic cues are allowed to sound.
export function primeAudio() {
  context();
  if (typeof window !== 'undefined' && window.speechSynthesis && !primeAudio.spoken) {
    // A silent utterance inside the gesture unlocks speech on iOS.
    try {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
      primeAudio.spoken = true;
    } catch { /* unsupported */ }
  }
}

// tones: [{ at: seconds offset, freq, length }]
function play(tones, volume = 0.25) {
  const ctx = context();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { at = 0, freq = 880, length = 0.18 } of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(volume, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + length + 0.02);
  }
}

export const CUE_SOUNDS = {
  // Two beeps: rest over / step done.
  alert: [{ at: 0 }, { at: 0.22 }],
  // One short tick: the 3-2-1 countdown.
  tick: [{ at: 0, freq: 660, length: 0.09 }],
  // Rising three: a new interval/rep starts.
  go: [{ at: 0, freq: 660, length: 0.12 }, { at: 0.15, freq: 880, length: 0.12 }, { at: 0.3, freq: 1175, length: 0.22 }],
  // Long low-high: workout complete.
  finish: [{ at: 0, freq: 587, length: 0.3 }, { at: 0.32, freq: 880, length: 0.5 }]
};

const VIBRATIONS = { alert: [200, 100, 200], tick: [40], go: [120, 60, 120, 60, 240], finish: [400, 150, 400] };

export function beep(kind = 'alert') {
  play(CUE_SOUNDS[kind] ?? CUE_SOUNDS.alert);
}

export function vibrate(kind = 'alert') {
  try { navigator.vibrate?.(VIBRATIONS[kind] ?? VIBRATIONS.alert); } catch { /* unsupported */ }
}

function localVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const lang = (navigator.language || 'en').slice(0, 2);
  const local = voices.filter((voice) => voice.localService);
  return local.find((voice) => voice.lang?.startsWith(navigator.language)) ?? local.find((voice) => voice.lang?.startsWith(lang)) ?? local[0] ?? null;
}

export function canSpeak() {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis) && Boolean(localVoice());
}

// Returns false when it couldn't speak, so the caller can beep instead.
export function speak(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const voice = localVoice();
  if (!voice) return false;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function cue(kind, { sound = true, voice = false, text } = {}) {
  vibrate(kind);
  const spoke = voice && text ? speak(text) : false;
  if (sound && (!spoke || kind === 'go')) beep(kind);
}
