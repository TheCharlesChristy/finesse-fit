import { describe, expect, it } from 'vitest';
import { estimatePlanSeconds, expandBlocks, normalizePlan, planCounts, planHasGps, planWithActuals, stepTargetMeters, stepTargetSeconds } from '../plans.js';

describe('normalizePlan', () => {
  it('turns a legacy { sets } template into exercise blocks', () => {
    const plan = normalizePlan({ name: 'Push', sets: [
      { exerciseId: 'seed:bench', reps: 8, weight: 60 },
      { exerciseId: 'seed:bench', reps: 8, weight: 60 },
      { exerciseId: 'seed:bench', reps: 6, weight: 65 },
      { exerciseId: 'seed:ohp', reps: 10, weight: 30 }
    ] });
    expect(plan.sets).toBeUndefined();
    expect(plan.blocks.map((block) => [block.exerciseId, block.sets, block.reps, block.weight])).toEqual([
      ['seed:bench', 2, 8, 60],
      ['seed:bench', 1, 6, 65],
      ['seed:ohp', 1, 10, 30]
    ]);
  });

  it('fills sensible defaults and keeps ids', () => {
    const plan = normalizePlan({ blocks: [{ id: 'x', kind: 'intervals' }, { kind: 'cardio', activity: 'row' }] });
    expect(plan.name).toBe('Workout');
    expect(plan.blocks[0]).toMatchObject({ id: 'x', repeats: 6, gps: true, work: { goal: { type: 'distance', meters: 400 } }, recover: { mode: 'jog', goal: { type: 'time', seconds: 90 } } });
    expect(plan.blocks[1]).toMatchObject({ id: 'b1', gps: false, goal: { type: 'open' } });
  });
});

describe('expandBlocks', () => {
  it('expands sets, carrying the rest after each', () => {
    const steps = expandBlocks([{ kind: 'exercise', exerciseId: 'a', sets: 3, reps: 5, weight: 100, restSeconds: 120 }]);
    expect(steps.map((step) => step.key)).toEqual(['b0.s0', 'b0.s1', 'b0.s2']);
    expect(steps[2]).toMatchObject({ setNumber: 3, setCount: 3, targetReps: 5, targetWeight: 100, restAfter: 120, targetSeconds: null });
  });

  it('expands a circuit round by round with the round rest after the last item', () => {
    const steps = expandBlocks([{ kind: 'circuit', rounds: 2, restBetweenRounds: 60, items: [
      { exerciseId: 'burpee', measure: 'time', seconds: 40, restSeconds: 20 },
      { exerciseId: 'plank', measure: 'time', seconds: 30, restSeconds: 20 }
    ] }]);
    expect(steps.map((step) => `${step.key}:${step.restAfter}`)).toEqual(['b0.r0.i0:20', 'b0.r0.i1:60', 'b0.r1.i0:20', 'b0.r1.i1:60']);
    expect(steps.every((step) => step.autoStart)).toBe(true);
    expect(stepTargetSeconds(steps[0])).toBe(40);
  });

  it('expands intervals without a recovery after the final rep', () => {
    const steps = expandBlocks([{ kind: 'intervals', repeats: 3, work: { goal: { type: 'distance', meters: 400 } }, recover: { goal: { type: 'time', seconds: 90 }, mode: 'jog' } }]);
    expect(steps.map((step) => step.key)).toEqual(['b0.r0.work', 'b0.r0.recover', 'b0.r1.work', 'b0.r1.recover', 'b0.r2.work']);
    expect(stepTargetMeters(steps[0])).toBe(400);
    expect(steps[1]).toMatchObject({ type: 'cardio', intensity: 'recovery', gps: true });
  });

  it('makes a standing recovery a rest step', () => {
    const steps = expandBlocks([{ kind: 'intervals', repeats: 2, recover: { goal: { type: 'time', seconds: 60 }, mode: 'rest' } }]);
    expect(steps[1]).toMatchObject({ type: 'rest', targetSeconds: 60 });
  });
});

describe('plan summaries', () => {
  const blocks = [
    { kind: 'cardio', activity: 'run', goal: { type: 'time', seconds: 600 } },
    { kind: 'exercise', exerciseId: 'a', sets: 2, reps: 10, restSeconds: 60 },
    { kind: 'rest', seconds: 120 },
    { kind: 'cardio', activity: 'run', goal: { type: 'distance', meters: 1000 } }
  ];

  it('estimates duration, leaving out the rest after the final step', () => {
    // 600 + (45+60)*2 + 120 + 1000*0.36
    expect(estimatePlanSeconds(blocks)).toBe(600 + 210 + 120 + 360);
  });

  it('counts exercises, sets and GPS use', () => {
    expect(planCounts(blocks)).toEqual({ exercises: 1, sets: 2, cardio: 2, steps: 5 });
    expect(planHasGps(blocks)).toBe(true);
    expect(planHasGps([{ kind: 'exercise', exerciseId: 'a' }])).toBe(false);
  });
});

describe('planWithActuals', () => {
  it('moves exercise targets to the best completed set, leaving cardio goals alone', () => {
    const blocks = [
      { kind: 'exercise', exerciseId: 'a', sets: 3, reps: 8, weight: 60 },
      { kind: 'circuit', rounds: 2, items: [{ exerciseId: 'b', measure: 'time', seconds: 30 }, { exerciseId: 'c', reps: 10 }] },
      { kind: 'cardio', goal: { type: 'distance', meters: 5000 } }
    ];
    const steps = expandBlocks(blocks);
    const entries = {
      'b0.s0': { status: 'done', reps: 8, weight: 62.5 },
      'b0.s1': { status: 'done', reps: 9, weight: 62.5 },
      'b0.s2': { status: 'skipped', reps: 12, weight: 80 },
      'b1.r0.i0': { status: 'done', seconds: 45, weight: 0 },
      b2: { status: 'done', meters: 3000 }
    };
    const next = planWithActuals(blocks, steps, entries);
    expect(next[0]).toMatchObject({ weight: 62.5, reps: 9, sets: 3 });
    expect(next[1].items[0]).toMatchObject({ seconds: 45 });
    expect(next[1].items[1]).toMatchObject({ reps: 10 });
    expect(next[2].goal.meters).toBe(5000);
  });
});
