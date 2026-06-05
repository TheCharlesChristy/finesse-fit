import Dexie from 'dexie';
import { SEEDED_EXERCISES } from './data/exercises.js';
import { DEFAULT_GOAL_MIX, addTotals, attributeVolume, calculateNutritionTargets, dateKey, scaleNutrition, setVolume, weekKey } from './utils.js';

export const db = new Dexie('FinesseFit');

db.version(1).stores({
  profile: '++id',
  foods: '++id, barcode, name',
  foodLogs: '++id, date, mealType',
  dailyTotals: '++id, &date',
  exercises: '++id, name',
  workouts: '++id, date',
  muscleVolume: '++id, muscle, weekKey',
  bodyweightLogs: '++id, date',
  goals: '++id, type'
});

export const DEFAULT_PROFILE = {
  id: 1,
  units: 'metric',
  heightUnit: 'imperial',
  weightUnit: 'metric',
  height: 178,
  bodyweight: 78,
  goalMix: DEFAULT_GOAL_MIX,
  targets: calculateNutritionTargets({ height: 178, bodyweight: 78, goalMix: DEFAULT_GOAL_MIX }),
  themeMode: 'dark'
};

const TABLES = ['profile', 'foods', 'foodLogs', 'dailyTotals', 'exercises', 'workouts', 'muscleVolume', 'bodyweightLogs', 'goals'];

const stripId = ({ id: _id, ...row }) => row;
const findSeed = (id) => SEEDED_EXERCISES.find((exercise) => String(exercise.id) === String(id));

async function adjustDailyTotal(date, computed, sign = 1) {
  const key = dateKey(date);
  const current = await db.dailyTotals.where('date').equals(key).first();
  const next = { ...addTotals(current, computed, sign), date: key };
  if (current) await db.dailyTotals.update(current.id, next);
  else await db.dailyTotals.add(next);
}

async function adjustMuscleVolume(date, attribution = {}, sign = 1) {
  const wk = weekKey(date);
  for (const [muscle, amount] of Object.entries(attribution)) {
    const current = await db.muscleVolume.where('muscle').equals(muscle).and((row) => row.weekKey === wk).first();
    const volume = Math.max(0, (current?.volume ?? 0) + amount * sign);
    if (current) await db.muscleVolume.update(current.id, { volume });
    else await db.muscleVolume.add({ muscle, weekKey: wk, volume });
  }
}

function collectAttribution(sets = []) {
  return sets.reduce((total, set) => {
    for (const [muscle, volume] of Object.entries(set.attribution ?? {})) {
      total[muscle] = (total[muscle] ?? 0) + volume;
    }
    return total;
  }, {});
}

async function normaliseSets(sets = [], suppliedExercises = []) {
  const custom = await db.exercises.toArray();
  const exercises = [...SEEDED_EXERCISES, ...custom, ...suppliedExercises];
  return sets
    .filter((set) => set.exerciseId && Number(set.reps) > 0)
    .map((set) => {
      const exercise = exercises.find((item) => String(item.id) === String(set.exerciseId)) ?? findSeed(set.exerciseId);
      const volume = setVolume(set);
      return {
        exerciseId: set.exerciseId,
        reps: Number(set.reps),
        weight: Number(set.weight) || 0,
        rpe: set.rpe === '' || set.rpe == null ? null : Number(set.rpe),
        volume,
        attribution: attributeVolume(exercise, volume)
      };
    });
}

export async function getProfile() {
  return (await db.profile.get(1)) ?? null;
}

export async function saveProfile(profile) {
  const next = { ...DEFAULT_PROFILE, ...profile, id: 1 };
  return db.profile.put({ ...next, targets: next.targets ?? calculateNutritionTargets(next) });
}

export const getFoods = () => db.foods.orderBy('name').toArray();
export const addFood = (food) => db.foods.add({ ...food, barcode: food.barcode || null, brand: food.brand || null });
export const updateFood = (id, updates) => db.foods.update(id, updates);
export const deleteFood = (id) => db.foods.delete(id);
export const findFoodByBarcode = (barcode) => db.foods.where('barcode').equals(String(barcode)).first();

export const getFoodLogs = () => db.foodLogs.orderBy('date').reverse().toArray();
export const getDailyTotals = () => db.dailyTotals.orderBy('date').toArray();

export async function addFoodLog(input) {
  return db.transaction('rw', db.foodLogs, db.foods, db.dailyTotals, async () => {
    const food = input.foodSnapshot ?? await db.foods.get(input.foodId);
    if (!food) throw new Error('Food not found');
    const computed = input.computed ?? scaleNutrition(food, input.quantity, input.unit);
    const log = {
      foodId: input.foodId,
      foodName: food.name,
      brand: food.brand ?? null,
      foodSnapshot: { per100: food.per100, servings: food.servings },
      date: input.date,
      mealType: input.mealType,
      quantity: Number(input.quantity),
      unit: input.unit,
      computed
    };
    const id = await db.foodLogs.add(log);
    await adjustDailyTotal(log.date, computed, 1);
    return id;
  });
}

export async function updateFoodLog(id, updates) {
  return db.transaction('rw', db.foodLogs, db.foods, db.dailyTotals, async () => {
    const old = await db.foodLogs.get(id);
    if (!old) throw new Error('Food log not found');
    await adjustDailyTotal(old.date, old.computed, -1);
    const food = old.foodSnapshot ? { ...old, ...old.foodSnapshot } : await db.foods.get(updates.foodId ?? old.foodId);
    const next = { ...old, ...updates };
    next.computed = updates.computed ?? scaleNutrition(food, next.quantity, next.unit);
    await db.foodLogs.put(next);
    await adjustDailyTotal(next.date, next.computed, 1);
  });
}

export async function deleteFoodLog(id) {
  return db.transaction('rw', db.foodLogs, db.dailyTotals, async () => {
    const old = await db.foodLogs.get(id);
    if (!old) return;
    await db.foodLogs.delete(id);
    await adjustDailyTotal(old.date, old.computed, -1);
  });
}

export const getCustomExercises = () => db.exercises.orderBy('name').toArray();
export const addExercise = (exercise) => db.exercises.add({ ...exercise, isCustom: true });
export const updateExercise = (id, updates) => db.exercises.update(id, updates);
export const deleteExercise = (id) => db.exercises.delete(id);
export const getWorkouts = () => db.workouts.orderBy('date').reverse().toArray();
export const getMuscleVolume = () => db.muscleVolume.orderBy('weekKey').reverse().toArray();

export async function addWorkout(input, exercises = []) {
  return db.transaction('rw', db.workouts, db.exercises, db.muscleVolume, async () => {
    const workout = { date: input.date, sets: await normaliseSets(input.sets, exercises) };
    const id = await db.workouts.add(workout);
    await adjustMuscleVolume(workout.date, collectAttribution(workout.sets), 1);
    return id;
  });
}

export async function updateWorkout(id, updates, exercises = []) {
  return db.transaction('rw', db.workouts, db.exercises, db.muscleVolume, async () => {
    const old = await db.workouts.get(id);
    if (!old) throw new Error('Workout not found');
    await adjustMuscleVolume(old.date, collectAttribution(old.sets), -1);
    const next = { ...old, ...updates, sets: await normaliseSets(updates.sets ?? old.sets, exercises) };
    await db.workouts.put(next);
    await adjustMuscleVolume(next.date, collectAttribution(next.sets), 1);
  });
}

export async function deleteWorkout(id) {
  return db.transaction('rw', db.workouts, db.muscleVolume, async () => {
    const old = await db.workouts.get(id);
    if (!old) return;
    await db.workouts.delete(id);
    await adjustMuscleVolume(old.date, collectAttribution(old.sets), -1);
  });
}

export const getBodyweightLogs = () => db.bodyweightLogs.orderBy('date').toArray();
export const addBodyweightLog = (row) => db.bodyweightLogs.add({ date: row.date, weight: Number(row.weight) });
export const deleteBodyweightLog = (id) => db.bodyweightLogs.delete(id);
export const getGoals = () => db.goals.orderBy('type').toArray();
export const addGoal = (goal) => db.goals.add(goal);
export const updateGoal = (id, updates) => db.goals.update(id, updates);
export const deleteGoal = (id) => db.goals.delete(id);

export async function exportData() {
  const payload = { version: 1, exportedAt: new Date().toISOString() };
  for (const table of TABLES) payload[table] = await db[table].toArray();
  return payload;
}

export async function importData(data, mode = 'merge') {
  return db.transaction('rw', ...TABLES.map((table) => db[table]), async () => {
    if (mode === 'replace') await Promise.all(TABLES.map((table) => db[table].clear()));
    const foodMap = new Map();
    const exerciseMap = new Map();
    if (data.profile?.[0]) await db.profile.put({ ...DEFAULT_PROFILE, ...data.profile[0], id: 1 });
    else if (mode === 'replace') await db.profile.put(DEFAULT_PROFILE);
    for (const food of data.foods ?? []) foodMap.set(food.id, await db.foods.add(stripId(food)));
    for (const exercise of data.exercises ?? []) exerciseMap.set(exercise.id, await db.exercises.add(stripId(exercise)));
    for (const row of data.foodLogs ?? []) await db.foodLogs.add({ ...stripId(row), foodId: foodMap.get(row.foodId) ?? row.foodId });
    for (const row of data.dailyTotals ?? []) {
      const existing = await db.dailyTotals.where('date').equals(row.date).first();
      if (existing) await db.dailyTotals.update(existing.id, addTotals(existing, row, 1));
      else await db.dailyTotals.add(stripId(row));
    }
    for (const row of data.workouts ?? []) {
      const sets = (row.sets ?? []).map((set) => ({ ...set, exerciseId: exerciseMap.get(set.exerciseId) ?? set.exerciseId }));
      await db.workouts.add({ ...stripId(row), sets });
    }
    for (const row of data.muscleVolume ?? []) {
      const existing = await db.muscleVolume.where('muscle').equals(row.muscle).and((item) => item.weekKey === row.weekKey).first();
      if (existing) await db.muscleVolume.update(existing.id, { volume: Math.max(0, (existing.volume ?? 0) + (row.volume ?? 0)) });
      else await db.muscleVolume.add(stripId(row));
    }
    for (const row of data.bodyweightLogs ?? []) await db.bodyweightLogs.add(stripId(row));
    for (const row of data.goals ?? []) await db.goals.add({ ...stripId(row), exerciseId: exerciseMap.get(row.exerciseId) ?? row.exerciseId });
  });
}

export const clearAllData = () => db.transaction('rw', ...TABLES.map((table) => db[table]), async () => {
  await Promise.all(TABLES.map((table) => db[table].clear()));
  await db.profile.put(DEFAULT_PROFILE);
});
