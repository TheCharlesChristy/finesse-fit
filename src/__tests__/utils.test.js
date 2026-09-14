import { describe, expect, it } from 'vitest';
import {
  addTotals, applyProgression, attributeVolume, backupReminder, bestE1rmByExercise, bestSetsByDate,
  buildAiContext, calculateNutritionTargets, dateKey, estimateOneRepMax, estimateTdee, fmtDuration, fmtRelativeDay,
  fmtWeight, findPersonalRecords, fromDisplayHeight, fromDisplayWeight, fromFeetInches, goalEta,
  goalProgress, groupLogsByMeal, hitsTarget, lastNDays, lastSessionFor, lastTrainedByMuscle,
  mealForTime, neglectedMuscles, normalizeBodyCompositionTargets, normalizeGoalMix, percent, personalRecordsByWorkout, retargetCalories,
  round, scaleNutrition, setLoad, setVolume, shiftDay, shiftWeekKey, snoozeUntil, suggestProgression,
  summariseSets, toDisplayHeight, toDisplayWeight, toFeetInches, weekDays, weekKey, weekLabel,
  weightRatePerWeek, weightTrend
} from '../utils.js';

const isoDaysAgo = (n, from = new Date('2026-09-14')) => dateKey(new Date(from.getTime() - n * 86_400_000));

describe('round', () => {
  it('rounds to the given number of places', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(2.5, 0)).toBe(3);
  });
  it('treats non-numbers as 0', () => {
    expect(round(undefined)).toBe(0);
    expect(round('abc')).toBe(0);
  });
});

describe('dateKey / weekKey / shiftWeekKey / weekDays / weekLabel', () => {
  it('is idempotent on an already-short date string', () => {
    expect(dateKey('2026-09-14')).toBe('2026-09-14');
  });
  it('extracts the date from an ISO timestamp', () => {
    expect(dateKey('2026-09-14T18:30:00Z')).toBe('2026-09-14');
  });
  it('keys by ISO week, not calendar week', () => {
    // 2026-09-14 is a Monday, so it starts ISO week 38.
    expect(weekKey('2026-09-14')).toBe('2026-W38');
    expect(weekKey('2026-09-20')).toBe('2026-W38');
  });
  it('shifts across a year boundary correctly', () => {
    // 2025 has 52 ISO weeks (31 Dec 2025 is already in 2026's week 1), so the
    // week before 2026-W01 is 2025's last one, W52 — not a guessed W53.
    expect(shiftWeekKey('2026-W01', -1)).toBe('2025-W52');
  });
  it('round-trips shiftWeekKey with weekDays/weekKey', () => {
    const next = shiftWeekKey('2026-W38', 2);
    const monday = weekDays(next)[0];
    expect(weekKey(monday)).toBe(next);
  });
  it('weekDays returns 7 consecutive days starting Monday', () => {
    const days = weekDays('2026-W38');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-09-14');
    expect(days[6]).toBe('2026-09-20');
  });
  it('weekLabel spans Monday to Sunday', () => {
    expect(weekLabel('2026-W38')).toBe('14 Sep – 20 Sep');
  });
});

describe('lastNDays / shiftDay / fmtRelativeDay', () => {
  it('returns n days ending on `from`, oldest first', () => {
    const days = lastNDays(3, new Date('2026-09-14T12:00:00'));
    expect(days).toEqual(['2026-09-12', '2026-09-13', '2026-09-14']);
  });
  it('shiftDay moves forward and backward', () => {
    expect(shiftDay('2026-09-14', -1)).toBe('2026-09-13');
    expect(shiftDay('2026-09-14', 1)).toBe('2026-09-15');
  });
  it('fmtRelativeDay labels today and yesterday, formats everything else', () => {
    expect(fmtRelativeDay('2026-09-14', '2026-09-14')).toBe('Today');
    expect(fmtRelativeDay('2026-09-13', '2026-09-14')).toBe('Yesterday');
    expect(fmtRelativeDay('2026-09-01', '2026-09-14')).not.toMatch(/Today|Yesterday/);
  });
});

describe('mealForTime', () => {
  it('buckets the day into meals', () => {
    expect(mealForTime(new Date('2026-09-14T07:00:00'))).toBe('breakfast');
    expect(mealForTime(new Date('2026-09-14T12:30:00'))).toBe('lunch');
    expect(mealForTime(new Date('2026-09-14T19:00:00'))).toBe('dinner');
    expect(mealForTime(new Date('2026-09-14T23:00:00'))).toBe('snack');
  });
});

describe('scaleNutrition', () => {
  const food = { per100: { calories: 200, protein: 20, carbs: 10, fat: 5, fibre: 2, sugar: 1, salt: 0.5 }, servings: [{ grams: 150 }] };

  it('scales by grams directly', () => {
    expect(scaleNutrition(food, 100, 'g')).toMatchObject({ calories: 200, protein: 20 });
  });
  it('scales by servings using the food\'s serving size', () => {
    // 1.5 servings * 150 g = 225 g => 2x the per-100 figures.
    expect(scaleNutrition(food, 1.5, 'serving')).toMatchObject({ calories: 450, protein: 45 });
  });
  it('never returns negative amounts for a negative quantity', () => {
    expect(scaleNutrition(food, -50, 'g').calories).toBe(0);
  });
  it('returns all-zero totals for a food with no per100 data', () => {
    expect(scaleNutrition(null, 100, 'g')).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0, salt: 0 });
  });
});

describe('addTotals', () => {
  it('adds two totals together', () => {
    const a = { calories: 100, protein: 10, carbs: 5, fat: 2, fibre: 0, sugar: 0, salt: 0 };
    const b = { calories: 50, protein: 5, carbs: 2, fat: 1, fibre: 0, sugar: 0, salt: 0 };
    expect(addTotals(a, b, 1)).toMatchObject({ calories: 150, protein: 15 });
  });
  it('floors at zero rather than going negative (a delete after an edit must never leave a debt)', () => {
    const a = { calories: 100, protein: 10, carbs: 5, fat: 2, fibre: 0, sugar: 0, salt: 0 };
    const b = { calories: 999, protein: 999, carbs: 999, fat: 999, fibre: 0, sugar: 0, salt: 0 };
    expect(addTotals(a, b, -1)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0, salt: 0 });
  });
});

describe('setLoad / setVolume / attributeVolume', () => {
  it('a loaded lift\'s load is just the weight on the bar', () => {
    expect(setLoad({ weight: 80 }, { equipment: 'barbell' }, 78)) .toBe(80);
  });
  it('a bodyweight exercise adds the athlete\'s weight to whatever is loaded', () => {
    expect(setLoad({ weight: 10 }, { equipment: 'bodyweight' }, 78)).toBe(88);
    expect(setLoad({ weight: 0 }, { equipment: 'bodyweight' }, 78)).toBe(78);
  });
  it('volume is reps × load', () => {
    expect(setVolume({ reps: 8 }, 80)).toBe(640);
  });
  it('primary muscles get full volume, secondary get the secondary weight', () => {
    const exercise = { primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front_delts'] };
    const result = attributeVolume(exercise, 100);
    expect(result.chest).toBe(100);
    expect(result.triceps).toBe(50);
    expect(result.front_delts).toBe(50);
  });
  it('a muscle appearing as both primary and secondary across sets accumulates', () => {
    const result = attributeVolume({ primaryMuscles: ['chest', 'chest'], secondaryMuscles: [] }, 10);
    expect(result.chest).toBe(20);
  });
});

describe('estimateOneRepMax', () => {
  it('uses the Epley formula for multi-rep sets', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.3, 1);
  });
  it('a single rep is its own 1RM — Epley would overestimate it', () => {
    expect(estimateOneRepMax(150, 1)).toBe(150);
  });
  it('zero reps has no e1RM', () => {
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });
});

describe('bestSetsByDate / summariseSets / lastSessionFor / bestE1rmByExercise / findPersonalRecords / personalRecordsByWorkout', () => {
  const workouts = [
    { id: 1, date: '2026-09-01', sets: [{ exerciseId: 'bench', weight: 80, reps: 8 }, { exerciseId: 'bench', weight: 80, reps: 5 }] },
    { id: 2, date: '2026-09-08', sets: [{ exerciseId: 'bench', weight: 85, reps: 5 }] },
    { id: 3, date: '2026-09-15', sets: [{ exerciseId: 'bench', weight: 90, reps: 5 }, { exerciseId: 'squat', weight: 100, reps: 5 }] }
  ];

  it('bestSetsByDate keeps the best e1RM per day, sorted chronologically', () => {
    const rows = bestSetsByDate(workouts, 'bench');
    expect(rows.map((r) => r.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    // 80x8 (e1rm 101.3) beats 80x5 (e1rm 93.3) on the same day.
    expect(rows[0].weight).toBe(80);
    expect(rows[0].reps).toBe(8);
  });

  it('summariseSets groups by exercise and keeps the best set per group', () => {
    const groups = summariseSets(workouts[0].sets);
    expect(groups).toHaveLength(1);
    expect(groups[0].sets).toBe(2);
    expect(groups[0].best.reps).toBe(8);
  });

  it('lastSessionFor finds the most recent prior session for an exercise, excluding one workout', () => {
    const last = lastSessionFor(workouts, 'bench', { excludeId: 3 });
    expect(last.date).toBe('2026-09-08');
  });

  it('lastSessionFor respects beforeDate for "what was I doing at this point"', () => {
    const last = lastSessionFor(workouts, 'bench', { beforeDate: '2026-09-05' });
    expect(last.date).toBe('2026-09-01');
  });

  it('bestE1rmByExercise finds the best ever, and can exclude a workout being edited', () => {
    const best = bestE1rmByExercise(workouts);
    expect(best.get('bench')).toBeCloseTo(estimateOneRepMax(90, 5), 1); // 105
    // Excluding the 90kg workout, the best remaining is 80kg×8 (e1rm 101.3) —
    // still higher than 85kg×5 (e1rm 99.2), so more reps at less weight wins here.
    const withoutLatest = bestE1rmByExercise(workouts, { excludeId: 3 });
    expect(withoutLatest.get('bench')).toBeCloseTo(estimateOneRepMax(80, 8), 1);
  });

  it('findPersonalRecords only flags a set that beats history, and a first-ever log is not a PR', () => {
    const prs = findPersonalRecords(workouts.slice(0, 2), [{ exerciseId: 'bench', weight: 90, reps: 5 }], {});
    expect(prs).toHaveLength(1);
    expect(prs[0].exerciseId).toBe('bench');

    const firstEver = findPersonalRecords([], [{ exerciseId: 'bench', weight: 60, reps: 5 }], {});
    expect(firstEver).toHaveLength(0);
  });

  it('personalRecordsByWorkout replays history in date order and marks the workout that set each record', () => {
    const map = personalRecordsByWorkout(workouts);
    expect(map.has(1)).toBe(false); // nothing to beat on the first-ever log
    // Workout 2's 85kg×5 (e1rm 99.2) does NOT beat workout 1's 80kg×8 (e1rm
    // 101.3) — more reps at less weight can out-rank fewer reps at more.
    expect(map.has(2)).toBe(false);
    expect(map.get(3)?.has('bench')).toBe(true); // 90x5 (105) beats 101.3
  });
});

describe('unit conversion round-trips', () => {
  it('weight: kg <-> lb', () => {
    expect(toDisplayWeight(100, 'imperial')).toBeCloseTo(220.5, 1);
    expect(fromDisplayWeight(220.5, 'imperial')).toBeCloseTo(100, 1);
    expect(toDisplayWeight(100, 'metric')).toBe(100);
  });
  it('height: cm <-> ft/in, via the feet+inches helpers', () => {
    const { feet, inches } = toFeetInches(178);
    expect(feet).toBe(5);
    expect(inches).toBeCloseTo(10.1, 1);
    expect(fromFeetInches(feet, inches)).toBeCloseTo(178, 0);
  });
  it('height: cm <-> cm is a no-op, cm <-> in converts', () => {
    expect(toDisplayHeight(178, 'metric')).toBe(178);
    expect(fromDisplayHeight(toDisplayHeight(178, 'imperial'), 'imperial')).toBeCloseTo(178, 0);
  });
});

describe('calculateNutritionTargets', () => {
  it('produces sane positive targets for a typical profile', () => {
    const targets = calculateNutritionTargets({ height: 178, bodyweight: 78, goalMix: normalizeGoalMix({}) });
    expect(targets.calories).toBeGreaterThan(1500);
    expect(targets.protein).toBeGreaterThan(0);
    expect(targets.carbs).toBeGreaterThanOrEqual(80); // the function's own floor
    expect(targets.fat).toBeGreaterThan(0);
  });
  it('leaning further into muscle gain raises the calorie target', () => {
    const base = calculateNutritionTargets({ height: 178, bodyweight: 78, goalMix: { fatLoss: 0, muscleGain: 0, performance: 0, health: 100 } });
    const bulking = calculateNutritionTargets({ height: 178, bodyweight: 78, goalMix: { fatLoss: 0, muscleGain: 100, performance: 0, health: 0 } });
    expect(bulking.calories).toBeGreaterThan(base.calories);
  });
  it('clamps a goal mix to 0-100 and fills in defaults for missing keys', () => {
    expect(normalizeGoalMix({ fatLoss: -10, muscleGain: 500 })).toMatchObject({ fatLoss: 0, muscleGain: 100 });
  });
  it('uses direct body-composition targets to estimate a deficit or surplus', () => {
    const base = { height: 178, bodyweight: 78, targetBodyweight: 78, targetBodyFat: 20, goalMix: { performance: 45, health: 50 } };
    expect(calculateNutritionTargets({ ...base, targetBodyweight: 68 }).calories).toBeLessThan(calculateNutritionTargets(base).calories);
    expect(calculateNutritionTargets({ ...base, targetBodyweight: 88 }).calories).toBeGreaterThan(calculateNutritionTargets(base).calories);
    expect(calculateNutritionTargets({ ...base, targetBodyFat: 12 }).calories).toBeLessThan(calculateNutritionTargets(base).calories);
  });
  it('normalizes direct body-composition targets and defaults the weight to current weight', () => {
    expect(normalizeBodyCompositionTargets({ bodyweight: 82 })).toEqual({ targetBodyweight: 82, targetBodyFat: 20 });
    expect(normalizeBodyCompositionTargets({ bodyweight: 82, targetBodyweight: 20, targetBodyFat: 90 })).toEqual({ targetBodyweight: 35, targetBodyFat: 60 });
  });
});

describe('percent / hitsTarget', () => {
  it('percent handles a zero or missing target without dividing by zero', () => {
    expect(percent(50, 0)).toBe(0);
    expect(percent(50, null)).toBe(0);
  });
  it('percent caps display at 999% for a wildly over target', () => {
    expect(percent(100000, 1)).toBe(999);
  });
  it('protein is a floor: at or above target hits, below does not', () => {
    expect(hitsTarget('protein', 160, 150)).toBe(true);
    expect(hitsTarget('protein', 100, 150)).toBe(false);
  });
  it('calories/carbs/fat are a ±10% band', () => {
    expect(hitsTarget('calories', 2750, 2800)).toBe(true);
    expect(hitsTarget('calories', 3200, 2800)).toBe(false);
    expect(hitsTarget('calories', 2000, 2800)).toBe(false);
  });
});

describe('goalProgress', () => {
  const profile = { targets: { calories: 2000, protein: 150, carbs: 200, fat: 60 } };

  it('strength: current is the best e1RM ever for that exercise', () => {
    const goal = { type: 'strength', target: 100, exerciseId: 'bench' };
    // e1RM ≈ 93.3, i.e. 93% of target — on-track (≥70%) but not yet achieved.
    const workouts = [{ sets: [{ exerciseId: 'bench', weight: 80, reps: 5 }] }];
    const progress = goalProgress(goal, { workouts });
    expect(progress.current).toBeCloseTo(estimateOneRepMax(80, 5), 1);
    expect(progress.status).toBe('on-track');
  });

  it('bodyweight (losing): achieved once the trend reaches or passes the target', () => {
    const goal = { type: 'bodyweight', target: 76, direction: 'down' };
    const bodyweightLogs = [{ date: '2026-08-01', weight: 80 }, { date: '2026-09-01', weight: 75.5 }];
    const progress = goalProgress(goal, { bodyweightLogs });
    expect(progress.status).toBe('achieved');
  });

  it('bodyweight (losing): behind if the trend has barely moved', () => {
    const goal = { type: 'bodyweight', target: 70, direction: 'down' };
    const bodyweightLogs = [{ date: '2026-08-01', weight: 80 }, { date: '2026-09-01', weight: 79.8 }];
    const progress = goalProgress(goal, { bodyweightLogs });
    expect(progress.status).toBe('behind');
  });

  it('volume: only counts the current ISO week, not a running total', () => {
    const goal = { type: 'volume', target: 1000, muscle: 'chest' };
    const thisWeek = weekKey();
    const muscleVolume = [{ muscle: 'chest', weekKey: thisWeek, volume: 800 }, { muscle: 'chest', weekKey: '2020-W01', volume: 5000 }];
    expect(goalProgress(goal, { muscleVolume }).current).toBe(800);
  });

  it('nutrition: counts days in the trailing window that hit the metric target', () => {
    const goal = { type: 'nutrition', target: 2, metric: 'protein' };
    const dailyTotals = [
      { date: dateKey(), protein: 160 },
      { date: isoDaysAgo(1), protein: 100 },
      { date: isoDaysAgo(2), protein: 155 }
    ];
    const progress = goalProgress(goal, { dailyTotals, profile });
    expect(progress.current).toBe(2);
    expect(progress.status).toBe('achieved');
  });

  it('an unknown goal type reports zero rather than throwing', () => {
    expect(goalProgress({ type: 'mystery', target: 10 }, {})).toMatchObject({ current: 0, status: 'behind' });
  });
});

describe('goalEta', () => {
  it('projects an ETA from the current weight trend and rate', () => {
    const goal = { type: 'bodyweight', target: 74, direction: 'down' };
    // Losing ~0.5 kg/week in a straight line from 80 to 76.
    const bodyweightLogs = Array.from({ length: 5 }, (_, i) => ({ date: isoDaysAgo(28 - i * 7), weight: 80 - i * 0.5 }));
    const eta = goalEta(goal, { bodyweightLogs }, dateKey());
    expect(eta.onTrack).toBe(true);
    expect(eta.weeks).toBeGreaterThan(0);
  });

  it('reports not on track when the trend moves the wrong way', () => {
    const goal = { type: 'bodyweight', target: 74, direction: 'down' };
    const bodyweightLogs = Array.from({ length: 5 }, (_, i) => ({ date: isoDaysAgo(28 - i * 7), weight: 78 + i * 0.3 }));
    const eta = goalEta(goal, { bodyweightLogs }, dateKey());
    expect(eta.onTrack).toBe(false);
    expect(eta.weeks).toBeNull();
  });

  it('is null for goal types with no meaningful weekly trend', () => {
    expect(goalEta({ type: 'strength', target: 100 }, {})).toBeNull();
  });
});

describe('weightTrend / weightRatePerWeek', () => {
  it('trend is the trailing 7-day average, smoothing a single spike', () => {
    const logs = [
      { date: '2026-09-10', weight: 80 },
      { date: '2026-09-11', weight: 80 },
      { date: '2026-09-12', weight: 84 }, // a salty-dinner spike
      { date: '2026-09-13', weight: 80 }
    ];
    const trend = weightTrend(logs);
    expect(trend.at(-1).trend).toBeLessThan(84);
    expect(trend.at(-1).trend).toBeGreaterThan(80);
  });

  it('rate per week needs at least 3 points spanning a week, else returns null', () => {
    expect(weightRatePerWeek([{ date: '2026-09-13', weight: 80 }], { today: '2026-09-14' })).toBeNull();
  });

  it('rate per week reads a clean linear loss as ~-1kg/week', () => {
    const logs = Array.from({ length: 4 }, (_, i) => ({ date: isoDaysAgo(21 - i * 7), weight: 80 - i }));
    expect(weightRatePerWeek(logs, { today: dateKey() })).toBeCloseTo(-1, 0);
  });
});

describe('estimateTdee', () => {
  it('is not ready without enough logged days and weigh-ins', () => {
    expect(estimateTdee({ dailyTotals: [], bodyweightLogs: [] }).ready).toBe(false);
  });

  it('estimates maintenance from average intake adjusted by the weight trend', () => {
    const today = dateKey();
    const dailyTotals = lastNDays(29, new Date(`${today}T12:00:00`)).slice(0, -1).map((date) => ({ date, calories: 2300 }));
    const bodyweightLogs = Array.from({ length: 5 }, (_, i) => ({ date: isoDaysAgo(28 - i * 7, new Date(`${today}T12:00:00`)), weight: 80 - i * 0.5 }));
    const result = estimateTdee({ dailyTotals, bodyweightLogs, today });
    expect(result.ready).toBe(true);
    // Losing weight means true maintenance is above what was eaten.
    expect(result.tdee).toBeGreaterThan(result.avgIntake);
  });
});

describe('retargetCalories', () => {
  it('keeps protein and fat, lets carbs absorb the calorie change', () => {
    const next = retargetCalories({ calories: 2800, protein: 156, carbs: 393, fat: 67 }, 2400);
    expect(next.protein).toBe(156);
    expect(next.fat).toBe(67);
    expect(next.calories).toBe(2400);
    expect(next.carbs).toBeLessThan(393);
  });
});

describe('suggestProgression / applyProgression', () => {
  const chest = { primaryMuscles: ['chest'] };
  const quads = { primaryMuscles: ['quads'] };

  it('suggests a weight bump after an easy session at low RPE', () => {
    const last = { sets: [{ weight: 80, reps: 8, rpe: 7 }, { weight: 80, reps: 8, rpe: 8 }] };
    const suggestion = suggestProgression(last, chest, 'metric');
    expect(suggestion.kind).toBe('weight');
    expect(suggestion.delta).toBeGreaterThan(0);
  });

  it('suggests a bigger jump for a lower-body lift than an upper-body one', () => {
    const last = { sets: [{ weight: 100, reps: 5, rpe: 7 }] };
    const lower = suggestProgression(last, quads, 'metric');
    const upper = suggestProgression(last, chest, 'metric');
    expect(lower.delta).toBeGreaterThan(upper.delta);
  });

  it('suggests repeating rather than adding when RPE was high (grinding)', () => {
    const last = { sets: [{ weight: 80, reps: 8, rpe: 9.5 }] };
    expect(suggestProgression(last, chest, 'metric').kind).toBe('repeat');
  });

  it('for unweighted bodyweight work, suggests reps instead of weight', () => {
    const last = { sets: [{ weight: 0, reps: 10, rpe: 7 }] };
    const suggestion = suggestProgression(last, { primaryMuscles: ['lats'] }, 'metric');
    expect(suggestion.kind).toBe('reps');
  });

  it('applyProgression only bumps the sets that had weight, matching the suggestion kind', () => {
    const sets = [{ weight: 80, reps: 8 }, { weight: 0, reps: 10 }];
    const bumped = applyProgression(sets, { kind: 'weight', delta: 2.5 });
    expect(bumped[0].weight).toBe(82.5);
    expect(bumped[1].weight).toBe(0); // untouched — nothing to add weight to
  });
});

describe('lastTrainedByMuscle / neglectedMuscles', () => {
  const workouts = [
    { date: isoDaysAgo(15), sets: [{ attribution: { chest: 100 } }] },
    { date: isoDaysAgo(2), sets: [{ attribution: { lats: 100 } }] }
  ];

  it('finds the most recent date each muscle was trained', () => {
    const last = lastTrainedByMuscle(workouts);
    expect(last.chest).toBe(isoDaysAgo(15));
    expect(last.lats).toBe(isoDaysAgo(2));
  });

  it('flags muscles untrained past the threshold, including ones never trained', () => {
    const neglected = neglectedMuscles(['chest', 'lats', 'calves'], workouts, { today: dateKey(), days: 10 });
    const byMuscle = Object.fromEntries(neglected.map((row) => [row.muscle, row]));
    expect(byMuscle.chest.days).toBeGreaterThanOrEqual(10);
    expect(byMuscle.calves.days).toBeNull(); // never trained
    expect(byMuscle.lats).toBeUndefined(); // trained 2 days ago, under the threshold
  });

  it('returns nothing before any workout has ever been logged', () => {
    expect(neglectedMuscles(['chest'], [], {})).toEqual([]);
  });
});

describe('backupReminder / snoozeUntil', () => {
  it('says nothing until there has been a few days of activity', () => {
    expect(backupReminder({ firstActivityDate: dateKey(), today: dateKey() })).toBeNull();
  });
  it('nags once a new user has a few days of unbacked-up history', () => {
    const reminder = backupReminder({ firstActivityDate: isoDaysAgo(4), today: dateKey() });
    expect(reminder).toMatchObject({ neverExported: true });
  });
  it('nags again after the backup window has passed', () => {
    const reminder = backupReminder({ lastExportAt: isoDaysAgo(20), firstActivityDate: isoDaysAgo(40), today: dateKey() });
    expect(reminder).toMatchObject({ neverExported: false });
  });
  it('stays quiet inside its export window, and while snoozed', () => {
    expect(backupReminder({ lastExportAt: isoDaysAgo(2), today: dateKey() })).toBeNull();
    expect(backupReminder({ firstActivityDate: isoDaysAgo(30), snoozedUntil: snoozeUntil(7, new Date()), today: dateKey() })).toBeNull();
  });
});

describe('groupLogsByMeal', () => {
  it('groups by meal in a fixed breakfast→snack order and sums calories', () => {
    const logs = [
      { mealType: 'dinner', computed: { calories: 500 } },
      { mealType: 'breakfast', computed: { calories: 300 } },
      { mealType: 'breakfast', computed: { calories: 100 } }
    ];
    const groups = groupLogsByMeal(logs);
    expect(groups.map((g) => g.meal)).toEqual(['breakfast', 'dinner']);
    expect(groups[0].calories).toBe(400);
  });
});

describe('fmtDuration / fmtWeight', () => {
  it('formats seconds as m:ss', () => {
    expect(fmtDuration(90)).toBe('1:30');
    expect(fmtDuration(65.4)).toBe('1:06'); // rounds up so a live countdown never shows 0:00 early
  });
  it('formats weight with the unit suffix', () => {
    expect(fmtWeight(80, 'metric')).toBe('80 kg');
    expect(fmtWeight(80, 'imperial')).toMatch(/lb$/);
  });
});

describe('buildAiContext', () => {
  const profile = { units: 'metric', bodyweight: 78, targetBodyweight: 70, targetBodyFat: 12, targets: { calories: 2175, protein: 155, carbs: 249, fat: 62 } };

  it('includes a live session\'s name, cardio segments and timed sets', () => {
    const todayWorkouts = [{ date: '2026-09-14', name: 'Intervals', durationSeconds: 1500, cardio: [{ activity: 'run', label: 'Rep 1 of 6', meters: 400, seconds: 92 }], sets: [{ exerciseId: 'plank', reps: 0, seconds: 60, weight: 0 }] }];
    const text = buildAiContext({ today: '2026-09-14', profile, totals: {}, meals: [], todayWorkouts, exercises: [{ id: 'plank', name: 'Plank' }], goals: [], goalData: {} });
    expect(text).toContain('Intervals (25:00):');
    expect(text).toContain('- Rep 1 of 6: 400 m, 1:32, 3:50 /km');
    expect(text).toContain('- Plank: 60s');
  });

  it('states targets, remaining calories and a nothing-logged/no-workout/no-goals fallback when the day is empty', () => {
    const text = buildAiContext({ today: '2026-09-14', profile, totals: {}, meals: [], todayWorkouts: [], exercises: [], goals: [], goalData: {} });
    expect(text).toContain('Daily calories: 2,175 kcal');
    expect(text).toContain('2,175 kcal remaining');
    expect(text).toContain('Nothing logged yet today.');
    expect(text).toContain('No workout logged today.');
    expect(text).toContain('No goals set.');
    // Context only — it must never phrase a question on the user's behalf.
    expect(text).not.toMatch(/\?/);
  });

  it('lists meals, sets (dropping zero-weight bodyweight sets down to reps-only) and goal status', () => {
    const totals = { calories: 1162, protein: 93, carbs: 126, fat: 30 };
    const meals = [{ meal: 'lunch', logs: [{ foodName: 'Chicken & Rice Bowl', quantity: 450, unit: 'g', computed: { calories: 742 } }], calories: 742 }];
    const todayWorkouts = [{ date: '2026-09-14', sets: [
      { exerciseId: 'squat', weight: 100, reps: 8, rpe: 8 },
      { exerciseId: 'pullup', weight: 0, reps: 10, rpe: null }
    ] }];
    const exercises = [{ id: 'squat', name: 'Back Squat' }, { id: 'pullup', name: 'Pull-Up' }];
    const goals = [{ id: 1, type: 'bodyweight', title: 'Reach 72kg', target: 72, direction: 'down' }];
    const goalData = { bodyweightLogs: [{ date: '2026-09-01', weight: 78 }, { date: '2026-09-14', weight: 76 }], profile };

    const text = buildAiContext({ today: '2026-09-14', profile, totals, meals, todayWorkouts, exercises, goals, goalData });
    expect(text).toContain('Chicken & Rice Bowl (450g) — 742 kcal');
    expect(text).toContain('Back Squat: 100 kg × 8 @RPE8');
    expect(text).toContain('Pull-Up: 10 reps'); // no "@RPE" and no "0 kg" for the bodyweight set
    expect(text).toContain('Reach 72kg:');
  });
});
