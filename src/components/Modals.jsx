import { useState } from 'react';
import { Check, Copy, History, Plus, RotateCcw, Save, Share2, Trash2, TrendingUp, Trophy } from 'lucide-react';
import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT, MUSCLES } from '../data/exercise-library/index.js';
import { canShareText, copyText, SHARE_COPIED, shareText } from '../share.js';
import {
  applyProgression, bestE1rmByExercise, calculateNutritionTargets, dateKey, DEFAULT_GOAL_MIX, DEFAULT_TARGET_BODY_FAT, estimateOneRepMax, EXTRA_NUTRIENTS,
  fmtCalories, fmtDate, fmtMacro, fromDisplayHeight, fromDisplayWeight, fromFeetInches, lastSessionFor, mealForTime, mealLabel,
  muscleLabel, normalizeBodyCompositionTargets, normalizeGoalMix, NUTRIENT_KEYS, NUTRITION_WINDOW_DAYS, round, scaleNutrition, servingLabel, suggestProgression,
  sumComputed, toDisplayHeight, toDisplayWeight, toFeetInches
} from '../utils.js';
import DateInput from './DateInput.jsx';
import ExercisePicker from './ExercisePicker.jsx';
import RestTimerBar from './RestTimer.jsx';
import { useRestTimer } from './useRestTimer.js';
import { Field, IconButton, Modal } from './ui.jsx';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const EQUIPMENT = EXERCISE_EQUIPMENT;
const PROFILE_GOALS = [
  { key: 'performance', label: 'Performance' },
  { key: 'health', label: 'General health' }
];

// Inputs keep the raw string the user typed (so "", "0." and "1.5" all edit
// naturally); values are only coerced to numbers when saving.
const num = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
const text = (value) => (value == null ? '' : String(value));
const weightUnitLabel = (units) => (units === 'imperial' ? 'lb' : 'kg');

function NumberInput({ value, onChange, step = 'any', min = 0, ...props }) {
  // Selecting on focus lets a tap-and-type replace the value instead of appending to it.
  return <input className="input" type="number" inputMode="decimal" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...props} />;
}

/**
 * The footer every editing dialog shares: destructive action on the left, the
 * two decisions on the right, and anything that needs the full width (a rest
 * timer, a reason Save is disabled) on its own row above them.
 *
 * Save carries `form={formId}` because the footer sits outside the scrolling
 * body the `<form>` wraps — see `Modal` in ui.jsx.
 */
function Actions({ formId, onClose, onDelete, deleteLabel = 'Delete', saveDisabled, saveLabel = 'Save', hint, top }) {
  return (
    <>
      {top && <div className="full">{top}</div>}
      {hint && <span className="full modal-hint">{hint}</span>}
      {onDelete && <button className="btn-danger" type="button" onClick={onDelete}><Trash2 size={18} aria-hidden="true" /> {deleteLabel}</button>}
      <span className="spacer" />
      <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
      <button className="btn-primary" type="submit" form={formId} disabled={saveDisabled}><Save size={18} aria-hidden="true" /> {saveLabel}</button>
    </>
  );
}

export function FoodModal({ food, barcode, prefill, onClose, onSave }) {
  // `prefill` seeds a new food from a scanned label (see ScanLabelModal) —
  // ignored once `food` exists, since editing an existing food should never
  // be re-seeded from a leftover scan.
  const per100Source = food?.per100 ?? (food ? null : prefill?.per100);
  const initialServing = food?.servings?.[0]
    ?? (!food && prefill?.servingGrams ? { label: 'serving', grams: prefill.servingGrams } : { label: 'serving', grams: 100 });
  const [draft, setDraft] = useState({
    name: food?.name ?? '',
    brand: food?.brand ?? '',
    barcode: food?.barcode ?? barcode ?? '',
    servingLabel: initialServing.label ?? 'serving',
    servingGrams: text(initialServing.grams),
    calories: text(per100Source?.calories ?? ''),
    protein: text(per100Source?.protein ?? ''),
    carbs: text(per100Source?.carbs ?? ''),
    fat: text(per100Source?.fat ?? ''),
    fibre: text(per100Source?.fibre ?? ''),
    sugar: text(per100Source?.sugar ?? ''),
    salt: text(per100Source?.salt ?? '')
  });
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const grams = num(draft.servingGrams);
  const perServing = scaleNutrition({ per100: { calories: num(draft.calories), protein: num(draft.protein), carbs: num(draft.carbs), fat: num(draft.fat) }, servings: [{ grams }] }, 1, 'serving');
  const invalid = !draft.name.trim() || grams <= 0;

  const save = () => {
    if (invalid) return;
    onSave({
      ...(food ?? {}),
      name: draft.name.trim(),
      brand: draft.brand.trim() || null,
      barcode: draft.barcode.trim() || null,
      source: food?.source ?? (draft.barcode.trim() ? 'scan' : 'custom'),
      servings: [{ label: draft.servingLabel.trim() || 'serving', grams }, { label: '100 g', grams: 100 }],
      per100: Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, num(draft[key])]))
    });
  };

  return (
    <Modal title={food ? 'Edit food' : 'Add food'} onClose={onClose} onSubmit={save}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} saveDisabled={invalid} saveLabel={food ? 'Save' : barcode ? 'Save & log' : 'Save'} hint={grams <= 0 && draft.name.trim() ? 'Serving size must be above 0 g.' : null} />}
    >
      {barcode && !food && <p className="status-warn" style={{ margin: 0, justifySelf: 'start' }}>Barcode {barcode} wasn’t found. Enter it from the label and it’ll be remembered.</p>}
      {prefill && !food && (
        <p className="muted" style={{ margin: 0 }}>
          {prefill.matched ? `Read ${prefill.matched} of ${NUTRIENT_KEYS.length} values from the photo — check them` : 'Couldn’t read values from the photo — enter them'} below before saving.
        </p>
      )}
      <div className="form-grid">
        <Field label="Name"><input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Greek yoghurt" /></Field>
        <Field label="Brand"><input className="input" value={draft.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Optional" /></Field>
        <Field label="Barcode"><input className="input" inputMode="numeric" value={draft.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="Optional" /></Field>
        <div className="form-grid">
          <Field label="Serving name"><input className="input" value={draft.servingLabel} onChange={(e) => set({ servingLabel: e.target.value })} /></Field>
          <Field label="Serving size (g)"><NumberInput value={draft.servingGrams} onChange={(servingGrams) => set({ servingGrams })} /></Field>
        </div>
      </div>
      <div className="card panel stack">
        <strong>Nutrition per 100 g</strong>
        <div className="macro-inputs">
          <Field label="Calories"><NumberInput value={draft.calories} onChange={(calories) => set({ calories })} placeholder="0" /></Field>
          <Field label="Protein (g)"><NumberInput value={draft.protein} onChange={(protein) => set({ protein })} placeholder="0" /></Field>
          <Field label="Carbs (g)"><NumberInput value={draft.carbs} onChange={(carbs) => set({ carbs })} placeholder="0" /></Field>
          <Field label="Fat (g)"><NumberInput value={draft.fat} onChange={(fat) => set({ fat })} placeholder="0" /></Field>
          {EXTRA_NUTRIENTS.map(({ key, label }) => (
            <Field key={key} label={`${label} (g)`}><NumberInput value={draft[key]} onChange={(value) => set({ [key]: value })} placeholder="optional" /></Field>
          ))}
        </div>
        {grams > 0 && <span className="muted">One {draft.servingLabel || 'serving'} ({round(grams, 0)} g) = {fmtCalories(perServing.calories)} · P {fmtMacro(perServing.protein)} · C {fmtMacro(perServing.carbs)} · F {fmtMacro(perServing.fat)}</span>}
      </div>
    </Modal>
  );
}

const QUICK_AMOUNTS = { serving: [0.5, 1, 1.5, 2], g: [50, 100, 150, 200] };

export function LogFoodModal({ food, log, onClose, onSave, onDelete }) {
  // Editing a log must use the nutrition frozen on it, never the (possibly edited) library food.
  const nutritionSource = log?.foodSnapshot?.per100 ? { per100: log.foodSnapshot.per100, servings: log.foodSnapshot.servings } : food;
  const servingGrams = nutritionSource?.servings?.[0]?.grams ?? 100;
  const [draft, setDraft] = useState(() => (log
    ? { date: log.date, mealType: log.mealType, quantity: text(log.quantity), unit: log.unit }
    : { date: dateKey(), mealType: mealForTime(), quantity: '1', unit: 'serving' }));
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const quantity = num(draft.quantity);
  const unchanged = log && quantity === Number(log.quantity) && draft.unit === log.unit;
  const computed = unchanged ? log.computed : scaleNutrition(nutritionSource, quantity, draft.unit);

  const changeUnit = (unit) => {
    if (unit === draft.unit) return;
    // Keep the same real amount when flipping between servings and grams.
    const next = unit === 'g' ? round(quantity * servingGrams, 0) : round(quantity / servingGrams, 2);
    set({ unit, quantity: quantity > 0 ? text(next) : draft.quantity });
  };

  const save = () => {
    if (quantity <= 0) return;
    onSave({ ...(log ?? {}), foodId: log?.foodId ?? food?.id, date: draft.date || dateKey(), mealType: draft.mealType, quantity, unit: draft.unit, computed });
  };

  return (
    <Modal title={log ? 'Edit log' : 'Log food'} onClose={onClose} onSubmit={save}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} onDelete={log ? () => onDelete(log.id) : null} saveDisabled={quantity <= 0} saveLabel={log ? 'Save' : 'Log it'} />}
    >
      <div className="card panel stack">
        <div className="split">
          <div style={{ minWidth: 0 }}>
            <strong>{log?.foodName ?? food?.name}</strong>
            <div className="muted">{log?.brand ?? food?.brand ?? (log ? 'Nutrition frozen at log time' : servingLabel(food))}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="metric">{computed.calories}</div>
            <span className="muted">kcal</span>
          </div>
        </div>
        <div className="macro-strip">
          <span><strong>{computed.protein}g</strong> protein</span>
          <span><strong>{computed.carbs}g</strong> carbs</span>
          <span><strong>{computed.fat}g</strong> fat</span>
          {EXTRA_NUTRIENTS.filter(({ key }) => computed[key] > 0).map(({ key, label }) => <span key={key} className="muted">{computed[key]}g {label.toLowerCase()}</span>)}
        </div>
      </div>
      <div className="form-grid">
        <Field label="Quantity">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <NumberInput value={draft.quantity} onChange={(value) => set({ quantity: value })} style={{ flex: 1 }} aria-label="Quantity" />
            <select className="input" aria-label="Unit" value={draft.unit} onChange={(e) => changeUnit(e.target.value)} style={{ width: 'auto', maxWidth: '55%' }}>
              <option value="serving">× {servingLabel(nutritionSource)}</option>
              <option value="g">grams</option>
            </select>
          </div>
          <div className="chip-row">
            {QUICK_AMOUNTS[draft.unit === 'g' ? 'g' : 'serving'].map((amount) => (
              <button key={amount} type="button" className={`chip ${quantity === amount ? 'active' : ''}`} onClick={() => set({ quantity: text(amount) })}>
                {draft.unit === 'g' ? `${amount} g` : `×${amount}`}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Meal">
          <div className="chip-row" role="radiogroup" aria-label="Meal">
            {MEALS.map((meal) => (
              <button key={meal} type="button" role="radio" aria-checked={draft.mealType === meal} className={`chip ${draft.mealType === meal ? 'active' : ''}`} onClick={() => set({ mealType: meal })}>{mealLabel(meal)}</button>
            ))}
          </div>
        </Field>
        <Field label="Date"><DateInput value={draft.date} onChange={(date) => set({ date })} max={dateKey()} /></Field>
      </div>
    </Modal>
  );
}

export function ExerciseModal({ exercise, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(exercise ?? { name: '', category: 'other', equipment: 'barbell', primaryMuscles: [], secondaryMuscles: [] });
  const other = { primaryMuscles: 'secondaryMuscles', secondaryMuscles: 'primaryMuscles' };
  const toggle = (key, muscle) => {
    setDraft((current) => {
      const selected = new Set(current[key] ?? []);
      if (selected.has(muscle)) selected.delete(muscle);
      else selected.add(muscle);
      // A muscle is either primary or secondary; counting it as both would double its volume.
      return { ...current, [key]: [...selected], [other[key]]: (current[other[key]] ?? []).filter((item) => item !== muscle) };
    });
  };
  const invalid = !draft.name.trim() || !draft.primaryMuscles?.length;

  return (
    <Modal title={exercise ? 'Edit exercise' : 'Add exercise'} onClose={onClose} large onSubmit={() => !invalid && onSave({ ...draft, name: draft.name.trim() })}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} onDelete={exercise?.id && onDelete ? () => onDelete(exercise.id) : null} saveDisabled={invalid} hint={draft.name.trim() && !draft.primaryMuscles?.length ? 'Pick at least one primary muscle.' : exercise ? 'Changes apply to future sets; logged workouts keep their original muscle volume.' : null} />}
    >
      <div className="form-grid">
        <Field label="Name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Cable Fly" /></Field>
        <Field label="Folder">
          <select className="input" value={draft.category ?? 'other'} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {EXERCISE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </Field>
        <Field label="Equipment">
          <select className="input" value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}>
            {[...new Set([...EQUIPMENT, draft.equipment].filter(Boolean))].map((item) => <option key={item} value={item}>{muscleLabel(item)}</option>)}
          </select>
        </Field>
      </div>
      {draft.equipment === 'bodyweight' && <span className="muted">Bodyweight sets count your latest bodyweight plus any added weight towards volume.</span>}
      <div className="grid-auto">
        {['primaryMuscles', 'secondaryMuscles'].map((key) => (
          <fieldset key={key} className="card panel stack fieldset">
            <legend className="sr-only">{key === 'primaryMuscles' ? 'Primary muscles' : 'Secondary muscles'}</legend>
            <div className="split">
              <strong>{key === 'primaryMuscles' ? 'Primary muscles' : 'Secondary muscles'}</strong>
              <span className="muted">{key === 'primaryMuscles' ? 'full volume' : 'half volume'}</span>
            </div>
            <div className="chip-row">
              {MUSCLES.map((muscle) => {
                const active = draft[key]?.includes(muscle);
                return (
                  <button key={muscle} type="button" aria-pressed={active} className={`chip ${active ? 'active' : ''}`} onClick={() => toggle(key, muscle)}>{muscleLabel(muscle)}</button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}

const toSetDraft = (set, units) => ({ exerciseId: String(set.exerciseId ?? ''), weight: text(set.weight ? toDisplayWeight(set.weight, units) : ''), reps: text(set.reps ?? ''), rpe: text(set.rpe ?? '') });
const blankSet = (exerciseId) => ({ exerciseId: String(exerciseId ?? ''), weight: '', reps: '8', rpe: '' });
const comparable = (date, sets) => JSON.stringify({ date, sets: sets.map(({ done: _done, ...set }) => set) });
const fmtSetShort = (set, units) => `${set.weight ? toDisplayWeight(set.weight, units) : 'BW'}×${set.reps}`;

export function WorkoutModal({ workout, template, exercises, workouts = [], units, restSeconds = 90, onRestSecondsChange, onClose, onSave, onDelete }) {
  const source = workout ?? template;
  const [date, setDate] = useState(workout?.date ? dateKey(workout.date) : dateKey());
  const [sets, setSets] = useState(() => (source?.sets?.length ? source.sets.map((set) => toSetDraft(set, units)) : [blankSet(exercises[0]?.id)]));
  const [initial] = useState(() => comparable(date, sets));
  const timer = useRestTimer();
  const dirty = comparable(date, sets) !== initial;
  const updateSet = (index, patch) => setSets((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeSet = (index) => setSets((rows) => rows.filter((_, i) => i !== index));
  const duplicateSet = (index) => setSets((rows) => [...rows.slice(0, index + 1), { ...rows[index], done: false }, ...rows.slice(index + 1)]);
  const addSet = () => setSets((rows) => [...rows, rows.length ? { ...rows.at(-1), rpe: '', done: false } : blankSet(exercises[0]?.id)]);
  const toggleDone = (index) => {
    const done = !sets[index].done;
    updateSet(index, { done });
    if (done) timer.start(restSeconds);
  };
  const validSets = sets.filter((set) => set.exerciseId && num(set.reps) > 0);
  const findExercise = (id) => exercises.find((exercise) => String(exercise.id) === String(id));
  const previousBest = bestE1rmByExercise(workouts, { excludeId: workout?.id });

  // Replace the contiguous block of rows for this exercise with last session's sets.
  const fillFromLast = (index, last, suggestion) => {
    setSets((rows) => {
      let end = index;
      while (end < rows.length && rows[end].exerciseId === rows[index].exerciseId) end += 1;
      const filled = applyProgression(last.sets, suggestion).map((set) => ({ ...toSetDraft(set, units), exerciseId: rows[index].exerciseId, rpe: '' }));
      return [...rows.slice(0, index), ...filled, ...rows.slice(end)];
    });
  };

  const save = () => {
    if (!validSets.length) return;
    onSave({ date, sets: validSets.map((set) => ({ exerciseId: set.exerciseId, reps: num(set.reps), weight: fromDisplayWeight(num(set.weight), units), rpe: set.rpe === '' ? null : num(set.rpe) })) });
  };

  const close = () => onClose(dirty);
  const setNumbers = sets.map((set, index) => sets.slice(0, index + 1).filter((row) => row.exerciseId === set.exerciseId).length);
  const doneCount = sets.filter((set) => set.done).length;

  return (
    <Modal title={workout ? 'Edit workout' : template?.name ?? (template ? 'Repeat workout' : 'Log workout')} onClose={close} large onSubmit={save}
      footer={({ formId }) => <Actions formId={formId} onClose={close} onDelete={workout ? () => onDelete(workout.id) : null} deleteLabel="Delete workout" saveDisabled={!validSets.length} top={<RestTimerBar timer={timer} seconds={restSeconds} onSecondsChange={(value) => onRestSecondsChange?.(value)} />} hint={!validSets.length ? 'Add reps to at least one set to save.' : validSets.length < sets.length ? `${sets.length - validSets.length} set(s) without reps will be skipped.` : null} />}
    >
      <div className="split" style={{ flexWrap: 'wrap' }}>
        <Field label="Date"><DateInput value={date} onChange={setDate} max={dateKey()} /></Field>
        {doneCount > 0 && <span className="muted">{doneCount} of {sets.length} sets done</span>}
      </div>
      <div className="stack set-list">
        {sets.map((set, index) => {
          const exercise = findExercise(set.exerciseId);
          const startsGroup = index === 0 || sets[index - 1].exerciseId !== set.exerciseId;
          const last = startsGroup ? lastSessionFor(workouts, set.exerciseId, { excludeId: workout?.id, beforeDate: date }) : null;
          const suggestion = last ? suggestProgression(last, exercise, units) : null;
          const weightKg = fromDisplayWeight(num(set.weight), units);
          const best = previousBest.get(String(set.exerciseId));
          const isPr = best > 0 && weightKg > 0 && num(set.reps) > 0 && estimateOneRepMax(weightKg, num(set.reps)) > best;
          return (
            <div className={`set-row ${startsGroup ? 'group-start' : ''} ${set.done ? 'done' : ''}`} key={index}>
              {last && (
                <div className="last-time">
                  <History size={14} aria-hidden="true" />
                  <span className="truncate">Last · {fmtDate(last.date, 'd MMM')}: {last.sets.map((item) => fmtSetShort(item, units)).join(', ')}</span>
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap', marginLeft: 'auto' }}>
                    <button type="button" className="chip" onClick={() => fillFromLast(index, last)} title="Same as last time">Repeat</button>
                    {suggestion && suggestion.kind !== 'repeat' && (
                      <button type="button" className="chip active" onClick={() => fillFromLast(index, last, suggestion)} title="Last session looked comfortable — progress a little">
                        <TrendingUp size={13} /> {suggestion.label}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="set-exercise">
                <span className="set-number" aria-hidden="true">{setNumbers[index]}</span>
                <ExercisePicker value={set.exerciseId} exercises={exercises} recentExerciseIds={sets.map((row) => row.exerciseId)} onChange={(exerciseId) => updateSet(index, { exerciseId })} />
                {isPr && <span className="pr-badge" title="Beats your best estimated 1RM"><Trophy size={13} /> PR</span>}
              </div>
              <div className="set-fields">
                <label className="set-field"><span>{exercise?.equipment === 'bodyweight' ? `+${weightUnitLabel(units)}` : weightUnitLabel(units)}</span><NumberInput step="0.5" value={set.weight} onChange={(weight) => updateSet(index, { weight })} placeholder="0" /></label>
                <label className="set-field"><span>reps</span><NumberInput step="1" value={set.reps} onChange={(reps) => updateSet(index, { reps })} inputMode="numeric" placeholder="0" /></label>
                <label className="set-field"><span>RPE</span><NumberInput step="0.5" max={10} value={set.rpe} onChange={(rpe) => updateSet(index, { rpe })} placeholder="–" /></label>
                <div className="set-buttons">
                  <IconButton label={set.done ? `Mark set ${index + 1} not done` : `Mark set ${index + 1} done and start rest`} aria-pressed={Boolean(set.done)} className={`btn-icon done-toggle ${set.done ? 'active' : ''}`} onClick={() => toggleDone(index)}><Check size={17} /></IconButton>
                  <IconButton label={`Duplicate set ${index + 1}`} onClick={() => duplicateSet(index)}><Copy size={16} /></IconButton>
                  <IconButton label={`Remove set ${index + 1}`} onClick={() => removeSet(index)} disabled={sets.length === 1}><Trash2 size={16} /></IconButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn-secondary" type="button" onClick={addSet} style={{ justifySelf: 'start' }}><Plus size={18} /> Add set</button>
    </Modal>
  );
}

const GOAL_TYPES = [
  { value: 'strength', label: 'Strength (estimated 1RM)' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'volume', label: 'Weekly muscle volume' },
  { value: 'nutrition', label: 'Nutrition adherence' }
];
const canonicalWeightGoal = (type) => type === 'strength' || type === 'bodyweight';

export function GoalModal({ goal, exercises, units, latestBodyweight, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    type: goal?.type ?? 'strength',
    title: goal?.title ?? '',
    target: goal ? text(canonicalWeightGoal(goal.type) ? toDisplayWeight(goal.target, units) : goal.target) : '',
    exerciseId: String(goal?.exerciseId ?? exercises[0]?.id ?? ''),
    muscle: goal?.muscle ?? 'chest',
    metric: goal?.metric ?? 'protein',
    direction: goal?.direction ?? 'down'
  }));
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const target = num(draft.target);
  const unit = weightUnitLabel(units);
  const exercise = exercises.find((item) => String(item.id) === draft.exerciseId);
  const autoTitle = {
    strength: `${exercise?.name ?? 'Lift'} ${target || '…'} ${unit}`,
    bodyweight: `${draft.direction === 'down' ? 'Cut' : 'Build'} to ${target || '…'} ${unit}`,
    volume: `${muscleLabel(draft.muscle)} ${target ? target.toLocaleString() : '…'} weekly volume`,
    nutrition: `Hit ${draft.metric} ${target || '…'}/${NUTRITION_WINDOW_DAYS} days`
  }[draft.type];
  const targetLabel = {
    strength: `Target 1RM (${unit})`,
    bodyweight: `Target weight (${unit})`,
    volume: 'Target weekly volume',
    nutrition: `Days on target (of ${NUTRITION_WINDOW_DAYS})`
  }[draft.type];
  const invalid = target <= 0 || (draft.type === 'nutrition' && target > NUTRITION_WINDOW_DAYS);

  const save = () => {
    if (invalid) return;
    const base = { type: draft.type, title: draft.title.trim() || autoTitle, target: canonicalWeightGoal(draft.type) ? fromDisplayWeight(target, units) : target };
    const extra = {
      strength: { exerciseId: exercise?.id ?? draft.exerciseId },
      bodyweight: { direction: draft.direction },
      volume: { muscle: draft.muscle },
      nutrition: { metric: draft.metric }
    }[draft.type];
    onSave({ ...(goal ?? {}), ...base, ...extra });
  };

  return (
    <Modal title={goal ? 'Edit goal' : 'Add goal'} onClose={onClose} onSubmit={save}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} saveDisabled={invalid} hint={draft.type === 'nutrition' && target > NUTRITION_WINDOW_DAYS ? `Maximum is ${NUTRITION_WINDOW_DAYS} days.` : null} />}
    >
      <div className="form-grid">
        <Field label="Type">
          <select className="input" value={draft.type} onChange={(e) => set({ type: e.target.value, target: '' })}>
            {GOAL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </Field>
        {draft.type === 'strength' && (
          <Field label="Exercise">
            <select className="input" value={draft.exerciseId} onChange={(e) => set({ exerciseId: e.target.value })}>
              {exercises.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
            </select>
          </Field>
        )}
        {draft.type === 'bodyweight' && (
          <Field label="Direction">
            <select className="input" value={draft.direction} onChange={(e) => set({ direction: e.target.value })}>
              <option value="down">Lose weight</option>
              <option value="up">Gain weight</option>
            </select>
          </Field>
        )}
        {draft.type === 'volume' && (
          <Field label="Muscle">
            <select className="input" value={draft.muscle} onChange={(e) => set({ muscle: e.target.value })}>
              {MUSCLES.map((muscle) => <option key={muscle} value={muscle}>{muscleLabel(muscle)}</option>)}
            </select>
          </Field>
        )}
        {draft.type === 'nutrition' && (
          <Field label="Macro">
            <select className="input" value={draft.metric} onChange={(e) => set({ metric: e.target.value })}>
              <option value="calories">Calories (±10%)</option><option value="protein">Protein (≥90%)</option><option value="carbs">Carbs (±10%)</option><option value="fat">Fat (±10%)</option>
            </select>
          </Field>
        )}
        <Field label={targetLabel}>
          <NumberInput value={draft.target} onChange={(value) => set({ target: value })} max={draft.type === 'nutrition' ? NUTRITION_WINDOW_DAYS : undefined} placeholder={draft.type === 'bodyweight' && latestBodyweight ? String(toDisplayWeight(latestBodyweight, units)) : ''} />
        </Field>
        <Field label="Title"><input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={autoTitle} /></Field>
      </div>
      {draft.type === 'bodyweight' && <span className="muted">Progress is measured from your first bodyweight log towards the target.</span>}
      {draft.type === 'nutrition' && <span className="muted">Counts days in the last {NUTRITION_WINDOW_DAYS} where your {draft.metric} landed on your daily target from Profile.</span>}
    </Modal>
  );
}

export function ProfileModal({ profile, onboarding = false, onClose, onSave }) {
  const startingHeightUnit = profile.heightUnit ?? 'imperial';
  const startingWeightUnit = profile.weightUnit ?? profile.units ?? 'metric';
  const startingHeight = toFeetInches(profile.height);
  const startingComposition = normalizeBodyCompositionTargets(profile);
  const [draft, setDraft] = useState({ ...profile, goalMix: normalizeGoalMix(profile.goalMix ?? DEFAULT_GOAL_MIX) });
  const [heightUnit, setHeightUnit] = useState(startingHeightUnit);
  const [weightUnit, setWeightUnit] = useState(startingWeightUnit);
  const [heightCmText, setHeightCmText] = useState(String(toDisplayHeight(profile.height, 'metric')));
  const [heightFeetText, setHeightFeetText] = useState(String(startingHeight.feet));
  const [heightInchesText, setHeightInchesText] = useState(String(Math.round(startingHeight.inches)));
  const [weightText, setWeightText] = useState(String(toDisplayWeight(profile.bodyweight, startingWeightUnit)));
  const [targetWeightText, setTargetWeightText] = useState(String(toDisplayWeight(startingComposition.targetBodyweight, startingWeightUnit)));
  const [targetBodyFatText, setTargetBodyFatText] = useState(text(startingComposition.targetBodyFat ?? DEFAULT_TARGET_BODY_FAT));
  const [targetWeightEdited, setTargetWeightEdited] = useState(false);
  const [targetText, setTargetText] = useState(() => Object.fromEntries(Object.entries(profile.targets ?? {}).map(([key, value]) => [key, text(value)])));
  const targetBodyweight = fromDisplayWeight(num(targetWeightText), weightUnit);
  const targetBodyFat = num(targetBodyFatText);
  const calculatedTargets = calculateNutritionTargets({ ...draft, targetBodyweight, targetBodyFat });
  const setGuided = (patch, nextComposition = { targetBodyweight, targetBodyFat }) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    // Changing stats, composition targets or training priorities recalculates
    // daily targets, replacing any manual macro override.
    setTargetText(Object.fromEntries(Object.entries(calculateNutritionTargets({ ...next, ...nextComposition })).map(([key, value]) => [key, text(value)])));
  };
  const targets = Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map((key) => [key, num(targetText[key])]));
  const overridden = ['calories', 'protein', 'carbs', 'fat'].some((key) => targets[key] !== calculatedTargets[key]);
  const changeWeightUnit = (unit) => {
    const targetKg = fromDisplayWeight(num(targetWeightText), weightUnit);
    setWeightUnit(unit);
    setWeightText(String(toDisplayWeight(draft.bodyweight, unit)));
    setTargetWeightText(String(toDisplayWeight(targetKg, unit)));
  };
  const changeHeightUnit = (unit) => {
    setHeightUnit(unit);
    if (unit === 'metric') {
      setHeightCmText(String(toDisplayHeight(draft.height, 'metric')));
    } else {
      const next = toFeetInches(draft.height);
      setHeightFeetText(String(next.feet));
      setHeightInchesText(String(Math.round(next.inches)));
    }
  };
  const changeMetricHeight = (value) => {
    setHeightCmText(value);
    if (num(value) > 0) setGuided({ height: fromDisplayHeight(value, 'metric') });
  };
  const changeImperialHeight = (part, value) => {
    if (part === 'feet') setHeightFeetText(value);
    else setHeightInchesText(value);
    const feet = part === 'feet' ? value : heightFeetText;
    const inches = part === 'inches' ? value : heightInchesText;
    if (num(feet) > 0 || num(inches) > 0) setGuided({ height: fromFeetInches(feet, inches) });
  };
  const changeWeight = (value) => {
    setWeightText(value);
    if (num(value) > 0) {
      const nextWeight = fromDisplayWeight(value, weightUnit);
      if (onboarding && !targetWeightEdited) {
        setTargetWeightText(value);
        setGuided({ bodyweight: nextWeight }, { targetBodyweight: nextWeight, targetBodyFat });
      } else {
        setGuided({ bodyweight: nextWeight });
      }
    }
  };
  const changeTargetWeight = (value) => {
    setTargetWeightEdited(true);
    setTargetWeightText(value);
    setGuided({}, { targetBodyweight: fromDisplayWeight(num(value), weightUnit), targetBodyFat });
  };
  const changeTargetBodyFat = (value) => {
    setTargetBodyFatText(value);
    setGuided({}, { targetBodyweight, targetBodyFat: num(value) });
  };
  const changeGoal = (key, value) => {
    setGuided({ goalMix: { ...normalizeGoalMix(draft.goalMix), [key]: Number(value) } });
  };
  const mix = normalizeGoalMix(draft.goalMix);
  const invalid = num(weightText) <= 0
    || (heightUnit === 'metric' ? num(heightCmText) <= 0 : num(heightFeetText) <= 0 && num(heightInchesText) <= 0)
    || targetBodyweight < 35
    || targetBodyFat < 3
    || targetBodyFat > 60
    || targets.calories <= 0;

  const save = () => {
    if (invalid) return;
    // The weight unit picked here is the unit the rest of the app displays.
    onSave({ ...draft, heightUnit, weightUnit, units: weightUnit, targetBodyweight, targetBodyFat, targets: onboarding ? calculatedTargets : targets, onboarded: true });
  };

  return (
    <Modal
      title={onboarding ? 'Set up Finesse Fit' : 'Profile'}
      subtitle={onboarding ? 'Three numbers now; everything else can wait.' : null}
      onClose={onClose}
      onSubmit={save}
      footer={({ formId }) => (
        <>
          <span className="spacer" />
          <button className="btn-secondary" type="button" onClick={onClose}>{onboarding ? 'Skip for now' : 'Cancel'}</button>
          <button className="btn-primary" type="submit" form={formId} disabled={invalid}><Save size={18} aria-hidden="true" /> {onboarding ? 'Get started' : 'Save'}</button>
        </>
      )}
    >
      {onboarding && (
        <p className="secondary" style={{ margin: 0 }}>
          Add your body stats and body-composition targets. Finesse Fit will estimate daily calories and macros from those inputs.
        </p>
      )}
      <div className="form-grid">
        <Field label="Height">
          <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
            {heightUnit === 'metric' ? (
              <NumberInput value={heightCmText} onChange={changeMetricHeight} placeholder="178" style={{ flex: 1, minWidth: 0 }} aria-label="Height in centimetres" />
            ) : (
              <>
                <NumberInput value={heightFeetText} onChange={(value) => changeImperialHeight('feet', value)} placeholder="5" style={{ flex: 1, minWidth: 0 }} aria-label="Feet" />
                <NumberInput value={heightInchesText} onChange={(value) => changeImperialHeight('inches', value)} placeholder="10" style={{ flex: 1, minWidth: 0 }} aria-label="Inches" />
              </>
            )}
            <select className="input" aria-label="Height unit" value={heightUnit} onChange={(e) => changeHeightUnit(e.target.value)} style={{ width: 92, flex: 'none' }}>
              <option value="metric">cm</option>
              <option value="imperial">ft/in</option>
            </select>
          </div>
        </Field>
        <Field label="Bodyweight">
          <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
            <NumberInput value={weightText} onChange={changeWeight} placeholder={weightUnit === 'imperial' ? '172' : '78'} style={{ flex: 1, minWidth: 0 }} aria-label="Bodyweight" />
            <select className="input" aria-label="Weight unit" value={weightUnit} onChange={(e) => changeWeightUnit(e.target.value)} style={{ width: 92, flex: 'none' }}>
              <option value="metric">kg</option>
              <option value="imperial">lb</option>
            </select>
          </div>
        </Field>
      </div>
      <div className="card panel stack">
        <div>
          <strong>Body composition targets</strong>
          <div className="muted" style={{ marginTop: 4 }}>Set the outcome you’re working towards. Daily nutrition targets update from these values.</div>
        </div>
        <div className="form-grid">
          <Field label="Target body weight">
            <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
              <NumberInput step="0.1" value={targetWeightText} onChange={changeTargetWeight} placeholder={weightUnit === 'imperial' ? '154' : '70'} style={{ flex: 1, minWidth: 0 }} aria-label="Target body weight" />
              <span className="input-unit" aria-hidden="true">{weightUnitLabel(weightUnit)}</span>
            </div>
          </Field>
          <Field label="Target body fat">
            <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
              <NumberInput step="0.1" min="3" max="60" value={targetBodyFatText} onChange={changeTargetBodyFat} placeholder={String(DEFAULT_TARGET_BODY_FAT)} style={{ flex: 1, minWidth: 0 }} aria-label="Target body fat" />
              <span className="input-unit" aria-hidden="true">%</span>
            </div>
          </Field>
        </div>
      </div>
      <div className="card panel stack">
        <strong>Training priorities</strong>
        {PROFILE_GOALS.map((goal) => (
          <label key={goal.key} className="stack" style={{ gap: 6 }}>
            <div className="split"><span className="secondary">{goal.label}</span><strong>{mix[goal.key]}%</strong></div>
            <input className="range" type="range" min="0" max="100" step="5" value={mix[goal.key]} onChange={(e) => changeGoal(goal.key, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="card panel stack">
        <div className="split">
          <strong>{onboarding || !overridden ? 'Calculated daily targets' : 'Your daily targets'}</strong>
          {!onboarding && overridden && <span className="status-warn">Manual override</span>}
        </div>
        <div className="target-grid">
          <div><div className="metric">{onboarding ? calculatedTargets.calories : targets.calories}</div><span className="muted">kcal</span></div>
          <div><div className="metric">{onboarding ? calculatedTargets.protein : targets.protein}g</div><span className="muted">protein</span></div>
          <div><div className="metric">{onboarding ? calculatedTargets.carbs : targets.carbs}g</div><span className="muted">carbs</span></div>
          <div><div className="metric">{onboarding ? calculatedTargets.fat : targets.fat}g</div><span className="muted">fat</span></div>
        </div>
      </div>
      {!onboarding && (
        <details className="card panel">
          <summary><strong>Manual target override</strong> <span className="muted">· changing stats, composition targets or priorities recalculates these</span></summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <div className="macro-inputs">
              <Field label="Calories"><NumberInput value={targetText.calories ?? ''} onChange={(value) => setTargetText({ ...targetText, calories: value })} /></Field>
              <Field label="Protein (g)"><NumberInput value={targetText.protein ?? ''} onChange={(value) => setTargetText({ ...targetText, protein: value })} /></Field>
              <Field label="Carbs (g)"><NumberInput value={targetText.carbs ?? ''} onChange={(value) => setTargetText({ ...targetText, carbs: value })} /></Field>
              <Field label="Fat (g)"><NumberInput value={targetText.fat ?? ''} onChange={(value) => setTargetText({ ...targetText, fat: value })} /></Field>
            </div>
            {overridden && (
              <button className="btn-secondary" type="button" style={{ justifySelf: 'start' }} onClick={() => setTargetText(Object.fromEntries(Object.entries(calculatedTargets).map(([key, value]) => [key, text(value)])))}>
                <RotateCcw size={16} /> Use calculated targets
              </button>
            )}
          </div>
        </details>
      )}
    </Modal>
  );
}

export function BodyweightModal({ units, latest, onClose, onSave }) {
  const [date, setDate] = useState(dateKey());
  const [weight, setWeight] = useState(latest ? text(toDisplayWeight(latest, units)) : '');
  const invalid = num(weight) <= 0;
  const save = () => !invalid && onSave({ date, weight: fromDisplayWeight(num(weight), units) });
  return (
    <Modal title="Log bodyweight" size="sm" onClose={onClose} onSubmit={save}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} saveDisabled={invalid} />}
    >
      <div className="form-grid">
        <Field label={`Weight (${weightUnitLabel(units)})`}><NumberInput step="0.1" value={weight} onChange={setWeight} /></Field>
        <Field label="Date"><DateInput value={date} onChange={setDate} max={dateKey()} /></Field>
      </div>
    </Modal>
  );
}

export function LogMealModal({ meal, onClose, onLog, onDelete }) {
  const [date, setDate] = useState(dateKey());
  const [mealType, setMealType] = useState(meal.mealType ?? mealForTime());
  const totals = sumComputed(meal.items);

  return (
    <Modal title={meal.name} onClose={onClose} onSubmit={() => onLog({ date, mealType })}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} onDelete={() => onDelete(meal.id)} deleteLabel="Delete meal" saveLabel="Log meal" />}
    >
      <div className="card panel stack">
        <div className="split">
          <span className="muted">{meal.items.length} {meal.items.length === 1 ? 'item' : 'items'}</span>
          <div style={{ textAlign: 'right' }}><span className="metric">{totals.calories}</span> <span className="muted">kcal</span></div>
        </div>
        <div className="macro-strip">
          <span><strong>{totals.protein}g</strong> protein</span>
          <span><strong>{totals.carbs}g</strong> carbs</span>
          <span><strong>{totals.fat}g</strong> fat</span>
        </div>
        <div className="list" style={{ gap: 6 }}>
          {meal.items.map((item, index) => (
            <div key={index} className="split secondary">
              <span className="truncate">{item.foodName} <span className="muted">· {item.quantity} {item.unit === 'g' ? 'g' : item.quantity === 1 ? 'serving' : 'servings'}</span></span>
              <span className="nowrap">{fmtCalories(item.computed?.calories)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="form-grid">
        <Field label="Meal">
          <div className="chip-row" role="radiogroup" aria-label="Meal">
            {MEALS.map((type) => (
              <button key={type} type="button" role="radio" aria-checked={mealType === type} className={`chip ${mealType === type ? 'active' : ''}`} onClick={() => setMealType(type)}>{mealLabel(type)}</button>
            ))}
          </div>
        </Field>
        <Field label="Date"><DateInput value={date} onChange={setDate} max={dateKey()} /></Field>
      </div>
      <span className="muted">Items still in your food library use their current nutrition.</span>
    </Modal>
  );
}

export function QuickAddModal({ log, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => ({
    name: log?.foodName ?? '',
    date: log?.date ?? dateKey(),
    mealType: log?.mealType ?? mealForTime(),
    ...Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map((key) => [key, text(log?.computed?.[key] ?? '')]))
  }));
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const calories = num(draft.calories);
  const macroCalories = num(draft.protein) * 4 + num(draft.carbs) * 4 + num(draft.fat) * 9;
  const save = () => {
    const kcal = calories || Math.round(macroCalories);
    if (kcal <= 0) return;
    onSave({
      name: draft.name.trim() || 'Quick add',
      date: draft.date || dateKey(),
      mealType: draft.mealType,
      computed: { ...(log?.computed ?? {}), calories: kcal, protein: num(draft.protein), carbs: num(draft.carbs), fat: num(draft.fat) }
    });
  };

  return (
    <Modal title={log ? 'Edit quick add' : 'Quick add'} onClose={onClose} onSubmit={save}
      footer={({ formId }) => <Actions formId={formId} onClose={onClose} onDelete={log ? () => onDelete(log.id) : null} saveDisabled={calories <= 0 && macroCalories <= 0} saveLabel={log ? 'Save' : 'Log it'} />}
    >
      <Field label="Description"><input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Restaurant pasta" /></Field>
      <div className="macro-inputs">
        <Field label="Calories"><NumberInput value={draft.calories} onChange={(value) => set({ calories: value })} placeholder={macroCalories ? String(Math.round(macroCalories)) : '0'} /></Field>
        <Field label="Protein (g)"><NumberInput value={draft.protein} onChange={(value) => set({ protein: value })} placeholder="0" /></Field>
        <Field label="Carbs (g)"><NumberInput value={draft.carbs} onChange={(value) => set({ carbs: value })} placeholder="0" /></Field>
        <Field label="Fat (g)"><NumberInput value={draft.fat} onChange={(value) => set({ fat: value })} placeholder="0" /></Field>
      </div>
      {!calories && macroCalories > 0 && <span className="muted">Calories will be estimated from macros: {Math.round(macroCalories)} kcal.</span>}
      <div className="form-grid">
        <Field label="Meal">
          <div className="chip-row" role="radiogroup" aria-label="Meal">
            {MEALS.map((type) => (
              <button key={type} type="button" role="radio" aria-checked={draft.mealType === type} className={`chip ${draft.mealType === type ? 'active' : ''}`} onClick={() => set({ mealType: type })}>{mealLabel(type)}</button>
            ))}
          </div>
        </Field>
        <Field label="Date"><DateInput value={draft.date} onChange={(date) => set({ date })} max={dateKey()} /></Field>
      </div>
    </Modal>
  );
}

export function AiContextModal({ text, onClose }) {
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const outcome = await copyText(draft);
    if (outcome === SHARE_COPIED) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  const share = () => shareText({ text: draft, title: 'Finesse Fit — today’s context' });

  return (
    <Modal
      title="AI context"
      subtitle="Stays on this device until you paste it somewhere."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="spacer" />
          {canShareText() && <button className="btn-secondary" type="button" onClick={share}><Share2 size={16} aria-hidden="true" /> Share</button>}
          <button className="btn-primary" type="button" onClick={copy}>{copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}</button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        Today’s nutrition, training and goals, written out as background for an AI chat. Paste this in first, edit anything below if you like, then ask your actual question.
      </p>
      <textarea
        className="input"
        style={{ minHeight: 360, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: 1.6, resize: 'vertical' }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="AI context text"
      />
    </Modal>
  );
}
