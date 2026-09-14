// Pure live-workout engine: a reducer over a plain, serialisable state object
// so the whole session can be written to IndexedDB (`activeSession`) and picked
// back up if the phone kills the app mid-workout. Time always comes in on the
// action (`now`), never from Date.now() here, so every transition is testable.
//
// State:
//   { planId, name, startedAt, blocks, entries, currentKey, timer, track, cue, settings }
//   entries[key] = { status: 'pending'|'done'|'skipped', reps, weight, rpe, seconds, meters, elapsedMs, trackedMeters, completedAt }
//   timer = null | { kind: 'rest', startedAt, durationMs } | { kind: 'work', key, startedAt, startDistance }
//
// A work timer only ever covers the chunk since it was last started; pausing
// folds that chunk into the entry (elapsedMs / trackedMeters). That's what lets
// a run pause, or a different step be timed in between, without losing time.
// GPS fixes are only recorded while a GPS cardio step's work timer runs.

import { appendFix, emptyTrack, startSegment, trackStats } from './geo.js';
import { expandBlocks, normalizeBlock, planWithActuals, stepTargetMeters, stepTargetSeconds } from './plans.js';
import { dateKey, lastSessionFor } from './utils.js';

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const DEFAULT_SESSION_SETTINGS = { sound: true, voice: false };

// Steps are derived from blocks rather than stored, so a restored session
// always agrees with the current expansion rules. Memoised on the blocks array.
const stepCache = new WeakMap();
export function sessionSteps(state) {
  if (!stepCache.has(state.blocks)) stepCache.set(state.blocks, expandBlocks(state.blocks));
  return stepCache.get(state.blocks);
}
const stepFor = (state, key) => sessionSteps(state).find((step) => step.key === key);

export function createSession({ plan = {}, blocks, now, workouts = [], settings = {} }) {
  const normalized = (blocks ?? plan.blocks ?? []).map(normalizeBlock);
  const state = {
    version: 1,
    planId: plan.id ?? null,
    name: plan.name ?? 'Workout',
    startedAt: now,
    blocks: normalized,
    entries: {},
    currentKey: null,
    timer: null,
    track: emptyTrack(),
    cue: null,
    settings: { ...DEFAULT_SESSION_SETTINGS, ...settings }
  };
  const steps = sessionSteps(state);
  state.entries = prefillFromHistory(steps, workouts);
  state.currentKey = steps[0]?.key ?? null;
  return state;
}

// A plan with no weight set picks up where the last session of that exercise
// left off (set by set), the same way the workout editor's "Repeat" does.
export function prefillFromHistory(steps = [], workouts = [], today = dateKey()) {
  const entries = {};
  const seen = new Map();
  for (const step of steps) {
    if (step.type !== 'exercise' || step.exerciseId == null || num(step.targetWeight) > 0) continue;
    const id = String(step.exerciseId);
    if (!seen.has(id)) seen.set(id, { index: 0, last: lastSessionFor(workouts, id, { beforeDate: today }) });
    const history = seen.get(id);
    const set = history.last?.sets[Math.min(history.index, history.last.sets.length - 1)];
    history.index += 1;
    if (set && num(set.weight) > 0) entries[step.key] = { status: 'pending', weight: num(set.weight) };
  }
  return entries;
}

export const entryFor = (state, key) => state.entries[key] ?? { status: 'pending' };
const isPending = (state, key) => entryFor(state, key).status === 'pending';

// Target values merged with anything the user has typed or tracked.
export function stepValues(state, step, now = state.startedAt) {
  const entry = entryFor(state, step.key);
  const running = state.timer?.kind === 'work' && state.timer.key === step.key;
  const elapsedMs = num(entry.elapsedMs) + (running ? Math.max(0, now - state.timer.startedAt) : 0);
  const trackedMeters = num(entry.trackedMeters) + (running && step.gps ? Math.max(0, state.track.distance - state.timer.startDistance) : 0);
  return {
    status: entry.status,
    reps: entry.reps ?? step.targetReps ?? null,
    weight: entry.weight ?? step.targetWeight ?? 0,
    rpe: entry.rpe ?? null,
    seconds: entry.seconds ?? (elapsedMs > 0 ? Math.round(elapsedMs / 1000) : stepTargetSeconds(step)),
    meters: entry.meters ?? (step.gps && (elapsedMs > 0 || trackedMeters > 0) ? Math.round(trackedMeters) : stepTargetMeters(step)),
    elapsedMs,
    trackedMeters,
    running,
    started: elapsedMs > 0 || running
  };
}

export function remainingMs(state, now) {
  const { timer } = state;
  if (!timer) return null;
  if (timer.kind === 'rest') return Math.max(0, timer.durationMs - (now - timer.startedAt));
  const step = stepFor(state, timer.key);
  const target = step ? stepTargetSeconds(step) : null;
  return target == null ? null : Math.max(0, target * 1000 - stepValues(state, step, now).elapsedMs);
}

export function nextPendingKey(state, afterKey) {
  const steps = sessionSteps(state);
  const from = steps.findIndex((step) => step.key === afterKey);
  const after = steps.slice(from + 1).find((step) => isPending(state, step.key));
  return (after ?? steps.find((step) => step.key !== afterKey && isPending(state, step.key)))?.key ?? null;
}

export const isRecording = (state) => {
  if (state.timer?.kind !== 'work') return false;
  const step = stepFor(state, state.timer.key);
  return Boolean(step?.type === 'cardio' && step.gps);
};

const setEntry = (state, key, patch) => ({ ...state, entries: { ...state.entries, [key]: { ...entryFor(state, key), ...patch } } });

function foldTimer(state, now) {
  const { timer } = state;
  if (timer?.kind !== 'work') return { ...state, timer: null };
  const entry = entryFor(state, timer.key);
  const step = stepFor(state, timer.key);
  return {
    ...setEntry(state, timer.key, {
      elapsedMs: num(entry.elapsedMs) + Math.max(0, now - timer.startedAt),
      trackedMeters: num(entry.trackedMeters) + (step?.gps ? Math.max(0, state.track.distance - timer.startDistance) : 0)
    }),
    timer: null
  };
}

function startWork(state, key, now) {
  const step = stepFor(state, key);
  if (!step || stepTargetSeconds(step) == null && step.type === 'exercise' && step.measure !== 'time') return state;
  const folded = state.timer ? foldTimer(state, now) : state;
  const track = step.type === 'cardio' && step.gps ? startSegment(folded.track) : folded.track;
  return { ...folded, track, currentKey: key, timer: { kind: 'work', key, startedAt: now, startDistance: track.distance } };
}

function complete(state, key, now, { auto = false } = {}) {
  const step = stepFor(state, key);
  if (!step) return state;
  let next = state.timer?.kind === 'work' && state.timer.key === key ? foldTimer(state, now) : state;
  const values = stepValues(next, step, now);
  next = setEntry(next, key, {
    status: 'done',
    completedAt: now,
    reps: values.reps,
    weight: values.weight,
    // A timed step that ran to the end records its target exactly, not the
    // few extra milliseconds the tick took to notice.
    seconds: auto && stepTargetSeconds(step) != null && entryFor(state, key).seconds == null ? stepTargetSeconds(step) : values.seconds,
    meters: values.meters
  });
  if (next.timer?.kind === 'rest') next = { ...next, timer: null };
  const upcomingKey = nextPendingKey(next, key);
  next = { ...next, currentKey: upcomingKey, cue: { type: upcomingKey ? 'done' : 'finished', key, next: upcomingKey, at: now, auto } };
  if (!upcomingKey) return next;
  const upcoming = stepFor(next, upcomingKey);
  if (step.restAfter > 0 && upcoming.type !== 'rest' && !(next.timer?.kind === 'work')) {
    return { ...next, timer: { kind: 'rest', startedAt: now, durationMs: step.restAfter * 1000 } };
  }
  if (!next.timer && (upcoming.type === 'rest' || (upcoming.autoStart && hasOwnClock(upcoming)))) return startWork(next, upcomingKey, now);
  return next;
}

// Steps that finish by themselves (time/distance) or at least keep a clock (cardio).
const hasOwnClock = (step) => step.type !== 'exercise' || step.measure === 'time';

function advanceClock(state, now) {
  let current = state;
  // A phone that slept through several short intervals catches up in order,
  // each finishing at the moment it really ended.
  for (let guard = 0; guard < 200; guard += 1) {
    const { timer } = current;
    if (!timer) return current;
    if (timer.kind === 'rest') {
      const endsAt = timer.startedAt + timer.durationMs;
      if (now < endsAt) return current;
      const upcoming = current.currentKey ? stepFor(current, current.currentKey) : null;
      current = { ...current, timer: null, cue: { type: 'restOver', next: current.currentKey, at: endsAt } };
      if (upcoming && (upcoming.type === 'rest' || (upcoming.autoStart && hasOwnClock(upcoming))) && isPending(current, upcoming.key)) {
        current = startWork(current, upcoming.key, endsAt);
      }
      continue;
    }
    const step = stepFor(current, timer.key);
    if (!step) return { ...current, timer: null };
    const remaining = remainingMs(current, now);
    const targetMeters = stepTargetMeters(step);
    if (remaining != null && remaining <= 0) {
      const endedAt = now - (stepValues(current, step, now).elapsedMs - stepTargetSeconds(step) * 1000);
      current = complete(current, step.key, Math.min(now, Math.max(timer.startedAt, endedAt)), { auto: true });
      continue;
    }
    if (targetMeters != null && step.gps && stepValues(current, step, now).trackedMeters >= targetMeters) {
      current = complete(current, step.key, now, { auto: true });
      continue;
    }
    return current;
  }
  return current;
}

export function sessionReducer(state, action) {
  const now = action.now;
  switch (action.type) {
    case 'tick':
      return advanceClock(state, now);
    case 'fix': {
      if (!isRecording(state)) return state;
      const track = appendFix(state.track, action.fix);
      return track === state.track ? state : advanceClock({ ...state, track }, now);
    }
    case 'edit':
      return setEntry(state, action.key, action.patch);
    case 'complete':
      return complete(state, action.key, now);
    case 'uncomplete': {
      const entry = entryFor(state, action.key);
      if (entry.status === 'pending') return state;
      return { ...setEntry(state, action.key, { status: 'pending', completedAt: null }), currentKey: action.key, timer: state.timer?.kind === 'rest' ? null : state.timer };
    }
    case 'skip': {
      let next = state.timer?.kind === 'work' && state.timer.key === action.key ? foldTimer(state, now) : state;
      next = setEntry(next, action.key, { status: 'skipped', completedAt: now });
      if (next.timer?.kind === 'rest') next = { ...next, timer: null };
      return { ...next, currentKey: nextPendingKey(next, action.key) };
    }
    case 'select':
      // Looking at another step never pauses a running one (tapping ahead
      // mid-interval shouldn't stop the rep); starting it does.
      return stepFor(state, action.key) ? { ...state, currentKey: action.key } : state;
    case 'start':
      return startWork(state, action.key ?? state.currentKey, now);
    case 'pause':
      return state.timer?.kind === 'work' ? foldTimer(state, now) : state;
    case 'skipRest':
      return state.timer?.kind === 'rest' ? advanceClock({ ...state, timer: { ...state.timer, durationMs: now - state.timer.startedAt } }, now) : state;
    case 'adjustRest': {
      if (state.timer?.kind !== 'rest') return state;
      const durationMs = Math.max(0, state.timer.durationMs + action.deltaMs);
      return advanceClock({ ...state, timer: { ...state.timer, durationMs } }, now);
    }
    case 'restartRest':
      return { ...state, timer: { kind: 'rest', startedAt: now, durationMs: action.seconds * 1000 } };
    case 'addBlock': {
      const blocks = [...state.blocks, normalizeBlock(action.block, state.blocks.length)];
      const added = expandBlocks(blocks).filter((step) => step.blockIndex === state.blocks.length);
      const next = { ...state, blocks, entries: { ...prefillFromHistory(added, action.workouts ?? []), ...state.entries } };
      return next.currentKey ? next : { ...next, currentKey: added[0]?.key ?? null };
    }
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    default:
      return state;
  }
}

// After a reload the app wasn't running, so nothing may have "happened" in
// the gap: a work timer is paused at the moment the session was last saved,
// and a rest that ran out doesn't auto-start the next step (that would replay
// a whole circuit the user never did).
export function resumeSession(saved, now) {
  const { id: _id, savedAt, ...state } = saved;
  if (state.timer?.kind === 'work') return { ...foldTimer(state, Math.min(now, savedAt ?? now)), cue: null };
  if (state.timer?.kind === 'rest' && now >= state.timer.startedAt + state.timer.durationMs) return { ...state, timer: null, cue: null };
  return { ...state, cue: null };
}

export function sessionProgress(state) {
  const steps = sessionSteps(state);
  const done = steps.filter((step) => entryFor(state, step.key).status === 'done').length;
  const skipped = steps.filter((step) => entryFor(state, step.key).status === 'skipped').length;
  return { done, skipped, total: steps.length, pending: steps.length - done - skipped };
}

// ---- Saving ----

const round1 = (value) => Math.round(num(value) * 10) / 10;

// The frozen record: only completed steps, with what was actually done.
export function sessionToWorkout(state, { now }) {
  const steps = sessionSteps(state);
  const done = steps.filter((step) => entryFor(state, step.key).status === 'done');
  const sets = done.filter((step) => step.type === 'exercise' && step.exerciseId != null).map((step) => {
    const entry = entryFor(state, step.key);
    return step.measure === 'time'
      ? { exerciseId: step.exerciseId, reps: 0, seconds: Math.max(1, Math.round(num(entry.seconds))), weight: num(entry.weight), rpe: entry.rpe ?? null }
      : { exerciseId: step.exerciseId, reps: Math.round(num(entry.reps)), weight: num(entry.weight), rpe: entry.rpe ?? null };
  }).filter((set) => set.reps > 0 || set.seconds > 0);
  const cardio = done.filter((step) => step.type === 'cardio').map((step) => {
    const entry = entryFor(state, step.key);
    return {
      activity: step.activity,
      label: step.label ?? '',
      intensity: step.intensity ?? null,
      seconds: Math.round(num(entry.seconds)),
      meters: Math.round(num(entry.meters)),
      gps: step.gps,
      blockKind: step.blockKind
    };
  });
  const hasTrack = state.track.segments.some((segment) => segment.length > 1);
  const stats = hasTrack ? trackStats(state.track.segments) : null;
  const routeId = steps.find((step) => step.routeId != null)?.routeId ?? null;
  return {
    workout: {
      date: dateKey(new Date(state.startedAt)),
      name: state.name,
      planId: state.planId,
      startedAt: new Date(state.startedAt).toISOString(),
      durationSeconds: Math.max(0, Math.round((now - state.startedAt) / 1000)),
      sets,
      cardio,
      distance: cardio.reduce((sum, item) => sum + item.meters, 0),
      ...(stats ? { movingSeconds: stats.movingSeconds, elevationGain: stats.elevationGain } : {}),
      routeId
    },
    track: hasTrack ? { segments: state.track.segments, activity: cardio.find((item) => item.gps)?.activity ?? 'run' } : null
  };
}

export function sessionTotals(state) {
  const steps = sessionSteps(state);
  let volume = 0;
  let sets = 0;
  let meters = 0;
  let cardioSeconds = 0;
  for (const step of steps) {
    const entry = entryFor(state, step.key);
    if (entry.status !== 'done') continue;
    if (step.type === 'exercise') {
      sets += 1;
      volume += num(entry.reps) * num(entry.weight);
    } else if (step.type === 'cardio') {
      meters += num(entry.meters);
      cardioSeconds += num(entry.seconds);
    }
  }
  return { sets, volume: round1(volume), meters: Math.round(meters), cardioSeconds: Math.round(cardioSeconds) };
}

export const sessionPlanUpdate = (state) => planWithActuals(state.blocks, sessionSteps(state), state.entries);
