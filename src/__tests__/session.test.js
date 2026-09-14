import { describe, expect, it } from 'vitest';
import {
  createSession, entryFor, isRecording, nextPendingKey, prefillFromHistory, remainingMs, resumeSession, sessionPlanUpdate,
  sessionProgress, sessionReducer, sessionSteps, sessionToWorkout, stepValues
} from '../session.js';

const T0 = 1_700_000_000_000;
const sec = (s) => T0 + s * 1000;
const METERS_PER_DEG_LAT = 111_195;
const fixAt = (meters, s) => [51.5 + meters / METERS_PER_DEG_LAT, -0.12, sec(s), 5, null];

const play = (state, actions) => actions.reduce(sessionReducer, state);

const STRENGTH = { id: 7, name: 'Push', blocks: [
  { kind: 'exercise', exerciseId: 'bench', sets: 2, reps: 8, weight: 60, restSeconds: 90 },
  { kind: 'exercise', exerciseId: 'plank', measure: 'time', sets: 1, seconds: 45, restSeconds: 30 }
] };

describe('ticking off strength sets', () => {
  it('starts on the first step with plan targets as values', () => {
    const state = createSession({ plan: STRENGTH, now: T0 });
    expect(state.currentKey).toBe('b0.s0');
    expect(stepValues(state, sessionSteps(state)[0])).toMatchObject({ reps: 8, weight: 60 });
  });

  it('completing a set records edited values, moves on and starts the rest timer', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [
      { type: 'edit', key: 'b0.s0', patch: { reps: 10, weight: 62.5 } },
      { type: 'complete', key: 'b0.s0', now: sec(30) }
    ]);
    expect(entryFor(state, 'b0.s0')).toMatchObject({ status: 'done', reps: 10, weight: 62.5 });
    expect(state.currentKey).toBe('b0.s1');
    expect(state.timer).toMatchObject({ kind: 'rest', durationMs: 90_000 });
    expect(remainingMs(state, sec(60))).toBe(60_000);
  });

  it('rest ends on a tick and waits for a reps-based set rather than auto-starting', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [{ type: 'complete', key: 'b0.s0', now: sec(30) }, { type: 'tick', now: sec(125) }]);
    expect(state.timer).toBeNull();
    expect(state.cue).toMatchObject({ type: 'restOver', next: 'b0.s1' });
  });

  it('rest can be extended, shortened and skipped', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [{ type: 'complete', key: 'b0.s0', now: sec(0) }, { type: 'adjustRest', deltaMs: 15_000, now: sec(10) }]);
    expect(remainingMs(state, sec(10))).toBe(95_000);
    state = sessionReducer(state, { type: 'skipRest', now: sec(20) });
    expect(state.timer).toBeNull();
  });

  it('ticking steps out of order is fine, and unticking brings a step back', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [{ type: 'complete', key: 'b0.s1', now: sec(10) }]);
    expect(state.currentKey).toBe('b1.s0');
    expect(nextPendingKey(state, 'b1.s0')).toBe('b0.s0'); // wraps round to the skipped-over set
    state = sessionReducer(state, { type: 'uncomplete', key: 'b0.s1', now: sec(12) });
    expect(entryFor(state, 'b0.s1').status).toBe('pending');
    expect(state.currentKey).toBe('b0.s1');
    expect(sessionProgress(state)).toMatchObject({ done: 0, pending: 3 });
  });

  it('a timed exercise counts down and completes itself at exactly its target', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [
      { type: 'complete', key: 'b0.s0', now: sec(0) },
      { type: 'complete', key: 'b0.s1', now: sec(100) },
      { type: 'skipRest', now: sec(101) },
      { type: 'start', key: 'b1.s0', now: sec(110) },
      { type: 'tick', now: sec(140) }
    ]);
    expect(remainingMs(state, sec(140))).toBe(15_000);
    state = sessionReducer(state, { type: 'tick', now: sec(157.3) });
    expect(entryFor(state, 'b1.s0')).toMatchObject({ status: 'done', seconds: 45 });
    expect(state.cue.type).toBe('finished');
  });

  it('pausing keeps elapsed time for when the step resumes', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [
      { type: 'start', key: 'b1.s0', now: sec(0) },
      { type: 'pause', now: sec(20) },
      { type: 'tick', now: sec(500) }
    ]);
    expect(entryFor(state, 'b1.s0').status).toBe('pending');
    state = play(state, [{ type: 'start', key: 'b1.s0', now: sec(600) }]);
    expect(remainingMs(state, sec(610))).toBe(15_000);
  });

  it('refuses to put a stopwatch on a reps-based set', () => {
    const state = createSession({ plan: STRENGTH, now: T0 });
    expect(sessionReducer(state, { type: 'start', key: 'b0.s0', now: sec(1) }).timer).toBeNull();
  });
});

describe('circuits and intervals flow by themselves', () => {
  const HIIT = { name: 'HIIT', blocks: [{ kind: 'circuit', rounds: 2, restBetweenRounds: 30, items: [
    { exerciseId: 'burpee', measure: 'time', seconds: 40, restSeconds: 20 },
    { exerciseId: 'climber', measure: 'time', seconds: 40, restSeconds: 20 }
  ] }] };

  it('work → rest → next work chains without taps, catching up after the phone sleeps', () => {
    let state = createSession({ plan: HIIT, now: T0 });
    state = sessionReducer(state, { type: 'start', now: sec(0) });
    // 40 on, 20 off, 40 on, 30 round rest, 40 on, 20 off → the 4th item started at 190 s.
    state = sessionReducer(state, { type: 'tick', now: sec(195) });
    expect(sessionProgress(state).done).toBe(3);
    expect(state.timer).toMatchObject({ kind: 'work', key: 'b0.r1.i1', startedAt: sec(190) });
    expect(sessionSteps(state).filter((s) => entryFor(state, s.key).status === 'done').map((s) => entryFor(state, s.key).seconds)).toEqual([40, 40, 40]);
  });

  const INTERVALS = { name: 'Intervals', blocks: [{ kind: 'intervals', activity: 'run', repeats: 2, work: { goal: { type: 'distance', meters: 200 } }, recover: { goal: { type: 'time', seconds: 60 }, mode: 'jog' } }] };

  it('records GPS only while a GPS step runs, and a distance goal completes itself', () => {
    let state = createSession({ plan: INTERVALS, now: T0 });
    expect(isRecording(state)).toBe(false);
    expect(sessionReducer(state, { type: 'fix', fix: fixAt(0, 0), now: sec(0) })).toBe(state);

    state = sessionReducer(state, { type: 'start', now: sec(0) });
    expect(isRecording(state)).toBe(true);
    for (let s = 0; s <= 60; s += 1) state = sessionReducer(state, { type: 'fix', fix: fixAt(s * 4, s), now: sec(s) });

    // 200 m at 4 m/s → rep 1 done at ~50 s, jog recovery running.
    expect(entryFor(state, 'b0.r0.work')).toMatchObject({ status: 'done' });
    expect(entryFor(state, 'b0.r0.work').meters).toBeGreaterThanOrEqual(200);
    expect(state.timer).toMatchObject({ kind: 'work', key: 'b0.r0.recover' });
    expect(state.track.segments).toHaveLength(2); // a fresh segment per started step
  });

  it('saves the run with per-rep cardio and the GPS track', () => {
    let state = createSession({ plan: INTERVALS, now: T0 });
    state = sessionReducer(state, { type: 'start', now: sec(0) });
    for (let s = 0; s <= 200; s += 1) state = play(state, [{ type: 'fix', fix: fixAt(s * 4, s), now: sec(s) }, { type: 'tick', now: sec(s) }]);
    expect(sessionProgress(state)).toMatchObject({ done: 3, pending: 0 });

    const { workout, track } = sessionToWorkout(state, { now: sec(240) });
    expect(workout).toMatchObject({ name: 'Intervals', durationSeconds: 240, sets: [] });
    expect(workout.cardio.map((c) => c.intensity)).toEqual(['hard', 'recovery', 'hard']);
    expect(workout.cardio[1].seconds).toBe(60);
    expect(workout.distance).toBeGreaterThan(600);
    expect(track.segments.length).toBeGreaterThanOrEqual(3);
  });
});

describe('saving and resuming', () => {
  it('only completed steps reach the workout, timed sets keep their seconds', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [
      { type: 'complete', key: 'b0.s0', now: sec(10) },
      { type: 'skip', key: 'b0.s1', now: sec(20) },
      { type: 'complete', key: 'b1.s0', now: sec(30) }
    ]);
    const { workout, track } = sessionToWorkout(state, { now: sec(1800) });
    expect(workout.sets).toEqual([
      { exerciseId: 'bench', reps: 8, weight: 60, rpe: null },
      { exerciseId: 'plank', reps: 0, seconds: 45, weight: 0, rpe: null }
    ]);
    expect(workout).toMatchObject({ planId: 7, durationSeconds: 1800, distance: 0 });
    expect(track).toBeNull();
  });

  it('a reload pauses a running step at the last save instead of counting the gap', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = sessionReducer(state, { type: 'start', key: 'b1.s0', now: sec(0) });
    const resumed = resumeSession({ ...state, id: 1, savedAt: sec(10) }, sec(3600));
    expect(resumed.timer).toBeNull();
    expect(entryFor(resumed, 'b1.s0')).toMatchObject({ status: 'pending', elapsedMs: 10_000 });
  });

  it('a reload after a finished rest does not auto-run the following steps', () => {
    let state = createSession({ plan: { blocks: [{ kind: 'circuit', rounds: 3, items: [{ exerciseId: 'a', measure: 'time', seconds: 20, restSeconds: 10 }] }] }, now: T0 });
    state = play(state, [{ type: 'start', now: sec(0) }, { type: 'tick', now: sec(21) }]);
    expect(state.timer.kind).toBe('rest');
    const resumed = resumeSession({ ...state, savedAt: sec(21) }, sec(900));
    expect(resumed.timer).toBeNull();
    expect(sessionProgress(resumed).done).toBe(1);
  });

  it('prefills weights from the last session when the plan has none', () => {
    const plan = { blocks: [{ kind: 'exercise', exerciseId: 'row', sets: 3, reps: 10 }] };
    const workouts = [{ id: 1, date: '2026-01-02', sets: [{ exerciseId: 'row', reps: 10, weight: 50 }, { exerciseId: 'row', reps: 8, weight: 55 }] }];
    const entries = prefillFromHistory(sessionSteps(createSession({ plan, now: T0 })), workouts, '2026-01-05');
    expect([entries['b0.s0'].weight, entries['b0.s1'].weight, entries['b0.s2'].weight]).toEqual([50, 55, 55]);
  });

  it('adding an exercise mid-session appends steps without disturbing existing keys', () => {
    let state = createSession({ plan: STRENGTH, now: T0 });
    state = play(state, [{ type: 'complete', key: 'b0.s0', now: sec(1) }, { type: 'addBlock', block: { kind: 'exercise', exerciseId: 'dips', sets: 2, reps: 12 }, now: sec(2) }]);
    expect(sessionSteps(state).map((step) => step.key).slice(-2)).toEqual(['b2.s0', 'b2.s1']);
    expect(entryFor(state, 'b0.s0').status).toBe('done');
    expect(sessionPlanUpdate(state)).toHaveLength(3);
  });

  it('an exercise added mid-session picks up last session\'s weights too', () => {
    const workouts = [{ id: 1, date: '2026-01-02', sets: [{ exerciseId: 'dips', reps: 10, weight: 15 }] }];
    const state = sessionReducer(createSession({ plan: STRENGTH, now: T0 }), { type: 'addBlock', block: { kind: 'exercise', exerciseId: 'dips', sets: 2, reps: 10 }, workouts, now: sec(1) });
    expect(stepValues(state, sessionSteps(state).find((step) => step.key === 'b2.s1')).weight).toBe(15);
  });
});
