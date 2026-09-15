import { beforeEach, describe, expect, it } from 'vitest';
import {
  addBodyweightLog, addExercise, addFood, addFoodLog, addGoal, addPlan, addProgressPhoto, addQuickLog, addRoute, addWorkout,
  clearAllData, copyFoodLogs, db, DEFAULT_PROFILE, deleteFoodLog, deleteWorkout, exportData, getActiveSession, getCustomExercises, getDailyTotals,
  getFoodLogs, getGoals, getMuscleVolume, getPlans, getProfile, getProgressPhotos, getRoutes, getTrackForWorkout, getWorkouts,
  hasActiveSession, importData, restoreFoodLog, restoreRow, restoreWorkout, saveActiveSession, saveProfile, saveSessionWorkout, updateFood,
  updateFoodLog, updatePlan, updateWorkout, validateImport
} from '../db.js';
import { calculateNutritionTargets, dateKey, weekKey } from '../utils.js';

// Dexie keeps one connection per database name; clearing the tables between
// tests is faster and less brittle than tearing the schema down each time.
beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

const today = dateKey();
const YOGHURT = { name: 'Greek Yoghurt', source: 'custom', servings: [{ label: 'pot', grams: 150 }, { label: '100 g', grams: 100 }], per100: { calories: 100, protein: 10, carbs: 4, fat: 5 } };
const BENCH = { name: 'Bench Press', isCustom: true, equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] };

describe('profile body-composition targets', () => {
  it('gives legacy profiles direct target defaults based on current bodyweight', async () => {
    const legacy = { id: 1, height: 178, bodyweight: 82, goalMix: { fatLoss: 0, muscleGain: 100, performance: 0, health: 0 }, targets: { calories: 3000, protein: 150, carbs: 400, fat: 80 } };
    await db.profile.put(legacy);

    const profile = await getProfile();

    expect(profile.targetBodyweight).toBe(82);
    expect(profile.targetBodyFat).toBeNull();
    expect(profile.targets).toEqual(calculateNutritionTargets(profile));
  });

  it('keeps a blank body-fat target blank instead of filling in a default', async () => {
    await saveProfile({ ...DEFAULT_PROFILE, bodyweight: 70, targetBodyweight: 65, targetBodyFat: null, sex: 'female', birthYear: 1994, priorities: ['health'], trainingDays: '4-5' });

    const profile = await getProfile();

    expect(profile.targetBodyFat).toBeNull();
    expect(profile).toMatchObject({ sex: 'female', birthYear: 1994, priorities: ['health'], trainingDays: '4-5' });
  });
});

describe('daily totals — the derived counter, not a scan of foodLogs', () => {
  it('addFoodLog increments the day\'s row', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    const [row] = await getDailyTotals();
    expect(row.date).toBe(today);
    expect(row.calories).toBe(150); // 150g of 100 kcal/100g
    expect(row.protein).toBe(15);
  });

  it('two logs on the same day accumulate into one row', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    await addFoodLog({ foodId, date: today, mealType: 'lunch', quantity: 1, unit: 'serving' });
    const totals = await getDailyTotals();
    expect(totals).toHaveLength(1);
    expect(totals[0].calories).toBe(300);
  });

  it('deleteFoodLog decrements, floored at 0 rather than going negative', async () => {
    const foodId = await addFood(YOGHURT);
    const logId = await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    await deleteFoodLog(logId);
    const [row] = await getDailyTotals();
    expect(row.calories).toBe(0);
    expect(row.protein).toBe(0);
  });

  it('updateFoodLog applies the delta between old and new, not a re-add', async () => {
    const foodId = await addFood(YOGHURT);
    const logId = await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    await updateFoodLog(logId, { date: today, mealType: 'breakfast', quantity: 2, unit: 'serving' });
    const [row] = await getDailyTotals();
    expect(row.calories).toBe(300); // 2 servings, not 150 + 300
  });

  it('moving a log to a different day debits the old day and credits the new one', async () => {
    const foodId = await addFood(YOGHURT);
    const yesterday = dateKey(new Date(Date.now() - 86_400_000));
    const logId = await addFoodLog({ foodId, date: yesterday, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    await updateFoodLog(logId, { date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    const totals = await getDailyTotals();
    const byDate = Object.fromEntries(totals.map((row) => [row.date, row]));
    expect(byDate[yesterday]?.calories ?? 0).toBe(0);
    expect(byDate[today].calories).toBe(150);
  });

  it('editing the library food afterwards does NOT rewrite the frozen log or its day total', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    await updateFood(foodId, { ...YOGHURT, per100: { ...YOGHURT.per100, calories: 999 } });
    const [log] = await getFoodLogs();
    expect(log.computed.calories).toBe(150);
    const [row] = await getDailyTotals();
    expect(row.calories).toBe(150);
  });

  it('restoreFoodLog (undo) re-adds the log AND re-applies its total, not just the row', async () => {
    const foodId = await addFood(YOGHURT);
    const logId = await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    const [log] = await getFoodLogs();
    await deleteFoodLog(logId);
    await restoreFoodLog(log);
    const [row] = await getDailyTotals();
    expect(row.calories).toBe(150);
    expect(await getFoodLogs()).toHaveLength(1);
  });

  it('addQuickLog (no library food) still feeds the daily total', async () => {
    await addQuickLog({ name: 'Restaurant pasta', date: today, mealType: 'dinner', computed: { calories: 800, protein: 30, carbs: 90, fat: 30 } });
    const [row] = await getDailyTotals();
    expect(row.calories).toBe(800);
    const [log] = await getFoodLogs();
    expect(log.quick).toBe(true);
    expect(log.foodId).toBeNull();
  });

  it('copyFoodLogs duplicates the frozen `computed` exactly, without re-scaling', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    // Change the food after logging — a copy must still use the ORIGINAL frozen macros.
    await updateFood(foodId, { ...YOGHURT, per100: { ...YOGHURT.per100, calories: 999 } });
    const [original] = await getFoodLogs();
    await copyFoodLogs([original], { date: today, mealType: 'lunch' });
    const totals = await getDailyTotals();
    expect(totals[0].calories).toBe(300); // 150 + 150, not 150 + 999-scaled
  });
});

describe('muscle volume — the other derived counter', () => {
  it('addWorkout attributes primary muscles at full volume and secondary at half', async () => {
    const exerciseId = await addExercise(BENCH);
    await addWorkout({ date: today, sets: [{ exerciseId, weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    const rows = await getMuscleVolume();
    const byMuscle = Object.fromEntries(rows.map((row) => [row.muscle, row.volume]));
    expect(byMuscle.chest).toBe(640); // 80 * 8
    expect(byMuscle.triceps).toBe(320); // half
  });

  it('deleteWorkout removes exactly what that workout added, floored at 0', async () => {
    const exerciseId = await addExercise(BENCH);
    const workoutId = await addWorkout({ date: today, sets: [{ exerciseId, weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    await deleteWorkout(workoutId);
    const rows = await getMuscleVolume();
    expect(rows.every((row) => row.volume === 0)).toBe(true);
  });

  it('updateWorkout applies the delta between the old and new sets', async () => {
    const exerciseId = await addExercise(BENCH);
    const workoutId = await addWorkout({ date: today, sets: [{ exerciseId, weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    await updateWorkout(workoutId, { date: today, sets: [{ exerciseId, weight: 100, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    const rows = await getMuscleVolume();
    const chest = rows.find((row) => row.muscle === 'chest');
    expect(chest.volume).toBe(800); // 100 * 8, not the old 640 left behind
  });

  it('restoreWorkout (undo) re-applies the ORIGINAL frozen attribution, not a recomputation', async () => {
    const exerciseId = await addExercise(BENCH);
    const workoutId = await addWorkout({ date: today, sets: [{ exerciseId, weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    const [workout] = await getWorkouts();
    await deleteWorkout(workoutId);
    await restoreWorkout(workout);
    const rows = await getMuscleVolume();
    expect(rows.find((row) => row.muscle === 'chest').volume).toBe(640);
  });

  it('a bodyweight exercise loads the athlete\'s bodyweight, not just any added weight', async () => {
    await addBodyweightLog({ date: today, weight: 78 });
    const exerciseId = await addExercise({ name: 'Pull-Up', isCustom: true, equipment: 'bodyweight', primaryMuscles: ['lats'], secondaryMuscles: [] });
    await addWorkout({ date: today, sets: [{ exerciseId, weight: 0, reps: 8 }] }, [{ id: exerciseId, equipment: 'bodyweight', primaryMuscles: ['lats'], secondaryMuscles: [] }]);
    const rows = await getMuscleVolume();
    expect(rows.find((row) => row.muscle === 'lats').volume).toBe(78 * 8);
  });

  it('volume is bucketed by ISO week, keyed off the workout date', async () => {
    const exerciseId = await addExercise(BENCH);
    await addWorkout({ date: today, sets: [{ exerciseId, weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    const rows = await getMuscleVolume();
    expect(rows.every((row) => row.weekKey === weekKey(today))).toBe(true);
  });

  it('a set\'s exerciseId keeps the exercise\'s real id type through normaliseSets (a <select> hands back strings)', async () => {
    const exerciseId = await addExercise(BENCH); // Dexie ++id → a number
    await addWorkout({ date: today, sets: [{ exerciseId: String(exerciseId), weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    const [workout] = await getWorkouts();
    expect(typeof workout.sets[0].exerciseId).toBe('number');
  });
});

describe('export / import', () => {
  it('validateImport rejects a file that is not a Finesse Fit backup', () => {
    expect(() => validateImport(null)).toThrow();
    expect(() => validateImport([1, 2, 3])).toThrow();
    expect(() => validateImport({ notARealTable: [] })).toThrow();
  });

  it('validateImport accepts a payload with at least one known table and counts its rows', () => {
    expect(validateImport({ foods: [{ id: 1 }, { id: 2 }] })).toMatchObject({ foods: 2 });
  });

  it('exportData excludes photos — raw image bytes don\'t belong in a JSON backup', async () => {
    await addProgressPhoto({ date: today, full: new Uint8Array([1]), thumb: new Uint8Array([1]), width: 1, height: 1 });
    const payload = await exportData();
    expect(payload.photos).toBeUndefined();
    expect(await getProgressPhotos()).toHaveLength(1); // the photo itself is untouched
  });

  it('round-trips foods, logs and derived totals through export → replace-import', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    const before = await getDailyTotals();

    const payload = JSON.parse(JSON.stringify(await exportData()));
    await importData(payload, 'replace');

    // 'replace' clears the table first, so Dexie assigns fresh row ids on the
    // way back in — only the actual figures need to match.
    const strip = (rows) => rows.map(({ id: _id, ...rest }) => rest);
    const after = await getDailyTotals();
    expect(strip(after)).toEqual(strip(before));
    const [log] = await getFoodLogs();
    expect(log.computed.calories).toBe(150);
  });

  it('import remaps a workout\'s exerciseId to the newly-assigned exercise id', async () => {
    const exerciseId = await addExercise(BENCH);
    await addWorkout({ date: today, sets: [{ exerciseId, weight: 80, reps: 8 }] }, [{ ...BENCH, id: exerciseId }]);
    const payload = JSON.parse(JSON.stringify(await exportData()));

    await Promise.all(db.tables.map((table) => table.clear()));
    await importData(payload, 'replace');

    const [newExercise] = await getCustomExercises();
    const [workout] = await getWorkouts();
    expect(workout.sets[0].exerciseId).toBe(newExercise.id);
    expect(newExercise.id).not.toBe(exerciseId); // Dexie assigned a fresh id
  });

  it('merge mode adds a matching day\'s totals together instead of overwriting them', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    const payload = JSON.parse(JSON.stringify(await exportData()));

    await importData(payload, 'merge'); // import the same day's totals again, on top

    const totals = await getDailyTotals();
    expect(totals.find((row) => row.date === today).calories).toBe(300);
  });
});

describe('generic undo (restoreRow) and a full reset', () => {
  it('restoreRow refuses a table with derived counters — it must go through its own restore*', () => {
    expect(() => restoreRow('foodLogs', {})).toThrow();
    expect(() => restoreRow('workouts', {})).toThrow();
  });

  it('restoreRow puts a simple row back under its original id', async () => {
    const goalId = await addGoal({ type: 'strength', title: 'Bench 100kg', target: 100, exerciseId: 'bench' });
    const [goal] = await getGoals();
    await db.goals.delete(goalId);
    await restoreRow('goals', goal);
    expect(await getGoals()).toHaveLength(1);
  });

  it('clearAllData wipes every table, including binary ones like photos, and reseeds the profile', async () => {
    const foodId = await addFood(YOGHURT);
    await addFoodLog({ foodId, date: today, mealType: 'breakfast', quantity: 1, unit: 'serving' });
    await addProgressPhoto({ date: today, full: new Uint8Array([1]), thumb: new Uint8Array([1]), width: 1, height: 1 });

    await clearAllData();

    expect(await getFoodLogs()).toHaveLength(0);
    expect(await getDailyTotals()).toHaveLength(0);
    expect(await getProgressPhotos()).toHaveLength(0);
    expect(await db.profile.get(1)).toMatchObject({ id: 1 });
  });
});

describe('live sessions, plans, routes and GPS tracks', () => {
  const PLANK = { name: 'Plank', isCustom: true, equipment: 'bodyweight', primaryMuscles: ['abs'], secondaryMuscles: [] };
  const segments = [[[51.5, -0.12, 1000, 5, null], [51.501, -0.12, 30_000, 5, null]]];

  it('keeps timed sets (seconds, no reps) instead of dropping them', async () => {
    const plankId = await addExercise(PLANK);
    await addWorkout({ date: today, sets: [{ exerciseId: plankId, reps: 0, seconds: 60 }] }, [{ ...PLANK, id: plankId }]);
    const [workout] = await getWorkouts();
    expect(workout.sets).toHaveLength(1);
    expect(workout.sets[0]).toMatchObject({ reps: 0, seconds: 60 });
  });

  it('saveSessionWorkout stores cardio extras and the track together, and clears the active session', async () => {
    const benchId = await addExercise(BENCH);
    await saveActiveSession({ name: 'In progress' });
    const id = await saveSessionWorkout({
      workout: { date: today, name: 'Run + bench', durationSeconds: 1800, distance: 5000, cardio: [{ activity: 'run', meters: 5000, seconds: 1500 }], sets: [{ exerciseId: benchId, reps: 5, weight: 100 }], track: 'ignored' },
      track: { activity: 'run', segments }
    }, [{ ...BENCH, id: benchId }]);

    const workout = await db.workouts.get(id);
    expect(workout).toMatchObject({ name: 'Run + bench', distance: 5000, durationSeconds: 1800 });
    expect(workout.track).toBeUndefined();
    expect((await getTrackForWorkout(id)).segments).toEqual(segments);
    expect(await hasActiveSession()).toBe(0);
    expect((await getMuscleVolume()).find((row) => row.muscle === 'chest').volume).toBe(500);
  });

  it('deleting a run removes its track and Undo brings both back', async () => {
    const id = await saveSessionWorkout({ workout: { date: today, sets: [], cardio: [{ activity: 'run', meters: 100 }] }, track: { segments } });
    const removed = await deleteWorkout(id);
    expect(await getTrackForWorkout(id)).toBeUndefined();
    expect(removed.track.segments).toEqual(segments);

    await restoreWorkout(removed);
    expect((await getTrackForWorkout(id)).segments).toEqual(segments);
    expect((await db.workouts.get(id)).track).toBeUndefined();
  });

  it('reads legacy { sets } templates as block plans, and saves plans normalised', async () => {
    await db.templates.add({ name: 'Old', sets: [{ exerciseId: 'a', reps: 5, weight: 100 }, { exerciseId: 'a', reps: 5, weight: 100 }] });
    const id = await addPlan({ name: ' Intervals ', blocks: [{ kind: 'intervals', repeats: 4 }] });
    const plans = await getPlans();
    expect(plans.find((plan) => plan.name === 'Old').blocks[0]).toMatchObject({ kind: 'exercise', sets: 2, reps: 5 });
    expect(plans.find((plan) => plan.id === id)).toMatchObject({ name: 'Intervals', blocks: [{ kind: 'intervals', repeats: 4 }] });

    await updatePlan(id, { name: 'Intervals v2', blocks: [] });
    expect((await getPlans()).find((plan) => plan.id === id).name).toBe('Intervals v2');
  });

  it('export → import remaps plan exercises, route links and track owners', async () => {
    const benchId = await addExercise(BENCH);
    const routeId = await addRoute({ name: 'Park loop', path: [[51.5, -0.12], [51.51, -0.12]], distance: 1112 });
    const planId = await addPlan({ name: 'Mixed', blocks: [{ kind: 'exercise', exerciseId: benchId }, { kind: 'cardio', routeId, goal: { type: 'distance', meters: 1112 } }] });
    await saveSessionWorkout({ workout: { date: today, planId, routeId, sets: [{ exerciseId: benchId, reps: 5, weight: 60 }], cardio: [{ activity: 'run', meters: 1112 }] }, track: { segments } }, [{ ...BENCH, id: benchId }]);
    const payload = JSON.parse(JSON.stringify(await exportData()));
    expect(payload.version).toBe(4);
    expect(payload.activeSession).toBeUndefined();

    await Promise.all(db.tables.map((table) => table.clear()));
    await db.exercises.add({ name: 'Padding so ids shift' });
    await db.routes.add({ name: 'Padding' });
    await importData(payload, 'merge');

    const exercise = (await getCustomExercises()).find((row) => row.name === BENCH.name);
    const route = (await getRoutes()).find((row) => row.name === 'Park loop');
    const plan = (await getPlans()).find((row) => row.name === 'Mixed');
    const [workout] = await getWorkouts();
    expect(plan.blocks[0].exerciseId).toBe(exercise.id);
    expect(plan.blocks[1].routeId).toBe(route.id);
    expect(workout).toMatchObject({ planId: plan.id, routeId: route.id });
    expect((await getTrackForWorkout(workout.id)).segments).toEqual(segments);
  });

  it('clearAllData also wipes routes, tracks and a session in progress', async () => {
    await addRoute({ name: 'Loop' });
    await saveSessionWorkout({ workout: { date: today, sets: [] }, track: { segments } });
    await saveActiveSession({ name: 'Half done' });
    await clearAllData();
    expect(await getRoutes()).toHaveLength(0);
    expect(await db.tracks.count()).toBe(0);
    expect(await getActiveSession()).toBeUndefined();
  });
});
