import { useState } from 'react';

// Finesse Fit's own form controls — not part of the shared ui.jsx (which is
// identical in Finesse; see DESIGN_SYSTEM.md). Styled by classes in the
// app-specific section of index.css.

export function NumberInput({ value, onChange, step = 'any', min = 0, ...props }) {
  // Selecting on focus lets a tap-and-type replace the value instead of appending to it.
  return <input className="input" type="number" inputMode="decimal" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...props} />;
}

const whole = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Minutes + seconds, stored as whole seconds. Two numeric fields beat one
// "m:ss" text box on a phone keyboard, which has no colon on the number pad.
export function DurationInput({ seconds, onChange, label = 'Duration', allowZero = false }) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const [minutes, setMinutes] = useState(String(Math.floor(total / 60)));
  const [secs, setSecs] = useState(String(total % 60));
  // Resync when the value is changed from outside (a preset chip, a kind switch).
  const [synced, setSynced] = useState(total);
  if (synced !== total && whole(minutes) * 60 + whole(secs) !== total) {
    setSynced(total);
    setMinutes(String(Math.floor(total / 60)));
    setSecs(String(total % 60));
  }
  const emit = (m, s) => {
    const next = whole(m) * 60 + Math.min(59, whole(s));
    // Clearing both fields mid-edit keeps the last real value rather than snapping back.
    if (next <= 0 && !allowZero) return;
    setSynced(next);
    onChange(next);
  };
  return (
    <div className="duration-input" role="group" aria-label={label}>
      <input className="input" type="number" inputMode="numeric" min="0" aria-label={`${label} minutes`} value={minutes} onFocus={(e) => e.target.select()} onChange={(e) => { setMinutes(e.target.value); emit(e.target.value, secs); }} />
      <span aria-hidden="true">min</span>
      <input className="input" type="number" inputMode="numeric" min="0" max="59" aria-label={`${label} seconds`} value={secs} onFocus={(e) => e.target.select()} onChange={(e) => { setSecs(e.target.value); emit(minutes, e.target.value); }} />
      <span aria-hidden="true">sec</span>
    </div>
  );
}

// A checkbox row in the shared design system's `.check-row` shape: the whole
// row is the target, with an optional line of explanation under the label.
export function Toggle({ checked, onChange, children, hint }) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-copy"><span>{children}</span>{hint && <span>{hint}</span>}</span>
    </label>
  );
}
