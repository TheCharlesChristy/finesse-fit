import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { MUSCLES } from '../data/exercises.js';
import { DEFAULT_GOAL_MIX, calculateNutritionTargets, dateKey, fmtCalories, fmtMacro, fromDisplayHeight, fromDisplayWeight, fromFeetInches, normalizeGoalMix, scaleNutrition, toDisplayHeight, toDisplayWeight, toFeetInches } from '../utils.js';
import DateInput from './DateInput.jsx';
import ItemSelect from './ItemSelect.jsx';
import { Field, IconButton, Modal } from './ui.jsx';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const PROFILE_GOALS = [
  { key: 'fatLoss', label: 'Fat loss' },
  { key: 'muscleGain', label: 'Muscle gain' },
  { key: 'performance', label: 'Performance' },
  { key: 'health', label: 'General health' }
];
const emptyFood = { name: '', brand: '', barcode: '', source: 'custom', servings: [{ label: 'serving', grams: 100 }], per100: { calories: 0, protein: 0, carbs: 0, fat: 0 } };
const makeEmptyFood = (barcode = '') => ({
  ...emptyFood,
  barcode,
  source: barcode ? 'scan' : 'custom',
  servings: emptyFood.servings.map((serving) => ({ ...serving })),
  per100: { ...emptyFood.per100 }
});

export function FoodModal({ food, barcode, onClose, onSave }) {
  const [draft, setDraft] = useState(food ?? makeEmptyFood(barcode || ''));
  const per100 = draft.per100 ?? emptyFood.per100;
  const serving = draft.servings?.[0] ?? { label: 'serving', grams: 100 };
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const setMacro = (key, value) => set({ per100: { ...per100, [key]: Number(value) } });

  return (
    <Modal title={food ? 'Edit food' : 'Add food'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Name"><input className="glass-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Brand"><input className="glass-input" value={draft.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field label="Barcode"><input className="glass-input" value={draft.barcode ?? ''} onChange={(e) => set({ barcode: e.target.value })} /></Field>
        <Field label="Serving label"><input className="glass-input" value={serving.label} onChange={(e) => set({ servings: [{ ...serving, label: e.target.value }, { label: '100 g', grams: 100 }] })} /></Field>
        <Field label="Serving grams"><input className="glass-input" type="number" value={serving.grams} onChange={(e) => set({ servings: [{ ...serving, grams: Number(e.target.value) }, { label: '100 g', grams: 100 }] })} /></Field>
        <Field label="Calories / 100 g"><input className="glass-input" type="number" value={per100.calories} onChange={(e) => setMacro('calories', e.target.value)} /></Field>
        <Field label="Protein / 100 g"><input className="glass-input" type="number" value={per100.protein} onChange={(e) => setMacro('protein', e.target.value)} /></Field>
        <Field label="Carbs / 100 g"><input className="glass-input" type="number" value={per100.carbs} onChange={(e) => setMacro('carbs', e.target.value)} /></Field>
        <Field label="Fat / 100 g"><input className="glass-input" type="number" value={per100.fat} onChange={(e) => setMacro('fat', e.target.value)} /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-primary" type="button" disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim(), brand: draft.brand || null, barcode: draft.barcode || null })}><Save size={18} /> Save</button>
      </div>
    </Modal>
  );
}

export function LogFoodModal({ food, log, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(log ?? { foodId: food?.id, date: dateKey(), mealType: 'breakfast', quantity: 1, unit: 'serving' });
  const nutritionSource = food ?? { per100: log?.foodSnapshot?.per100, servings: log?.foodSnapshot?.servings };
  const computed = scaleNutrition(nutritionSource, draft.quantity, draft.unit);

  return (
    <Modal title={log ? 'Edit log' : `Log ${food?.name ?? 'food'}`} onClose={onClose}>
      <div className="glass panel stack">
        <div className="split">
          <div>
            <strong>{food?.name ?? log?.foodName}</strong>
            <div className="muted">{food?.brand ?? log?.brand ?? 'Frozen nutrition'}</div>
          </div>
          <div className="metric">{computed.calories}</div>
        </div>
        <div className="row secondary">
          <span>{computed.protein}g protein</span><span>{computed.carbs}g carbs</span><span>{computed.fat}g fat</span>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Date"><DateInput value={draft.date} onChange={(date) => setDraft({ ...draft, date })} /></Field>
        <Field label="Meal">
          <select className="glass-input" value={draft.mealType} onChange={(e) => setDraft({ ...draft, mealType: e.target.value })}>
            {MEALS.map((meal) => <option key={meal} value={meal}>{meal}</option>)}
          </select>
        </Field>
        <Field label="Quantity"><input className="glass-input" type="number" step="0.1" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} /></Field>
        <Field label="Unit">
          <select className="glass-input" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
            <option value="serving">serving</option>
            <option value="g">grams</option>
          </select>
        </Field>
      </div>
      <div className="split">
        {log && <button className="btn-danger" type="button" onClick={() => onDelete(log.id)}><Trash2 size={18} /> Delete</button>}
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" type="button" onClick={() => onSave({ ...draft, foodId: draft.foodId ?? food?.id, computed })}><Save size={18} /> Save</button>
        </div>
      </div>
    </Modal>
  );
}

export function FoodPickerModal({ foods, onClose, onPick, onAdd }) {
  return (
    <Modal title="Choose food" onClose={onClose}>
      <ItemSelect items={foods} onChange={onPick} placeholder="Search food library" />
      <button className="btn-secondary" type="button" onClick={onAdd}><Plus size={18} /> Add custom food</button>
    </Modal>
  );
}

export function ExerciseModal({ exercise, onClose, onSave }) {
  const [draft, setDraft] = useState(exercise ?? { name: '', equipment: 'barbell', primaryMuscles: [], secondaryMuscles: [] });
  const toggle = (key, muscle) => {
    const set = new Set(draft[key] ?? []);
    if (set.has(muscle)) set.delete(muscle);
    else set.add(muscle);
    setDraft({ ...draft, [key]: [...set] });
  };

  return (
    <Modal title={exercise ? 'Edit exercise' : 'Add exercise'} onClose={onClose} large>
      <div className="form-grid">
        <Field label="Name"><input className="glass-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Equipment"><input className="glass-input" value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} /></Field>
      </div>
      <div className="grid-auto">
        {['primaryMuscles', 'secondaryMuscles'].map((key) => (
          <div key={key} className="glass panel stack">
            <strong>{key === 'primaryMuscles' ? 'Primary muscles' : 'Secondary muscles'}</strong>
            <div className="grid-auto">
              {MUSCLES.map((muscle) => (
                <label key={muscle} className="row secondary">
                  <input type="checkbox" checked={draft[key]?.includes(muscle)} onChange={() => toggle(key, muscle)} /> {muscle.replaceAll('_', ' ')}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-primary" type="button" disabled={!draft.name.trim() || !draft.primaryMuscles.length} onClick={() => onSave(draft)}><Save size={18} /> Save</button>
      </div>
    </Modal>
  );
}

const emptySet = (exerciseId = '') => ({ exerciseId, reps: 8, weight: 0, rpe: '' });

export function WorkoutModal({ workout, exercises, units, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(workout?.date?.slice(0, 10) ?? dateKey());
  const [sets, setSets] = useState(workout?.sets?.map((set) => ({ ...set, weight: toDisplayWeight(set.weight, units), rpe: set.rpe ?? '' })) ?? [emptySet(exercises[0]?.id)]);
  const updateSet = (index, patch) => setSets((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const cleanSets = sets.map(({ attribution: _attribution, volume: _volume, ...set }) => ({ ...set, weight: fromDisplayWeight(set.weight, units) }));

  return (
    <Modal title={workout ? 'Edit workout' : 'Log workout'} onClose={onClose} large>
      <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
      <div className="stack">
        {sets.map((set, index) => (
          <div className="list-row" key={index}>
            <div className="form-grid">
              <Field label="Exercise">
                <select className="glass-input" value={set.exerciseId} onChange={(e) => updateSet(index, { exerciseId: e.target.value })}>
                  {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                </select>
              </Field>
              <Field label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`}><input className="glass-input" type="number" step="0.5" value={set.weight} onChange={(e) => updateSet(index, { weight: e.target.value })} /></Field>
              <Field label="Reps"><input className="glass-input" type="number" value={set.reps} onChange={(e) => updateSet(index, { reps: e.target.value })} /></Field>
              <Field label="RPE"><input className="glass-input" type="number" step="0.5" value={set.rpe} onChange={(e) => updateSet(index, { rpe: e.target.value })} /></Field>
            </div>
          </div>
        ))}
      </div>
      <div className="split">
        <button className="btn-secondary" type="button" onClick={() => setSets([...sets, emptySet(sets.at(-1)?.exerciseId ?? exercises[0]?.id)])}><Plus size={18} /> Add set</button>
        {workout && <button className="btn-danger" type="button" onClick={() => onDelete(workout.id)}><Trash2 size={18} /> Delete</button>}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-primary" type="button" onClick={() => onSave({ date, sets: cleanSets })}><Save size={18} /> Save</button>
      </div>
    </Modal>
  );
}

export function GoalModal({ goal, exercises, onClose, onSave }) {
  const [draft, setDraft] = useState(goal ?? { type: 'strength', title: '', target: 100, exerciseId: exercises[0]?.id, muscle: 'chest', metric: 'calories' });

  return (
    <Modal title={goal ? 'Edit goal' : 'Add goal'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Type">
          <select className="glass-input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <option value="strength">strength</option>
            <option value="bodyweight">bodyweight</option>
            <option value="volume">weekly volume</option>
            <option value="nutrition">nutrition adherence</option>
          </select>
        </Field>
        <Field label="Title"><input className="glass-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Target"><input className="glass-input" type="number" value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} /></Field>
        {draft.type === 'strength' && (
          <Field label="Exercise">
            <select className="glass-input" value={draft.exerciseId} onChange={(e) => setDraft({ ...draft, exerciseId: e.target.value })}>
              {exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </select>
          </Field>
        )}
        {draft.type === 'volume' && (
          <Field label="Muscle">
            <select className="glass-input" value={draft.muscle} onChange={(e) => setDraft({ ...draft, muscle: e.target.value })}>
              {MUSCLES.map((muscle) => <option key={muscle} value={muscle}>{muscle.replaceAll('_', ' ')}</option>)}
            </select>
          </Field>
        )}
        {draft.type === 'nutrition' && (
          <Field label="Metric">
            <select className="glass-input" value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })}>
              <option value="calories">calories</option><option value="protein">protein</option><option value="carbs">carbs</option><option value="fat">fat</option>
            </select>
          </Field>
        )}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-primary" type="button" disabled={!draft.title.trim()} onClick={() => onSave(draft)}><Save size={18} /> Save</button>
      </div>
    </Modal>
  );
}

export function ProfileModal({ profile, onboarding = false, onClose, onSave }) {
  const startingHeightUnit = profile.heightUnit ?? 'imperial';
  const startingWeightUnit = profile.weightUnit ?? profile.units ?? 'metric';
  const startingHeight = toFeetInches(profile.height);
  const [draft, setDraft] = useState({ ...profile, goalMix: normalizeGoalMix(profile.goalMix ?? DEFAULT_GOAL_MIX) });
  const [heightUnit, setHeightUnit] = useState(startingHeightUnit);
  const [weightUnit, setWeightUnit] = useState(startingWeightUnit);
  const [heightCmText, setHeightCmText] = useState(String(toDisplayHeight(profile.height, 'metric')));
  const [heightFeetText, setHeightFeetText] = useState(String(startingHeight.feet));
  const [heightInchesText, setHeightInchesText] = useState(String(startingHeight.inches));
  const [weightText, setWeightText] = useState(String(toDisplayWeight(profile.bodyweight, startingWeightUnit)));
  const targets = draft.targets ?? {};
  const calculatedTargets = calculateNutritionTargets(draft);
  const setGuided = (patch) => {
    const next = { ...draft, ...patch };
    setDraft({ ...next, targets: calculateNutritionTargets(next) });
  };
  const setTarget = (key, value) => setDraft({ ...draft, targets: { ...targets, [key]: Number(value) } });
  const changeWeightUnit = (unit) => {
    setWeightUnit(unit);
    setWeightText(String(toDisplayWeight(draft.bodyweight, unit)));
  };
  const changeHeightUnit = (unit) => {
    setHeightUnit(unit);
    if (unit === 'metric') {
      setHeightCmText(String(toDisplayHeight(draft.height, 'metric')));
    } else {
      const next = toFeetInches(draft.height);
      setHeightFeetText(String(next.feet));
      setHeightInchesText(String(next.inches));
    }
  };
  const changeMetricHeight = (value) => {
    setHeightCmText(value);
    if (value !== '') setGuided({ height: fromDisplayHeight(value, 'metric') });
  };
  const changeImperialHeight = (part, value) => {
    if (part === 'feet') setHeightFeetText(value);
    else setHeightInchesText(value);
    const feet = part === 'feet' ? value : heightFeetText;
    const inches = part === 'inches' ? value : heightInchesText;
    if (feet !== '' || inches !== '') setGuided({ height: fromFeetInches(feet, inches) });
  };
  const changeWeight = (value) => {
    setWeightText(value);
    if (value !== '') setGuided({ bodyweight: fromDisplayWeight(value, weightUnit) });
  };
  const changeGoal = (key, value) => {
    setGuided({ goalMix: { ...normalizeGoalMix(draft.goalMix), [key]: Number(value) } });
  };

  return (
    <Modal title={onboarding ? 'Set up Finesse Fit' : 'Profile'} onClose={onboarding ? onClose : undefined}>
      {onboarding && (
        <p className="secondary" style={{ margin: 0 }}>
          Add your body stats and blend your goals. Finesse Fit will calculate daily calories and macros from those inputs.
        </p>
      )}
      <div className="form-grid">
        <Field label="Height">
          <div className="row" style={{ alignItems: 'stretch' }}>
            {heightUnit === 'metric' ? (
              <input className="glass-input" type="number" value={heightCmText} onChange={(e) => changeMetricHeight(e.target.value)} placeholder="178" style={{ flex: 1 }} />
            ) : (
              <>
                <input className="glass-input" type="number" value={heightFeetText} onChange={(e) => changeImperialHeight('feet', e.target.value)} placeholder="5" style={{ flex: 1 }} />
                <input className="glass-input" type="number" value={heightInchesText} onChange={(e) => changeImperialHeight('inches', e.target.value)} placeholder="10" style={{ flex: 1 }} />
              </>
            )}
            <select className="glass-input" value={heightUnit} onChange={(e) => changeHeightUnit(e.target.value)} style={{ width: 112 }}>
              <option value="metric">cm</option>
              <option value="imperial">ft/in</option>
            </select>
          </div>
        </Field>
        <Field label="Bodyweight">
          <div className="row" style={{ alignItems: 'stretch' }}>
            <input className="glass-input" type="number" value={weightText} onChange={(e) => changeWeight(e.target.value)} placeholder={weightUnit === 'imperial' ? '172' : '78'} style={{ flex: 1 }} />
            <select className="glass-input" value={weightUnit} onChange={(e) => changeWeightUnit(e.target.value)} style={{ width: 112 }}>
              <option value="metric">kg</option>
              <option value="imperial">lb</option>
            </select>
          </div>
        </Field>
      </div>
      <div className="glass panel stack">
        <strong>Goal blend</strong>
        {PROFILE_GOALS.map((goal) => (
          <label key={goal.key} className="stack">
            <div className="split"><span className="secondary">{goal.label}</span><strong>{normalizeGoalMix(draft.goalMix)[goal.key]}%</strong></div>
            <input className="glass-range" type="range" min="0" max="100" step="5" value={normalizeGoalMix(draft.goalMix)[goal.key]} onChange={(e) => changeGoal(goal.key, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="glass panel stack">
        <strong>Calculated daily targets</strong>
        <div className="grid-auto">
          <div><div className="metric">{calculatedTargets.calories}</div><span className="muted">calories</span></div>
          <div><div className="metric">{calculatedTargets.protein}g</div><span className="muted">protein</span></div>
          <div><div className="metric">{calculatedTargets.carbs}g</div><span className="muted">carbs</span></div>
          <div><div className="metric">{calculatedTargets.fat}g</div><span className="muted">fat</span></div>
        </div>
      </div>
      {!onboarding && (
        <details className="glass panel stack">
          <summary><strong>Manual target override</strong> <span className="muted">Current: {fmtCalories(targets.calories)} · P {fmtMacro(targets.protein)} · C {fmtMacro(targets.carbs)} · F {fmtMacro(targets.fat)}</span></summary>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Calories"><input className="glass-input" type="number" value={targets.calories} onChange={(e) => setTarget('calories', e.target.value)} /></Field>
            <Field label="Protein"><input className="glass-input" type="number" value={targets.protein} onChange={(e) => setTarget('protein', e.target.value)} /></Field>
            <Field label="Carbs"><input className="glass-input" type="number" value={targets.carbs} onChange={(e) => setTarget('carbs', e.target.value)} /></Field>
            <Field label="Fat"><input className="glass-input" type="number" value={targets.fat} onChange={(e) => setTarget('fat', e.target.value)} /></Field>
          </div>
        </details>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {!onboarding && <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>}
        <button className="btn-primary" type="button" onClick={() => onSave({ ...draft, heightUnit, weightUnit, targets: onboarding ? calculatedTargets : draft.targets, onboarded: true })}><Save size={18} /> Save</button>
      </div>
    </Modal>
  );
}

export function BodyweightModal({ units, onClose, onSave }) {
  const [date, setDate] = useState(dateKey());
  const [weight, setWeight] = useState('');
  return (
    <Modal title="Log bodyweight" onClose={onClose}>
      <div className="form-grid">
        <Field label="Date"><DateInput value={date} onChange={setDate} /></Field>
        <Field label={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`}><input className="glass-input" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="btn-primary" type="button" onClick={() => onSave({ date, weight: fromDisplayWeight(weight, units) })}>Save</button>
      </div>
    </Modal>
  );
}
