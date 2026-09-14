// Pure workout-plan model. A plan is a template (like a library food): it's
// stored in the `templates` table, expanded into a flat list of steps when a
// session starts, and never touched by what actually happened — the saved
// workout is the record. Weights are canonical kg, distances metres, times seconds.
//
// Plan:  { id, name, notes, blocks: Block[] }
// Block kinds:
//   exercise  — sets × reps (or × seconds) of one exercise, rest between sets
//   circuit   — rounds × a list of exercises (supersets, HIIT, EMOM-ish)
//   cardio    — one run/walk/ride segment with an open, time or distance goal
//   intervals — repeats × (work + recovery), e.g. 6 × 400 m / 90 s jog
//   rest      — a timed rest

import { fmtDistance } from './geo.js';
import { exerciseName, fmtWeight } from './utils.js';

export const BLOCK_KINDS = ['exercise', 'circuit', 'cardio', 'intervals', 'rest'];

export const CARDIO_ACTIVITIES = [
  { id: 'run', label: 'Run', gps: true, secondsPerMeter: 0.36 },
  { id: 'walk', label: 'Walk', gps: true, secondsPerMeter: 0.72 },
  { id: 'cycle', label: 'Ride', gps: true, secondsPerMeter: 0.16 },
  { id: 'row', label: 'Row', gps: false, secondsPerMeter: 0.24 },
  { id: 'other', label: 'Cardio', gps: false, secondsPerMeter: 0.4 }
];

export const INTENSITIES = [
  { id: 'easy', label: 'Easy' },
  { id: 'steady', label: 'Steady' },
  { id: 'hard', label: 'Hard' },
  { id: 'recovery', label: 'Recovery' }
];

export const RECOVERY_MODES = [
  { id: 'jog', label: 'Jog' },
  { id: 'walk', label: 'Walk' },
  { id: 'rest', label: 'Stand still' }
];

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const int = (value, fallback, min = 0) => Math.max(min, Math.round(num(value, fallback)));
export const activityFor = (id) => CARDIO_ACTIVITIES.find((item) => item.id === id) ?? CARDIO_ACTIVITIES.at(-1);
export const activityLabel = (id) => activityFor(id).label;
export const intensityLabel = (id) => INTENSITIES.find((item) => item.id === id)?.label ?? '';

let counter = 0;
export const blockId = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`;

export function normalizeGoal(goal = {}) {
  const type = ['time', 'distance'].includes(goal?.type) ? goal.type : 'open';
  return { type, seconds: type === 'time' ? int(goal.seconds, 600, 1) : null, meters: type === 'distance' ? int(goal.meters, 1000, 1) : null };
}

function normalizeMovement(item = {}) {
  const measure = item.measure === 'time' ? 'time' : 'reps';
  return {
    exerciseId: item.exerciseId ?? null,
    measure,
    reps: int(item.reps, 8),
    seconds: int(item.seconds, 30, 1),
    weight: Math.max(0, num(item.weight)),
    restSeconds: int(item.restSeconds, 60)
  };
}

export function normalizeBlock(block = {}, index = 0) {
  const id = block.id ?? `b${index}`;
  switch (block.kind) {
    case 'circuit':
      return {
        id, kind: 'circuit', name: block.name ?? '',
        rounds: int(block.rounds, 3, 1),
        restBetweenRounds: int(block.restBetweenRounds, 60),
        autoStart: block.autoStart ?? true,
        items: (block.items?.length ? block.items : [{}]).map(normalizeMovement)
      };
    case 'cardio': {
      const activity = activityFor(block.activity ?? 'run').id;
      return {
        id, kind: 'cardio', activity,
        label: block.label ?? '',
        intensity: block.intensity ?? 'steady',
        goal: normalizeGoal(block.goal),
        gps: block.gps ?? activityFor(activity).gps,
        routeId: block.routeId ?? null
      };
    }
    case 'intervals': {
      const activity = activityFor(block.activity ?? 'run').id;
      return {
        id, kind: 'intervals', activity,
        repeats: int(block.repeats, 6, 1),
        work: { goal: normalizeGoal(block.work?.goal ?? { type: 'distance', meters: 400 }), intensity: block.work?.intensity ?? 'hard' },
        recover: { goal: normalizeGoal(block.recover?.goal ?? { type: 'time', seconds: 90 }), mode: RECOVERY_MODES.some((m) => m.id === block.recover?.mode) ? block.recover.mode : 'jog' },
        gps: block.gps ?? activityFor(activity).gps,
        autoStart: block.autoStart ?? true
      };
    }
    case 'rest':
      return { id, kind: 'rest', seconds: int(block.seconds, 120, 1) };
    default:
      return { id, kind: 'exercise', ...normalizeMovement(block), sets: int(block.sets, 3, 1), autoStart: Boolean(block.autoStart) };
  }
}

// Plans saved before blocks existed were `{ name, sets: [{ exerciseId, reps, weight, rpe }] }`.
// Consecutive sets of one exercise become one exercise block.
function blocksFromLegacySets(sets = []) {
  const blocks = [];
  for (const set of sets) {
    const last = blocks.at(-1);
    if (last && String(last.exerciseId) === String(set.exerciseId) && last.reps === num(set.reps) && last.weight === num(set.weight)) last.sets += 1;
    else blocks.push({ kind: 'exercise', exerciseId: set.exerciseId, sets: 1, reps: num(set.reps), weight: num(set.weight), restSeconds: 90 });
  }
  return blocks;
}

export function normalizePlan(plan = {}) {
  const raw = Array.isArray(plan.blocks) ? plan.blocks : blocksFromLegacySets(plan.sets);
  const { sets: _legacy, ...rest } = plan;
  return { ...rest, name: String(plan.name ?? '').trim() || 'Workout', notes: plan.notes ?? '', blocks: raw.map(normalizeBlock) };
}

export function newBlock(kind, defaults = {}) {
  const base = { id: blockId(), kind };
  if (kind === 'circuit') return normalizeBlock({ ...base, rounds: 3, restBetweenRounds: 60, items: [{ exerciseId: defaults.exerciseId, measure: 'time', seconds: 40, restSeconds: 20 }] });
  if (kind === 'cardio') return normalizeBlock({ ...base, activity: 'run', goal: { type: 'open' } });
  if (kind === 'intervals') return normalizeBlock({ ...base, activity: 'run' });
  if (kind === 'rest') return normalizeBlock({ ...base, seconds: 120 });
  return normalizeBlock({ ...base, exerciseId: defaults.exerciseId, sets: 3, reps: 8, restSeconds: 90 });
}

// ---- Expansion: plan blocks → ordered steps a session ticks through ----
//
// Step keys are positional ("b2.r1.i0.s3") — sessions only ever append blocks,
// so a key never changes meaning once a session has results stored against it.

function movementStep(item, { key, blockIndex, kind, restAfter, autoStart, ...extra }) {
  return {
    key, blockIndex, blockKind: kind, type: 'exercise',
    exerciseId: item.exerciseId, measure: item.measure,
    targetReps: item.measure === 'reps' ? item.reps : null,
    targetSeconds: item.measure === 'time' ? item.seconds : null,
    targetWeight: item.weight,
    restAfter, autoStart: Boolean(autoStart),
    ...extra
  };
}

function cardioStep({ key, blockIndex, kind, activity, goal, intensity, gps, label, routeId = null, autoStart }) {
  return { key, blockIndex, blockKind: kind, type: 'cardio', activity, goal, intensity, gps: Boolean(gps), label, routeId, restAfter: 0, autoStart: Boolean(autoStart) };
}

export function expandBlocks(blocks = []) {
  const steps = [];
  blocks.map(normalizeBlock).forEach((block, b) => {
    if (block.kind === 'exercise') {
      for (let s = 0; s < block.sets; s += 1) {
        steps.push(movementStep(block, { key: `b${b}.s${s}`, blockIndex: b, kind: 'exercise', restAfter: block.restSeconds, autoStart: block.autoStart, setNumber: s + 1, setCount: block.sets }));
      }
    } else if (block.kind === 'circuit') {
      for (let r = 0; r < block.rounds; r += 1) {
        block.items.forEach((item, i) => {
          const endOfRound = i === block.items.length - 1;
          steps.push(movementStep(item, {
            key: `b${b}.r${r}.i${i}`, blockIndex: b, kind: 'circuit',
            restAfter: endOfRound ? block.restBetweenRounds : item.restSeconds,
            autoStart: block.autoStart, round: r + 1, rounds: block.rounds
          }));
        });
      }
    } else if (block.kind === 'cardio') {
      steps.push(cardioStep({ key: `b${b}`, blockIndex: b, kind: 'cardio', ...block, label: block.label || intensityLabel(block.intensity) }));
    } else if (block.kind === 'intervals') {
      for (let r = 0; r < block.repeats; r += 1) {
        steps.push(cardioStep({ key: `b${b}.r${r}.work`, blockIndex: b, kind: 'intervals', activity: block.activity, goal: block.work.goal, intensity: block.work.intensity, gps: block.gps, autoStart: block.autoStart, label: `Rep ${r + 1} of ${block.repeats}` }));
        if (r === block.repeats - 1) continue; // no recovery after the final rep
        const recoverKey = `b${b}.r${r}.recover`;
        if (block.recover.mode === 'rest') {
          steps.push({ key: recoverKey, blockIndex: b, blockKind: 'intervals', type: 'rest', targetSeconds: block.recover.goal.seconds ?? 90, label: 'Recovery', restAfter: 0, autoStart: true });
        } else {
          steps.push(cardioStep({ key: recoverKey, blockIndex: b, kind: 'intervals', activity: block.recover.mode === 'walk' ? 'walk' : block.activity, goal: block.recover.goal, intensity: 'recovery', gps: block.gps, autoStart: block.autoStart, label: `${block.recover.mode === 'walk' ? 'Walk' : 'Jog'} recovery` }));
        }
      }
    } else if (block.kind === 'rest') {
      steps.push({ key: `b${b}`, blockIndex: b, blockKind: 'rest', type: 'rest', targetSeconds: block.seconds, label: 'Rest', restAfter: 0, autoStart: true });
    }
  });
  return steps;
}

// Timed steps count down on their own; reps-based steps wait for a tick.
export function stepTargetSeconds(step) {
  if (step.type === 'rest') return step.targetSeconds;
  if (step.type === 'exercise') return step.measure === 'time' ? step.targetSeconds : null;
  return step.goal?.type === 'time' ? step.goal.seconds : null;
}

export const stepTargetMeters = (step) => (step.type === 'cardio' && step.goal?.type === 'distance' ? step.goal.meters : null);

// ---- Summaries ----

const REP_SECONDS = 3;
const SET_SETUP_SECONDS = 15;

export function estimatePlanSeconds(blocks = []) {
  const steps = expandBlocks(blocks);
  return Math.round(steps.reduce((total, step, index) => {
    let work = 0;
    if (step.type === 'rest') work = step.targetSeconds;
    else if (step.type === 'exercise') work = step.measure === 'time' ? step.targetSeconds : step.targetReps * REP_SECONDS + SET_SETUP_SECONDS;
    else if (step.goal.type === 'time') work = step.goal.seconds;
    else if (step.goal.type === 'distance') work = step.goal.meters * activityFor(step.activity).secondsPerMeter;
    const rest = index < steps.length - 1 ? step.restAfter : 0;
    return total + work + rest;
  }, 0));
}

export const planHasGps = (blocks = []) => expandBlocks(blocks).some((step) => step.type === 'cardio' && step.gps);
export const planHasOpenGoal = (blocks = []) => blocks.some((block) => block.kind === 'cardio' && normalizeGoal(block.goal).type === 'open');

export function planCounts(blocks = []) {
  const steps = expandBlocks(blocks);
  const exercises = new Set(steps.filter((step) => step.type === 'exercise' && step.exerciseId != null).map((step) => String(step.exerciseId)));
  return {
    exercises: exercises.size,
    sets: steps.filter((step) => step.type === 'exercise').length,
    cardio: steps.filter((step) => step.type === 'cardio').length,
    steps: steps.length
  };
}

// ---- Feeding a session back into its plan ----

// The heaviest completed set per exercise in each block becomes that block's
// new target, so next time the plan starts where today finished. Cardio and
// rest blocks keep their goals — a slow day shouldn't rewrite a 5k plan.
export function planWithActuals(blocks = [], steps = [], entries = {}) {
  return blocks.map((raw, b) => {
    const block = normalizeBlock(raw, b);
    const done = steps.filter((step) => step.blockIndex === b && step.type === 'exercise' && entries[step.key]?.status === 'done');
    if (!done.length) return block;
    const best = (predicate) => done.filter(predicate).map((step) => entries[step.key]).reduce((top, entry) => (
      !top || num(entry.weight) > num(top.weight) || (num(entry.weight) === num(top.weight) && num(entry.reps) > num(top.reps)) ? entry : top
    ), null);
    const apply = (item, top) => (top ? { ...item, weight: num(top.weight), ...(item.measure === 'time' ? { seconds: int(top.seconds, item.seconds, 1) } : { reps: int(top.reps, item.reps, 1) }) } : item);
    if (block.kind === 'exercise') return apply(block, best(() => true));
    if (block.kind === 'circuit') {
      return { ...block, items: block.items.map((item, i) => apply(item, best((step) => step.key.endsWith(`.i${i}`)))) };
    }
    return block;
  });
}

// ---- Plain-English descriptions ----

// 45 → "45 s", 120 → "2 min", 90 → "1:30", 3900 → "1 h 5 min"
export function fmtSpan(seconds) {
  const s = Math.max(0, Math.round(num(seconds)));
  if (s < 60) return `${s} s`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h${s % 3600 >= 60 ? ` ${Math.floor((s % 3600) / 60)} min` : ''}`;
  return s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`;
}

export function describeGoal(goal, units = 'metric') {
  const g = normalizeGoal(goal);
  if (g.type === 'time') return fmtSpan(g.seconds);
  if (g.type === 'distance') return fmtDistance(g.meters, units);
  return 'open';
}

const movementTarget = (item, units) => {
  const amount = item.measure === 'time' ? fmtSpan(item.seconds) : `${item.reps}`;
  return num(item.weight) > 0 ? `${amount} @ ${fmtWeight(item.weight, units)}` : amount;
};

export const BLOCK_LABELS = { exercise: 'Exercise', circuit: 'Circuit', cardio: 'Cardio', intervals: 'Intervals', rest: 'Rest' };

// { title, detail } for plan lists, the editor and the session's step groups.
export function describeBlock(raw, exercises = [], units = 'metric') {
  const block = normalizeBlock(raw);
  if (block.kind === 'exercise') {
    return { title: block.exerciseId != null ? exerciseName(exercises, block.exerciseId) : 'Choose an exercise', detail: `${block.sets} × ${movementTarget(block, units)}${block.restSeconds ? ` · ${fmtSpan(block.restSeconds)} rest` : ''}` };
  }
  if (block.kind === 'circuit') {
    const names = block.items.map((item) => (item.exerciseId != null ? exerciseName(exercises, item.exerciseId) : '…'));
    return { title: block.name || `Circuit · ${block.rounds} round${block.rounds === 1 ? '' : 's'}`, detail: names.join(' → ') };
  }
  if (block.kind === 'cardio') {
    const goal = describeGoal(block.goal, units);
    return { title: block.label || `${activityLabel(block.activity)}${goal === 'open' ? '' : ` · ${goal}`}`, detail: [goal === 'open' ? 'Open-ended' : null, intensityLabel(block.intensity), block.gps ? 'GPS' : null].filter(Boolean).join(' · ') };
  }
  if (block.kind === 'intervals') {
    const recovery = RECOVERY_MODES.find((mode) => mode.id === block.recover.mode)?.label.toLowerCase();
    return { title: `${block.repeats} × ${describeGoal(block.work.goal, units)} ${activityLabel(block.activity).toLowerCase()}`, detail: `${describeGoal(block.recover.goal, units)} ${recovery} recovery${block.gps ? ' · GPS' : ''}` };
  }
  return { title: `Rest · ${fmtSpan(block.seconds)}`, detail: '' };
}

export function stepTitle(step, exercises = []) {
  if (step.type === 'exercise') return exerciseName(exercises, step.exerciseId);
  if (step.type === 'rest') return step.label || 'Rest';
  return step.blockKind === 'intervals' ? `${step.intensity === 'recovery' ? step.label : activityLabel(step.activity)}` : `${activityLabel(step.activity)}${step.label && step.label !== intensityLabel(step.intensity) ? ` · ${step.label}` : ''}`;
}

export function stepSubtitle(step) {
  if (step.type === 'exercise') return step.round ? `Round ${step.round} of ${step.rounds}` : `Set ${step.setNumber} of ${step.setCount}`;
  if (step.type === 'rest') return step.blockKind === 'intervals' ? 'Stand and recover' : 'Timed rest';
  if (step.blockKind === 'intervals') return step.intensity === 'recovery' ? 'Recovery' : `${step.label} · ${intensityLabel(step.intensity)}`;
  return intensityLabel(step.intensity);
}

export function stepTargetText(step, units = 'metric') {
  if (step.type === 'exercise') {
    const target = movementTarget({ measure: step.measure, reps: step.targetReps, seconds: step.targetSeconds, weight: step.targetWeight }, units);
    return step.measure === 'reps' && !(num(step.targetWeight) > 0) ? `${target} reps` : target;
  }
  if (step.type === 'rest') return fmtSpan(step.targetSeconds);
  return describeGoal(step.goal, units);
}

// Ready-made plans for an empty editor, so "design a workout" never starts from nothing.
export const PLAN_STARTERS = [
  { id: 'strength', label: 'Strength', name: 'Strength session', blocks: () => [newBlock('exercise'), newBlock('exercise'), newBlock('exercise')] },
  { id: 'run', label: 'Easy run', name: 'Easy run', blocks: () => [normalizeBlock({ id: blockId(), kind: 'cardio', activity: 'run', intensity: 'easy', goal: { type: 'time', seconds: 1800 } })] },
  {
    id: 'intervals', label: 'Interval run', name: 'Intervals · 6 × 400 m',
    blocks: () => [
      normalizeBlock({ id: blockId(), kind: 'cardio', activity: 'run', label: 'Warm-up', intensity: 'easy', goal: { type: 'time', seconds: 600 } }),
      normalizeBlock({ id: blockId(), kind: 'intervals', activity: 'run', repeats: 6, work: { goal: { type: 'distance', meters: 400 } }, recover: { goal: { type: 'time', seconds: 90 }, mode: 'jog' } }),
      normalizeBlock({ id: blockId(), kind: 'cardio', activity: 'run', label: 'Cool-down', intensity: 'easy', goal: { type: 'time', seconds: 600 } })
    ]
  },
  {
    id: 'hiit', label: 'HIIT circuit', name: 'HIIT circuit',
    blocks: () => [normalizeBlock({ id: blockId(), kind: 'circuit', rounds: 4, restBetweenRounds: 60, items: [
      { exerciseId: 'seed:burpee', measure: 'time', seconds: 40, restSeconds: 20 },
      { exerciseId: 'seed:mountain_climber', measure: 'time', seconds: 40, restSeconds: 20 },
      { exerciseId: 'seed:jumping_jack', measure: 'time', seconds: 40, restSeconds: 20 },
      { exerciseId: 'seed:bodyweight_squat', measure: 'time', seconds: 40, restSeconds: 20 }
    ] })]
  }
];
