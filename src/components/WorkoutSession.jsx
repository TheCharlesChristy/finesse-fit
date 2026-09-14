import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Check, ChevronDown, Dumbbell, Footprints, Map as MapIcon, Minus, Pause, Play, Plus, SkipForward, Timer, Trash2, Volume2, VolumeX,
  MessageSquareText, MessageSquareOff, LocateFixed, Navigation, Satellite
} from 'lucide-react';
import { cue, primeAudio } from '../cues.js';
import { computeSplits, currentPace, distanceUnitLabel, fmtClock, fmtDistance, fmtPace, fromDisplayDistance, paceOf, splitLength, toDisplayDistance, trackLatLngs } from '../geo.js';
import { describeBlock, fmtSpan, newBlock, stepSubtitle, stepTargetMeters, stepTargetSeconds, stepTargetText, stepTitle } from '../plans.js';
import {
  entryFor, isRecording, remainingMs, sessionPlanUpdate, sessionProgress, sessionReducer, sessionSteps, sessionTotals, stepValues
} from '../session.js';
import { fmtCompact, fmtWeight, fromDisplayWeight, lastSessionFor, toDisplayWeight } from '../utils.js';
import ExercisePicker from './ExercisePicker.jsx';
import RouteMap from './RouteMap.jsx';
import { useGeolocation } from './useGeolocation.js';
import { useScrollLock } from './useScrollLock.js';
import { useWakeLock } from './useWakeLock.js';
import { DurationInput, Field, IconButton, Modal, NumberInput, OverflowMenu, Segmented, Toggle } from './ui.jsx';

function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

const weightStep = (units) => (units === 'imperial' ? 5 : 2.5);
const unitWord = (units) => (units === 'imperial' ? 'mile' : 'kilometre');
const spokenClock = (seconds) => {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return [m ? `${m} minute${m === 1 ? '' : 's'}` : '', s % 60 ? `${s % 60} second${s % 60 === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ') || '0 seconds';
};
const spokenGoal = (step, units) => {
  const meters = stepTargetMeters(step);
  if (meters) return meters < 1000 || units === 'imperial' ? `${meters} metres` : `${(meters / 1000).toFixed(1)} kilometres`;
  const seconds = stepTargetSeconds(step);
  return seconds ? spokenClock(seconds) : '';
};

// A number field with −/+ buttons for gym use (sweaty thumbs, no keyboard).
function Stepper({ label, value, onChange, step = 1, min = 0, decimal = false, suffix }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [seen, setSeen] = useState(value);
  // Quick repeated taps must each build on the last one, even before a re-render.
  const latest = useRef(Number(value) || 0);
  if (seen !== value && Number.parseFloat(text) !== value) {
    setSeen(value);
    setText(value == null ? '' : String(value));
    latest.current = Number(value) || 0;
  }
  const commit = (next) => {
    const clamped = Math.max(min, Math.round(next * 100) / 100);
    latest.current = clamped;
    setSeen(clamped);
    setText(String(clamped));
    onChange(clamped);
  };
  return (
    <div className="stepper">
      <span className="stepper-label">{label}{suffix ? <span className="muted"> ({suffix})</span> : null}</span>
      <div className="stepper-controls">
        <button type="button" className="btn-icon" aria-label={`Less ${label}`} onClick={() => commit(latest.current - step)}><Minus size={18} /></button>
        <NumberInput aria-label={label} value={text} step={decimal ? '0.5' : '1'} inputMode={decimal ? 'decimal' : 'numeric'} onChange={(next) => {
          setText(next);
          const n = Number.parseFloat(next);
          if (Number.isFinite(n) && n >= min) {
            latest.current = n;
            setSeen(n);
            onChange(n);
          }
        }} />
        <button type="button" className="btn-icon" aria-label={`More ${label}`} onClick={() => commit(latest.current + step)}><Plus size={18} /></button>
      </div>
    </div>
  );
}

function Countdown({ remaining, total, label }) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  return (
    <div className="countdown" role="timer" aria-label={label}>
      <span className="hero-num">{fmtClock(Math.ceil(remaining / 1000))}</span>
      <div className="progress-track countdown-track"><div className="progress-fill" style={{ '--value': `${fraction * 100}%` }} /></div>
    </div>
  );
}

function GpsBadge({ geo }) {
  const text = {
    off: 'GPS off', unsupported: 'No GPS', acquiring: 'Finding GPS…', denied: 'Location blocked', error: 'GPS trouble',
    weak: `Weak GPS ±${geo.fix?.[3] ?? '?'} m`, good: `GPS ±${geo.fix?.[3] ?? '?'} m`
  }[geo.status];
  const tone = geo.status === 'good' ? 'status-good' : ['denied', 'error', 'unsupported'].includes(geo.status) ? 'status-danger' : 'status-warn';
  return <span className={tone} title={geo.message ?? undefined}><Satellite size={13} /> {text}</span>;
}

function lastTimeText(workouts, exerciseId, units) {
  const last = lastSessionFor(workouts, exerciseId);
  if (!last) return null;
  return last.sets.slice(0, 4).map((set) => (set.seconds ? fmtSpan(set.seconds) : `${set.weight ? toDisplayWeight(set.weight, units) : 'BW'}×${set.reps}`)).join(', ');
}

function NowCard({ state, step, now, units, exercises, workouts, geo, dispatch, onFinish }) {
  const { timer } = state;

  if (timer?.kind === 'rest') {
    const remaining = remainingMs(state, now);
    const upNext = step ? `${stepTitle(step, exercises)} · ${step.type === 'exercise' ? exerciseAmount(step, stepValues(state, step, now), units) : stepTargetText(step, units)}` : 'Finish';
    return (
      <section className="card now-card rest" aria-live="polite">
        <span className="eyebrow"><Timer size={13} /> Rest</span>
        <Countdown remaining={remaining} total={timer.durationMs} label="Rest remaining" />
        <div className="now-actions three">
          <button type="button" className="btn-secondary" onClick={() => dispatch({ type: 'adjustRest', deltaMs: -15_000, now: Date.now() })}>−15s</button>
          <button type="button" className="btn-secondary" onClick={() => dispatch({ type: 'adjustRest', deltaMs: 15_000, now: Date.now() })}>+15s</button>
          <button type="button" className="btn-primary" onClick={() => { primeAudio(); dispatch({ type: 'skipRest', now: Date.now() }); }}><SkipForward size={18} /> Skip</button>
        </div>
        <span className="muted up-next">Up next: <strong className="secondary">{upNext}</strong></span>
      </section>
    );
  }

  if (!step) {
    return (
      <section className="card now-card done-all">
        <span className="eyebrow">All ticked off</span>
        <h3 className="font-display now-title">Nice work.</h3>
        <button type="button" className="btn-primary hero-action" onClick={onFinish}><Check size={22} /> Finish workout</button>
      </section>
    );
  }

  const values = stepValues(state, step, now);
  const done = values.status === 'done';
  const skipped = values.status === 'skipped';
  const edit = (patch) => dispatch({ type: 'edit', key: step.key, patch, now: Date.now() });
  const start = () => { primeAudio(); dispatch({ type: 'start', key: step.key, now: Date.now() }); };
  const pause = () => dispatch({ type: 'pause', now: Date.now() });
  const complete = () => { primeAudio(); dispatch({ type: 'complete', key: step.key, now: Date.now() }); };
  const skip = () => dispatch({ type: 'skip', key: step.key, now: Date.now() });
  const reopen = () => dispatch({ type: 'uncomplete', key: step.key, now: Date.now() });
  const targetSeconds = stepTargetSeconds(step);
  const targetMeters = stepTargetMeters(step);
  const hasClock = step.type !== 'exercise' || step.measure === 'time';

  const statusRow = done || skipped ? (
    <div className="now-actions">
      <span className={done ? 'status-good' : 'status-warn'}>{done ? <><Check size={13} /> Done</> : 'Skipped'}</span>
      <button type="button" className="btn-secondary" onClick={reopen}>{done ? 'Mark not done' : 'Do it now'}</button>
    </div>
  ) : null;

  const clockButtons = !done && !skipped && hasClock && (
    <div className="now-actions">
      {values.running
        ? <button type="button" className="btn-secondary big" onClick={pause}><Pause size={20} /> Pause</button>
        : <button type="button" className="btn-primary big" onClick={start}><Play size={20} /> {values.started ? 'Resume' : 'Start'}</button>}
      <button type="button" className={values.running || values.started ? 'btn-primary big' : 'btn-secondary big'} onClick={complete}><Check size={20} /> {step.type === 'cardio' && step.goal.type === 'open' ? 'Finish' : 'Done'}</button>
      <button type="button" className="btn-ghost" onClick={skip}>Skip</button>
    </div>
  );

  if (step.type === 'exercise') {
    const last = lastTimeText(workouts, step.exerciseId, units);
    return (
      <section className={`card now-card ${done ? 'is-done' : ''}`}>
        <span className="eyebrow"><Dumbbell size={13} /> {stepSubtitle(step)}</span>
        <h3 className="font-display now-title">{stepTitle(step, exercises)}</h3>
        {last && <span className="muted last-line">Last time: {last}</span>}
        {step.measure === 'time' && !done && <Countdown remaining={Math.max(0, targetSeconds * 1000 - values.elapsedMs)} total={targetSeconds * 1000} label="Time remaining" />}
        <div className="now-fields">
          {(step.measure === 'reps' || values.weight > 0) && (
            <Stepper key={`${step.key}-w`} label="Weight" suffix={units === 'imperial' ? 'lb' : 'kg'} decimal step={weightStep(units)} value={toDisplayWeight(values.weight, units)} onChange={(weight) => edit({ weight: fromDisplayWeight(weight, units) })} />
          )}
          {step.measure === 'reps'
            ? <Stepper key={`${step.key}-r`} label="Reps" value={values.reps} min={0} onChange={(reps) => edit({ reps })} />
            : done && <Stepper key={`${step.key}-s`} label="Seconds" value={values.seconds} min={1} step={5} onChange={(seconds) => edit({ seconds })} />}
        </div>
        {step.measure === 'reps' && !done && !skipped && (
          <div className="rpe-row">
            <span className="muted">Effort (RPE)</span>
            <div className="chip-row">
              {[6, 7, 8, 9, 10].map((rpe) => <button key={rpe} type="button" aria-pressed={values.rpe === rpe} className={`chip ${values.rpe === rpe ? 'active' : ''}`} onClick={() => edit({ rpe: values.rpe === rpe ? null : rpe })}>{rpe}</button>)}
            </div>
          </div>
        )}
        {statusRow}
        {step.measure === 'reps' && !done && !skipped && (
          <div className="now-actions">
            <button type="button" className="btn-primary hero-action" onClick={complete}><Check size={24} /> Done{step.restAfter ? <span className="hero-action-sub">then {fmtSpan(step.restAfter)} rest</span> : null}</button>
            <button type="button" className="btn-ghost" onClick={skip}>Skip</button>
          </div>
        )}
        {clockButtons}
      </section>
    );
  }

  if (step.type === 'rest') {
    return (
      <section className="card now-card rest">
        <span className="eyebrow"><Timer size={13} /> {stepSubtitle(step)}</span>
        <h3 className="font-display now-title">{stepTitle(step, exercises)}</h3>
        {!done && <Countdown remaining={Math.max(0, targetSeconds * 1000 - values.elapsedMs)} total={targetSeconds * 1000} label="Rest remaining" />}
        {statusRow}
        {clockButtons}
      </section>
    );
  }

  // Cardio
  const pace = values.running ? currentPace(state.track.segments) : paceOf(values.elapsedMs / 1000, values.trackedMeters);
  const bigValue = targetSeconds != null
    ? <Countdown remaining={Math.max(0, targetSeconds * 1000 - values.elapsedMs)} total={targetSeconds * 1000} label="Time remaining" />
    : targetMeters != null && step.gps
      ? (
        <div className="countdown">
          <span className="hero-num">{toDisplayDistance(values.trackedMeters, units).toFixed(2)}<span className="hero-unit">/ {toDisplayDistance(targetMeters, units)} {distanceUnitLabel(units)}</span></span>
          <div className="progress-track countdown-track"><div className="progress-fill" style={{ '--value': `${Math.min(100, (values.trackedMeters / targetMeters) * 100)}%` }} /></div>
        </div>
      )
      : <div className="countdown"><span className="hero-num">{fmtClock(values.elapsedMs / 1000)}</span></div>;

  return (
    <section className={`card now-card cardio ${step.intensity ?? ''} ${done ? 'is-done' : ''}`}>
      <div className="split">
        <span className="eyebrow"><Footprints size={13} /> {stepSubtitle(step) || 'Cardio'}</span>
        {step.gps && !done && <GpsBadge geo={geo} />}
      </div>
      <h3 className="font-display now-title">{stepTitle(step, exercises)} <span className="muted now-goal">{stepTargetText(step, units) === 'open' ? '' : stepTargetText(step, units)}</span></h3>
      {!done && bigValue}
      <div className="run-stats">
        <div><span className="eyebrow">Time</span><span className="metric">{fmtClock(done ? values.seconds : values.elapsedMs / 1000)}</span></div>
        {(step.gps || done) && <div><span className="eyebrow">Distance</span><span className="metric">{fmtDistance(done ? values.meters : values.trackedMeters, units)}</span></div>}
        {step.gps && <div><span className="eyebrow">{values.running ? 'Pace now' : 'Avg pace'}</span><span className="metric">{fmtPace(done ? paceOf(values.seconds, values.meters) : pace, units, { suffix: false })}</span></div>}
      </div>
      {geo.status === 'denied' && step.gps && <span className="status-danger scanner-status">{geo.message}</span>}
      {!step.gps && (
        <Field label={`Distance (${distanceUnitLabel(units)}, optional)`}>
          <NumberInput key={step.key} step="0.01" value={values.meters ? toDisplayDistance(values.meters, units) : ''} placeholder="0.00" onChange={(value) => edit({ meters: fromDisplayDistance(value, units) })} />
        </Field>
      )}
      {statusRow}
      {clockButtons}
    </section>
  );
}

function exerciseAmount(step, values, units) {
  if (step.measure === 'time') return values.weight > 0 ? `${fmtWeight(values.weight, units)} × ${fmtSpan(values.seconds)}` : fmtSpan(values.seconds);
  return values.weight > 0 ? `${fmtWeight(values.weight, units)} × ${values.reps}` : `${values.reps} reps`;
}

function stepRowText(step, state, now, units) {
  const values = stepValues(state, step, now);
  if (values.status !== 'done') {
    if (step.type === 'cardio' && values.started) return `${step.gps ? `${fmtDistance(values.trackedMeters, units)} · ` : ''}${fmtClock(values.elapsedMs / 1000)}`;
    if (step.type === 'exercise') return exerciseAmount(step, values, units);
    return stepTargetText(step, units);
  }
  if (step.type === 'exercise') {
    const amount = step.measure === 'time' ? fmtSpan(values.seconds) : `× ${values.reps}`;
    return values.weight > 0 ? `${fmtWeight(values.weight, units)} ${amount}` : amount;
  }
  if (step.type === 'rest') return fmtSpan(values.seconds);
  return [values.meters > 0 ? fmtDistance(values.meters, units) : null, fmtClock(values.seconds)].filter(Boolean).join(' · ');
}

function stepRowLabel(step, exercises, units) {
  if (step.blockKind === 'exercise') return `Set ${step.setNumber}`;
  if (step.blockKind === 'circuit') return `R${step.round} · ${stepTitle(step, exercises)}`;
  if (step.blockKind === 'intervals') return step.type === 'rest' ? 'Recovery' : step.intensity === 'recovery' ? step.label : `Rep ${step.label.split(' ')[1]} · ${stepTargetText(step, units)}`;
  return stepTitle(step, exercises);
}

function AddToSession({ exercises, onAdd, onClose }) {
  const [kind, setKind] = useState('exercise');
  const [block, setBlock] = useState(() => ({ ...newBlock('exercise'), sets: 3, reps: 10, restSeconds: 90 }));
  const [seconds, setSeconds] = useState(120);
  const set = (patch) => setBlock((current) => ({ ...current, ...patch }));
  const submit = () => {
    if (kind === 'exercise' && block.exerciseId == null) return;
    if (kind === 'exercise') onAdd(block);
    else if (kind === 'run') onAdd({ ...newBlock('cardio'), activity: 'run', gps: true, goal: { type: 'open' } });
    else onAdd({ ...newBlock('rest'), seconds });
  };
  return (
    <Modal title="Add to workout" size="sm" onClose={onClose} onSubmit={submit}>
      <Segmented label="Add" hideLabel value={kind} onChange={setKind} options={[{ value: 'exercise', label: 'Exercise' }, { value: 'run', label: 'Run' }, { value: 'rest', label: 'Rest' }]} />
      {kind === 'exercise' && (
        <>
          <ExercisePicker value={block.exerciseId ?? ''} exercises={exercises} onChange={(exerciseId) => set({ exerciseId })} />
          <Segmented label="Measure" value={block.measure} onChange={(measure) => set({ measure })} options={[{ value: 'reps', label: 'Reps' }, { value: 'time', label: 'Time' }]} />
          <div className="form-grid form-grid-tight">
            <Field label="Sets"><NumberInput step="1" value={block.sets} onChange={(value) => set({ sets: Math.max(1, Number.parseInt(value, 10) || 1) })} /></Field>
            {block.measure === 'time'
              ? <Field label="Time"><DurationInput seconds={block.seconds} onChange={(value) => set({ seconds: value })} /></Field>
              : <Field label="Reps"><NumberInput step="1" value={block.reps} onChange={(value) => set({ reps: Math.max(1, Number.parseInt(value, 10) || 1) })} /></Field>}
          </div>
          <span className="muted">Weight picks up from your last session of it; adjust it on each set.</span>
        </>
      )}
      {kind === 'run' && <span className="muted">An open-ended GPS run. Finish it whenever you’re done.</span>}
      {kind === 'rest' && <Field label="Rest for"><DurationInput seconds={seconds} onChange={setSeconds} /></Field>}
      <div className="row modal-actions modal-footer">
        <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-primary" type="submit" disabled={kind === 'exercise' && block.exerciseId == null}><Plus size={18} /> Add</button>
      </div>
    </Modal>
  );
}

function FinishSheet({ state, now, units, plan, exercises, onKeepGoing, onSave, onDiscard }) {
  const steps = sessionSteps(state);
  const inProgress = steps.filter((step) => entryFor(state, step.key).status === 'pending' && stepValues(state, step, now).started);
  const [include, setInclude] = useState(true);
  const [updatePlan, setUpdatePlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const final = include ? inProgress.reduce((current, step) => sessionReducer(current, { type: 'complete', key: step.key, now }), state) : state;
  const totals = sessionTotals(final);
  const progress = sessionProgress(final);
  const planChanged = plan && JSON.stringify(sessionPlanUpdate(final)) !== JSON.stringify(plan.blocks);
  const nothing = progress.done === 0;

  const save = async () => {
    setSaving(true);
    const saved = await onSave(final, { updatePlan: planChanged && updatePlan, now });
    if (!saved) setSaving(false);
  };

  return (
    <Modal title="Finish workout" size="sm" onClose={onKeepGoing} onSubmit={save}>
      <div className="finish-stats">
        <div><span className="eyebrow">Time</span><span className="metric">{fmtClock((now - state.startedAt) / 1000)}</span></div>
        <div><span className="eyebrow">Done</span><span className="metric">{progress.done}<small>/{progress.total}</small></span></div>
        {totals.sets > 0 && <div><span className="eyebrow">Volume</span><span className="metric">{fmtCompact(units === 'imperial' ? toDisplayWeight(totals.volume, units) : totals.volume)}</span></div>}
        {totals.meters > 0 && <div><span className="eyebrow">Distance</span><span className="metric">{fmtDistance(totals.meters, units)}</span></div>}
      </div>
      {inProgress.length > 0 && <Toggle checked={include} onChange={setInclude} hint="It’s been started but not ticked off.">Count {inProgress.map((step) => stepTitle(step, exercises)).join(', ')} as done</Toggle>}
      {progress.pending > 0 && <span className="muted">{progress.pending} step{progress.pending === 1 ? '' : 's'} not done won’t be saved.</span>}
      {planChanged && <Toggle checked={updatePlan} onChange={setUpdatePlan} hint="Next time starts from today’s weights and reps (and any exercises you added).">Update “{plan.name}”</Toggle>}
      {nothing && <span className="status-warn scanner-status">Nothing’s ticked off yet, so there’s nothing to save.</span>}
      <div className="stack modal-footer" style={{ gap: 8 }}>
        <div className="split modal-actions-split">
          <button className="btn-danger" type="button" onClick={onDiscard}><Trash2 size={17} /> Discard</button>
          <div className="row">
            <button className="btn-secondary" type="button" onClick={onKeepGoing}>Keep going</button>
            <button className="btn-primary" type="submit" disabled={nothing || saving}><Check size={18} /> Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function WorkoutSession({ initial, plan, exercises, workouts, routes, units, minimized, onMinimize, onExpand, onPersist, onFinish, onDiscard, onSettingsChange }) {
  const [state, dispatch] = useReducer(sessionReducer, initial);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [follow, setFollow] = useState(true);
  const steps = sessionSteps(state);
  const current = steps.find((step) => step.key === state.currentKey) ?? null;
  const fast = Boolean(state.timer);
  const now = useNow(fast ? 250 : 1000);
  const recording = isRecording(state);
  const gpsSteps = steps.filter((step) => step.type === 'cardio' && step.gps);
  const gpsWanted = gpsSteps.some((step) => entryFor(state, step.key).status === 'pending');
  const geo = useGeolocation({ enabled: gpsWanted, onFix: (fix) => dispatch({ type: 'fix', fix, now: Date.now() }) });
  const progress = sessionProgress(state);
  const { sound, voice } = state.settings;
  // Sound/voice choices also become the default for the next session.
  const changeSettings = (patch) => {
    dispatch({ type: 'settings', patch });
    onSettingsChange?.({ sound, voice, ...patch });
  };

  useWakeLock(true);
  useScrollLock(!minimized);

  useEffect(() => {
    dispatch({ type: 'tick', now });
  }, [now]);

  // ---- Persistence: every few seconds while changed, and when the app is hidden ----
  const stateRef = useRef(state);
  const dirty = useRef(false);
  const closing = useRef(false);
  const persistRef = useRef(onPersist);
  useEffect(() => {
    persistRef.current = onPersist;
    if (stateRef.current === state) return;
    stateRef.current = state;
    dirty.current = true;
  });
  useEffect(() => {
    const flush = () => {
      if (!dirty.current || closing.current) return;
      dirty.current = false;
      persistRef.current(stateRef.current);
    };
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    const id = window.setInterval(flush, 3000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    // No flush on unmount: a session only unmounts when it's been saved,
    // discarded or replaced — and a late write would resurrect it.
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // ---- Cues ----
  const seenCue = useRef(state.cue);
  useEffect(() => {
    const event = state.cue;
    if (!event || seenCue.current === event) return;
    seenCue.current = event;
    const next = event.next ? steps.find((step) => step.key === event.next) : null;
    const autoStarted = next && state.timer?.kind === 'work' && state.timer.key === next.key;
    const describeNext = next ? `${stepTitle(next, exercises)}${spokenGoal(next, units) ? `, ${spokenGoal(next, units)}` : ''}` : '';
    if (event.type === 'finished') cue('finish', { sound, voice, text: 'Workout complete. Nice work.' });
    else if (event.type === 'restOver') cue(autoStarted ? 'go' : 'alert', { sound, voice, text: autoStarted ? describeNext : `Rest over. Next, ${describeNext}` });
    else if (event.type === 'done' && autoStarted) cue('go', { sound, voice, text: describeNext });
    else if (event.type === 'done' && event.auto) cue('alert', { sound, voice, text: state.timer?.kind === 'rest' ? `Rest, ${spokenClock(state.timer.durationMs / 1000)}` : `Done. Next, ${describeNext}` });
  }, [state.cue, state.timer, steps, exercises, units, sound, voice]);

  // 3-2-1 ticks at the end of any countdown.
  const lastTick = useRef('');
  const remaining = remainingMs(state, now);
  useEffect(() => {
    if (!sound || remaining == null || remaining <= 0 || remaining > 3000 || !state.timer) return;
    const mark = `${state.timer.startedAt}:${Math.ceil(remaining / 1000)}`;
    if (lastTick.current === mark) return;
    lastTick.current = mark;
    cue('tick', { sound, voice: false });
  }, [remaining, sound, state.timer]);

  // A spoken split every km/mile of recorded distance.
  const splitCount = Math.floor(state.track.distance / splitLength(units));
  const lastSplit = useRef(splitCount);
  useEffect(() => {
    if (splitCount <= lastSplit.current) {
      lastSplit.current = splitCount;
      return;
    }
    lastSplit.current = splitCount;
    if (!recording) return;
    const split = computeSplits(state.track.segments, splitLength(units)).filter((item) => !item.partial).at(-1);
    const paceText = split ? `, pace ${spokenClock(split.seconds)} per ${unitWord(units)}` : '';
    cue('tick', { sound, voice, text: `${splitCount} ${unitWord(units)}${splitCount === 1 ? '' : 's'}${paceText}` });
  }, [splitCount, recording, state.track.segments, units, sound, voice]);

  // ---- Map ----
  const mapStep = current?.type === 'cardio' && current.gps ? current : gpsSteps.find((step) => step.routeId != null) ?? gpsSteps[0];
  const plannedRoute = routes.find((route) => mapStep?.routeId != null && String(route.id) === String(mapStep.routeId));
  const trackLines = useMemo(() => trackLatLngs(state.track.segments), [state.track.segments]);
  const position = geo.fix ? [geo.fix[0], geo.fix[1], geo.fix[3]] : null;
  const planKey = useRef(Symbol('plan'));

  const elapsed = (now - state.startedAt) / 1000;
  const otherTimer = state.timer?.kind === 'work' && state.timer.key !== state.currentKey ? steps.find((step) => step.key === state.timer.key) : null;

  const discard = async () => {
    closing.current = true;
    const gone = await onDiscard();
    if (!gone) closing.current = false;
  };
  const finish = async (finalState, options) => {
    closing.current = true;
    const saved = await onFinish(finalState, options);
    if (!saved) closing.current = false;
    return saved;
  };

  if (minimized) {
    return (
      <button type="button" className="session-pill card-raised" onClick={onExpand}>
        <span className={`live-dot ${recording ? 'recording' : ''}`} aria-hidden="true" />
        <span className="truncate"><strong>{state.name}</strong></span>
        <span className="font-mono">{state.timer?.kind === 'rest' ? `Rest ${fmtClock(Math.ceil(remaining / 1000))}` : recording ? fmtDistance(state.track.distance, units) : fmtClock(elapsed)}</span>
        <span className="session-pill-action">Open</span>
      </button>
    );
  }

  return (
    <div className="session-shell" role="dialog" aria-modal="true" aria-label={`${state.name} in progress`}>
      <div className="session-top">
      <header className="session-header">
        <IconButton label="Minimise workout" className="btn-icon btn-icon-quiet" onClick={onMinimize}><ChevronDown size={22} /></IconButton>
        <div className="session-heading">
          <span className="eyebrow"><span className={`live-dot ${recording ? 'recording' : ''}`} aria-hidden="true" /> {fmtClock(elapsed)} · {progress.done}/{progress.total} done</span>
          <h2 className="font-display session-title truncate">{state.name}</h2>
        </div>
        <OverflowMenu label="Workout options" items={[
          { label: 'Add exercise or run', icon: <Plus size={16} />, onSelect: () => setAdding(true) },
          { label: sound ? 'Mute beeps' : 'Turn beeps on', icon: sound ? <VolumeX size={16} /> : <Volume2 size={16} />, onSelect: () => changeSettings({ sound: !sound }) },
          { label: voice ? 'Voice cues off' : 'Voice cues on', icon: voice ? <MessageSquareOff size={16} /> : <MessageSquareText size={16} />, onSelect: () => { primeAudio(); changeSettings({ voice: !voice }); } },
          { label: 'Discard workout', icon: <Trash2 size={16} />, danger: true, onSelect: discard }
        ]} />
        <button type="button" className="btn-primary" onClick={() => setFinishing(true)}>Finish</button>
      </header>
      <div className="progress-track session-progress"><div className="progress-fill" style={{ '--value': `${progress.total ? ((progress.done + progress.skipped) / progress.total) * 100 : 0}%` }} /></div>
      </div>

      <div className="session-body">
        {gpsSteps.length > 0 && (
          <section className="card session-map-card">
            <div className="split session-map-bar">
              <span className="card-title"><MapIcon size={15} /> {plannedRoute ? plannedRoute.name : 'Map'}</span>
              <div className="row" style={{ gap: 6 }}>
                {showMap && <button type="button" className={`chip ${follow ? 'active' : ''}`} aria-pressed={follow} onClick={() => setFollow(!follow)}>{follow ? <Navigation size={13} /> : <LocateFixed size={13} />} Follow</button>}
                <button type="button" className="chip" aria-expanded={showMap} onClick={() => setShowMap(!showMap)}>{showMap ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            {showMap && <RouteMap className="session-map" planned={plannedRoute?.path} track={trackLines} position={position} follow={follow} fitKey={planKey.current} label="Live map" />}
            {showMap && <span className="muted session-map-note">Keep the app open — phones pause GPS for web apps when the screen is off.</span>}
          </section>
        )}

        {otherTimer && (
          <button type="button" className="running-strip" onClick={() => dispatch({ type: 'select', key: otherTimer.key })}>
            <span className="live-dot recording" aria-hidden="true" /> {stepTitle(otherTimer, exercises)} is running · {fmtClock(stepValues(state, otherTimer, now).elapsedMs / 1000)}
            <span className="session-pill-action">Show</span>
          </button>
        )}

        <NowCard state={state} step={current} now={now} units={units} exercises={exercises} workouts={workouts} geo={geo} dispatch={dispatch} onFinish={() => setFinishing(true)} />

        <div className="step-groups">
          {state.blocks.map((block, index) => {
            const blockSteps = steps.filter((step) => step.blockIndex === index);
            const { title, detail } = describeBlock(block, exercises, units);
            const blockDone = blockSteps.filter((step) => entryFor(state, step.key).status !== 'pending').length;
            return (
              <section key={block.id ?? index} className="card step-group">
                <header className="step-group-head">
                  <div className="truncate"><strong className="truncate">{title}</strong>{detail && <span className="muted truncate block-sm">{detail}</span>}</div>
                  <span className="title-meta nowrap">{blockDone}/{blockSteps.length}</span>
                </header>
                <ol className="step-list">
                  {blockSteps.map((step) => {
                    const entry = entryFor(state, step.key);
                    const isCurrent = step.key === state.currentKey;
                    const running = state.timer?.kind === 'work' && state.timer.key === step.key;
                    const label = stepRowLabel(step, exercises, units);
                    return (
                      <li key={step.key} className={`step-row ${entry.status} ${isCurrent ? 'current' : ''}`}>
                        <button
                          type="button"
                          className="step-tick"
                          aria-pressed={entry.status === 'done'}
                          aria-label={entry.status === 'done' ? `Mark ${label} not done` : `Mark ${label} done`}
                          onClick={() => { primeAudio(); dispatch({ type: entry.status === 'done' ? 'uncomplete' : 'complete', key: step.key, now: Date.now() }); }}
                        >
                          {entry.status === 'done' ? <Check size={16} /> : entry.status === 'skipped' ? <SkipForward size={14} /> : null}
                        </button>
                        <button type="button" className="step-main" aria-current={isCurrent ? 'step' : undefined} onClick={() => dispatch({ type: 'select', key: step.key })}>
                          <span className="truncate">{label}</span>
                          <span className={`nowrap ${entry.status === 'done' ? 'secondary' : 'muted'}`}>{running && <span className="live-dot recording" aria-hidden="true" />} {stepRowText(step, state, now, units)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
          {!state.blocks.length && (
            <section className="card panel stack">
              <strong>Nothing planned — build it as you go.</strong>
              <button type="button" className="btn-secondary" style={{ justifySelf: 'start' }} onClick={() => setAdding(true)}><Plus size={18} /> Add exercise or run</button>
            </section>
          )}
          {state.blocks.length > 0 && <button type="button" className="btn-ghost add-to-session" onClick={() => setAdding(true)}><Plus size={16} /> Add exercise or run</button>}
        </div>
      </div>

      {adding && <AddToSession exercises={exercises} onClose={() => setAdding(false)} onAdd={(block) => { dispatch({ type: 'addBlock', block, workouts, now: Date.now() }); setAdding(false); }} />}
      {finishing && (
        <FinishSheet
          state={state}
          now={now}
          units={units}
          plan={plan}
          exercises={exercises}
          onKeepGoing={() => setFinishing(false)}
          onDiscard={async () => { setFinishing(false); await discard(); }}
          onSave={finish}
        />
      )}
    </div>
  );
}
