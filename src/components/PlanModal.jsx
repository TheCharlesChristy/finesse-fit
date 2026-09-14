import { createElement, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Dumbbell, Footprints, Layers, MapPinned, Play, Plus, Repeat, Save, TimerReset, Trash2, X } from 'lucide-react';
import { distanceUnitLabel, fmtDistance, fromDisplayDistance, toDisplayDistance } from '../geo.js';
import {
  BLOCK_LABELS, CARDIO_ACTIVITIES, INTENSITIES, PLAN_STARTERS, RECOVERY_MODES, blockId, describeBlock, estimatePlanSeconds, fmtSpan,
  newBlock, normalizeBlock, normalizeGoal, planCounts
} from '../plans.js';
import { fromDisplayWeight, toDisplayWeight } from '../utils.js';
import ExercisePicker from './ExercisePicker.jsx';
import { DurationInput, Field, IconButton, Modal, NumberInput, Segmented, Toggle } from './ui.jsx';

const KIND_ICONS = { exercise: Dumbbell, circuit: Layers, cardio: Footprints, intervals: Repeat, rest: TimerReset };
const ADDABLE = ['exercise', 'circuit', 'cardio', 'intervals', 'rest'];
const REST_PRESETS = [0, 30, 60, 90, 120, 180];
const weightLabel = (units) => (units === 'imperial' ? 'lb' : 'kg');
const numberOr = (value, fallback) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

function RestPicker({ label, seconds, onChange }) {
  return (
    <Field label={label}>
      <div className="chip-row" role="radiogroup" aria-label={label}>
        {REST_PRESETS.map((preset) => (
          <button key={preset} type="button" role="radio" aria-checked={seconds === preset} className={`chip ${seconds === preset ? 'active' : ''}`} onClick={() => onChange(preset)}>
            {preset ? fmtSpan(preset) : 'None'}
          </button>
        ))}
        {!REST_PRESETS.includes(seconds) && <span className="chip active static">{fmtSpan(seconds)}</span>}
      </div>
    </Field>
  );
}

// Numbers are edited as typed text and committed on every change, so "" or
// "2." don't get forced back to a number mid-keystroke.
function Num({ label, value, onChange, step = '1', min = 0, suffix, decimal = false }) {
  const [text, setText] = useState(String(value ?? ''));
  const [seen, setSeen] = useState(value);
  if (seen !== value && numberOr(text, NaN) !== value) {
    setSeen(value);
    setText(String(value ?? ''));
  }
  return (
    <Field label={label}>
      <div className="input-with-unit">
        <NumberInput step={step} min={min} inputMode={decimal ? 'decimal' : 'numeric'} value={text} onChange={(next) => {
          setText(next);
          const n = numberOr(next, NaN);
          if (Number.isFinite(n) && n >= min) {
            setSeen(n);
            onChange(n);
          }
        }} />
        {suffix && <span className="input-unit" aria-hidden="true">{suffix}</span>}
      </div>
    </Field>
  );
}

function MovementFields({ item, onChange, exercises, units, recentIds, restLabel = 'Rest after each set' }) {
  return (
    <>
      <ExercisePicker value={item.exerciseId ?? ''} exercises={exercises} recentExerciseIds={recentIds} onChange={(exerciseId) => onChange({ exerciseId })} />
      <div className="plan-fields">
        <Segmented label="Measure" value={item.measure} onChange={(measure) => onChange({ measure })} options={[{ value: 'reps', label: 'Reps' }, { value: 'time', label: 'Time' }]} />
        {item.measure === 'time'
          ? <Field label="Time"><DurationInput label="Time" seconds={item.seconds} onChange={(seconds) => onChange({ seconds })} /></Field>
          : <Num label="Reps" value={item.reps} onChange={(reps) => onChange({ reps })} min={1} />}
        <Num label={`Weight (${weightLabel(units)})`} value={toDisplayWeight(item.weight, units)} onChange={(weight) => onChange({ weight: fromDisplayWeight(weight, units) })} step="0.5" decimal />
      </div>
      <RestPicker label={restLabel} seconds={item.restSeconds} onChange={(restSeconds) => onChange({ restSeconds })} />
    </>
  );
}

function GoalFields({ goal, onChange, units, allowOpen = true, allowDistance = true, label = 'Goal' }) {
  const g = normalizeGoal(goal);
  const options = [allowOpen && { value: 'open', label: 'Open' }, { value: 'time', label: 'Time' }, allowDistance && { value: 'distance', label: 'Distance' }].filter(Boolean);
  const setType = (type) => onChange(normalizeGoal({ type, seconds: g.seconds ?? 600, meters: g.meters ?? 1000 }));
  return (
    <div className="plan-fields">
      <Segmented label={label} value={g.type} onChange={setType} options={options} />
      {g.type === 'time' && <Field label="Time"><DurationInput label="Goal time" seconds={g.seconds} onChange={(seconds) => onChange({ type: 'time', seconds })} /></Field>}
      {g.type === 'distance' && (
        <Num label={`Distance (${distanceUnitLabel(units)})`} value={toDisplayDistance(g.meters, units)} decimal step="0.01" onChange={(value) => value > 0 && onChange({ type: 'distance', meters: fromDisplayDistance(value, units) })} />
      )}
    </div>
  );
}

function ActivityChips({ value, onChange }) {
  return (
    <div className="chip-row" role="radiogroup" aria-label="Activity">
      {CARDIO_ACTIVITIES.map((activity) => (
        <button key={activity.id} type="button" role="radio" aria-checked={value === activity.id} className={`chip ${value === activity.id ? 'active' : ''}`} onClick={() => onChange(activity.id)}>{activity.label}</button>
      ))}
    </div>
  );
}

function BlockEditor({ block, onChange, exercises, units, routes, recentIds }) {
  const patch = (changes) => onChange(normalizeBlock({ ...block, ...changes }));

  if (block.kind === 'exercise') {
    return (
      <>
        <MovementFields item={block} exercises={exercises} units={units} recentIds={recentIds} onChange={patch} />
        <Num label="Sets" value={block.sets} onChange={(sets) => patch({ sets })} min={1} />
      </>
    );
  }

  if (block.kind === 'circuit') {
    const setItem = (index, changes) => patch({ items: block.items.map((item, i) => (i === index ? { ...item, ...changes } : item)) });
    return (
      <>
        <div className="plan-fields">
          <Num label="Rounds" value={block.rounds} onChange={(rounds) => patch({ rounds })} min={1} />
          <Field label="Rest between rounds"><DurationInput label="Rest between rounds" seconds={block.restBetweenRounds} allowZero onChange={(restBetweenRounds) => patch({ restBetweenRounds })} /></Field>
        </div>
        <Toggle checked={block.autoStart} onChange={(autoStart) => patch({ autoStart })} hint="Timed moves start by themselves when the rest before them ends.">Run hands-free</Toggle>
        <ol className="circuit-items">
          {block.items.map((item, index) => (
            <li key={index} className="circuit-item">
              <div className="split"><span className="eyebrow">Move {index + 1}</span>
                {block.items.length > 1 && <IconButton label={`Remove move ${index + 1}`} className="btn-icon btn-icon-sm" onClick={() => patch({ items: block.items.filter((_, i) => i !== index) })}><X size={15} /></IconButton>}
              </div>
              <MovementFields item={item} exercises={exercises} units={units} recentIds={recentIds} restLabel="Rest after this move" onChange={(changes) => setItem(index, changes)} />
            </li>
          ))}
        </ol>
        <button type="button" className="btn-ghost" style={{ justifySelf: 'start' }} onClick={() => patch({ items: [...block.items, { ...block.items.at(-1), exerciseId: null }] })}><Plus size={16} /> Add a move</button>
      </>
    );
  }

  if (block.kind === 'cardio') {
    const route = routes.find((item) => String(item.id) === String(block.routeId));
    return (
      <>
        <ActivityChips value={block.activity} onChange={(activity) => patch({ activity, gps: CARDIO_ACTIVITIES.find((a) => a.id === activity).gps })} />
        {routes.length > 0 && (
          <Field label="Route">
            <select className="input" value={block.routeId ?? ''} onChange={(e) => {
              const picked = routes.find((item) => String(item.id) === e.target.value);
              patch(picked ? { routeId: picked.id, gps: true, goal: { type: 'distance', meters: picked.distance } } : { routeId: null });
            }}>
              <option value="">No route — go anywhere</option>
              {routes.map((item) => <option key={item.id} value={item.id}>{item.name} · {fmtDistance(item.distance, units)}</option>)}
            </select>
          </Field>
        )}
        {route && <span className="muted"><MapPinned size={14} className="inline-icon" /> The route shows on the map while you run; the goal is its distance.</span>}
        <GoalFields goal={block.goal} units={units} onChange={(goal) => patch({ goal })} />
        <div className="plan-fields">
          <Field label="Effort">
            <select className="input" value={block.intensity} onChange={(e) => patch({ intensity: e.target.value })}>
              {INTENSITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Label"><input className="input" value={block.label} placeholder="e.g. Warm-up" onChange={(e) => patch({ label: e.target.value })} /></Field>
        </div>
        <Toggle checked={block.gps} onChange={(gps) => patch({ gps })} hint={block.gps ? 'Records your route and distance outdoors.' : 'Treadmill or indoor — enter distance yourself if you like.'}>Track with GPS</Toggle>
      </>
    );
  }

  if (block.kind === 'intervals') {
    const standing = block.recover.mode === 'rest';
    return (
      <>
        <ActivityChips value={block.activity} onChange={(activity) => patch({ activity, gps: CARDIO_ACTIVITIES.find((a) => a.id === activity).gps })} />
        <Num label="Repeats" value={block.repeats} onChange={(repeats) => patch({ repeats })} min={1} />
        <div className="interval-part">
          <span className="eyebrow">Work</span>
          <GoalFields goal={block.work.goal} units={units} allowOpen={false} label="Each rep" onChange={(goal) => patch({ work: { ...block.work, goal } })} />
        </div>
        <div className="interval-part">
          <span className="eyebrow">Recovery</span>
          <Segmented label="Recovery" hideLabel value={block.recover.mode} options={RECOVERY_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
            onChange={(mode) => patch({ recover: { mode, goal: mode === 'rest' ? { type: 'time', seconds: block.recover.goal.seconds ?? 90 } : block.recover.goal } })} />
          <GoalFields goal={block.recover.goal} units={units} allowOpen={false} allowDistance={!standing} label="Recovery length" onChange={(goal) => patch({ recover: { ...block.recover, goal } })} />
        </div>
        <Toggle checked={block.gps} onChange={(gps) => patch({ gps })} hint="Distance reps finish themselves when GPS says you’ve covered them.">Track with GPS</Toggle>
        <Toggle checked={block.autoStart} onChange={(autoStart) => patch({ autoStart })} hint="Each rep and recovery starts the moment the one before ends, with a beep.">Run hands-free</Toggle>
      </>
    );
  }

  return <Field label="Rest for"><DurationInput label="Rest" seconds={block.seconds} onChange={(seconds) => patch({ seconds })} /></Field>;
}

export default function PlanModal({ plan, exercises, routes = [], units, onClose, onSave, onDelete }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [blocks, setBlocks] = useState(() => (plan?.blocks ?? []).map((block) => normalizeBlock({ ...block, id: block.id ?? blockId() })));
  const [open, setOpen] = useState(() => new Set(plan ? [] : blocks.map((block) => block.id)));
  const [initial] = useState(() => JSON.stringify({ name, blocks }));
  const dirty = JSON.stringify({ name, blocks }) !== initial;
  const counts = planCounts(blocks);
  const seconds = estimatePlanSeconds(blocks);
  const recentIds = blocks.flatMap((block) => (block.kind === 'circuit' ? block.items.map((item) => item.exerciseId) : [block.exerciseId])).filter((id) => id != null);
  const missingExercise = blocks.some((block) => (block.kind === 'exercise' && block.exerciseId == null) || (block.kind === 'circuit' && block.items.some((item) => item.exerciseId == null)));
  const invalid = !blocks.length || missingExercise;

  const toggleOpen = (id) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const add = (kind) => {
    const block = newBlock(kind);
    setBlocks((current) => [...current, block]);
    setOpen((current) => new Set([...current, block.id]));
  };
  const update = (index, block) => setBlocks((current) => current.map((item, i) => (i === index ? block : item)));
  const move = (index, delta) => setBlocks((current) => {
    const next = current.slice();
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    return next;
  });
  const duplicate = (index) => setBlocks((current) => [...current.slice(0, index + 1), { ...structuredClone(current[index]), id: blockId() }, ...current.slice(index + 1)]);
  const remove = (index) => setBlocks((current) => current.filter((_, i) => i !== index));
  const applyStarter = (starter) => {
    const next = starter.blocks();
    setBlocks(next);
    setOpen(new Set(next.map((block) => block.id)));
    if (!name.trim()) setName(starter.name);
  };

  const save = (start = false) => {
    if (invalid) return;
    onSave({ ...(plan ?? {}), name: name.trim() || 'Workout', blocks }, { start });
  };
  const close = () => onClose(dirty);

  return (
    <Modal title={plan?.id ? 'Edit plan' : 'Design a workout'} size="lg" onClose={close} onSubmit={() => save(false)}>
      <div className="plan-head">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Push day, Tempo run…" autoCapitalize="sentences" /></Field>
        {blocks.length > 0 && (
          <div className="plan-stats" aria-live="polite">
            <span><strong>~{fmtSpan(Math.max(60, Math.round(seconds / 60) * 60))}</strong></span>
            <span>{blocks.length} block{blocks.length === 1 ? '' : 's'}</span>
            {counts.exercises > 0 && <span>{counts.exercises} exercise{counts.exercises === 1 ? '' : 's'} · {counts.sets} sets</span>}
          </div>
        )}
      </div>

      {!blocks.length && (
        <div className="card panel stack">
          <strong>Start from a template</strong>
          <div className="starter-grid">
            {PLAN_STARTERS.map((starter) => (
              <button key={starter.id} type="button" className="btn-secondary starter" onClick={() => applyStarter(starter)}>{starter.label}</button>
            ))}
          </div>
          <span className="muted">…or build it block by block below.</span>
        </div>
      )}

      <ol className="plan-blocks">
        {blocks.map((block, index) => {
          const { title, detail } = describeBlock(block, exercises, units);
          const expanded = open.has(block.id);
          return (
            <li key={block.id} className={`plan-block ${expanded ? 'open' : ''}`}>
              <div className="plan-block-head">
                <button type="button" className="plan-block-summary" aria-expanded={expanded} onClick={() => toggleOpen(block.id)}>
                  <span className={`plan-kind kind-${block.kind}`} aria-hidden="true">{createElement(KIND_ICONS[block.kind], { size: 16 })}</span>
                  <span className="plan-block-copy">
                    <span className="eyebrow">{index + 1} · {BLOCK_LABELS[block.kind]}</span>
                    <strong className="truncate">{title}</strong>
                    {detail && <span className="muted truncate">{detail}</span>}
                  </span>
                </button>
                <div className="plan-block-tools">
                  <IconButton label="Move up" className="btn-icon btn-icon-sm" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></IconButton>
                  <IconButton label="Move down" className="btn-icon btn-icon-sm" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></IconButton>
                  <IconButton label="Duplicate block" className="btn-icon btn-icon-sm" onClick={() => duplicate(index)}><Copy size={15} /></IconButton>
                  <IconButton label="Remove block" className="btn-icon btn-icon-sm" onClick={() => remove(index)}><Trash2 size={15} /></IconButton>
                </div>
              </div>
              {expanded && <div className="plan-block-body stack"><BlockEditor block={block} onChange={(next) => update(index, next)} exercises={exercises} units={units} routes={routes} recentIds={recentIds} /></div>}
            </li>
          );
        })}
      </ol>

      <div className="add-block-row">
        <span className="field-label">Add</span>
        <div className="chip-row">
          {ADDABLE.map((kind) => (
            <button key={kind} type="button" className="chip" onClick={() => add(kind)}>{createElement(KIND_ICONS[kind], { size: 14 })} {BLOCK_LABELS[kind]}</button>
          ))}
        </div>
      </div>

      <div className="stack modal-footer" style={{ gap: 8 }}>
        {missingExercise && <span className="muted modal-hint">Choose an exercise for every exercise block to save.</span>}
        <div className="split modal-actions-split">
          {plan?.id && onDelete ? <button className="btn-danger" type="button" onClick={() => onDelete(plan.id)}><Trash2 size={18} /> Delete</button> : <span />}
          <div className="row">
            <button className="btn-secondary" type="button" onClick={close}>Cancel</button>
            <button className="btn-secondary" type="submit" disabled={invalid}><Save size={18} /> Save</button>
            <button className="btn-primary" type="button" disabled={invalid} onClick={() => save(true)}><Play size={18} /> Save &amp; start</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
