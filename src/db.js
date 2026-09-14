import Dexie from 'dexie';
import { SEEDED_EXERCISES } from './data/exercise-library/index.js';
import { normalizePlan } from './plans.js';
import { DEFAULT_APPEARANCE, normaliseAppearance } from './theme/appearance.js';
import { DEFAULT_GOAL_MIX, DEFAULT_TARGET_BODY_FAT, addTotals, attributeVolume, calculateNutritionTargets, dateKey, normalizeBodyCompositionTargets, round, scaleNutrition, setLoad, setVolume, weekKey } from './utils.js';

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

// v2: saved meals (templates of food-log items).
db.version(2).stores({
  profile: '++id',
  foods: '++id, barcode, name',
  foodLogs: '++id, date, mealType',
  dailyTotals: '++id, &date',
  exercises: '++id, name',
  workouts: '++id, date',
  muscleVolume: '++id, muscle, weekKey',
  bodyweightLogs: '++id, date',
  goals: '++id, type',
  meals: '++id, name'
});

// v3: workout templates.
db.version(3).stores({
  profile: '++id',
  foods: '++id, barcode, name',
  foodLogs: '++id, date, mealType',
  dailyTotals: '++id, &date',
  exercises: '++id, name',
  workouts: '++id, date',
  muscleVolume: '++id, muscle, weekKey',
  bodyweightLogs: '++id, date',
  goals: '++id, type',
  meals: '++id, name',
  templates: '++id, name'
});

// v4: progress photos. Deliberately NOT in TABLES/exportData — see photos.js
// and the note above BINARY_TABLES for why they stay out of the JSON backup.
db.version(4).stores({
  profile: '++id',
  foods: '++id, barcode, name',
  foodLogs: '++id, date, mealType',
  dailyTotals: '++id, &date',
  exercises: '++id, name',
  workouts: '++id, date',
  muscleVolume: '++id, muscle, weekKey',
  bodyweightLogs: '++id, date',
  goals: '++id, type',
  meals: '++id, name',
  templates: '++id, name',
  photos: '++id, date'
});

// v5: workout plans reuse `templates` (no index change); GPS tracks, saved
// routes, and the in-progress live session. Tracks live in their own table,
// not on the workout row, so the app-wide workouts query never drags a
// thousand GPS points per run into memory.
db.version(5).stores({
  profile: '++id',
  foods: '++id, barcode, name',
  foodLogs: '++id, date, mealType',
  dailyTotals: '++id, &date',
  exercises: '++id, name',
  workouts: '++id, date',
  muscleVolume: '++id, muscle, weekKey',
  bodyweightLogs: '++id, date',
  goals: '++id, type',
  meals: '++id, name',
  templates: '++id, name',
  photos: '++id, date',
  tracks: '++id, workoutId',
  routes: '++id, name',
  activeSession: 'id'
});

export const DEFAULT_PROFILE = {
  id: 1,
  units: 'metric',
  heightUnit: 'imperial',
  weightUnit: 'metric',
  height: 178,
  bodyweight: 78,
  targetBodyweight: 78,
  targetBodyFat: DEFAULT_TARGET_BODY_FAT,
  goalMix: DEFAULT_GOAL_MIX,
  targets: calculateNutritionTargets({ height: 178, bodyweight: 78, targetBodyweight: 78, targetBodyFat: DEFAULT_TARGET_BODY_FAT, goalMix: DEFAULT_GOAL_MIX }),
  // Every visual preference lives in one nested object so the appearance model
  // is the same shape here as it is in Finesse — see theme/appearance.js.
  appearance: DEFAULT_APPEARANCE
};

const TABLES = ['profile', 'foods', 'foodLogs', 'dailyTotals', 'exercises', 'workouts', 'muscleVolume', 'bodyweightLogs', 'goals', 'meals', 'templates', 'routes', 'tracks'];
// Photos hold raw image bytes, not JSON-friendly data — they're excluded from
// exportData()/importData() (see photos.js) but must still be wiped by a full
// reset, so clearAllData() clears TABLES + BINARY_TABLES together.
const BINARY_TABLES = ['photos'];
// Device-local working state (a half-finished workout) — not a record worth
// backing up, but a full reset still wipes it.
const DEVICE_TABLES = ['activeSession'];

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
    const volume = Math.max(0, round((current?.volume ?? 0) + amount * sign, 1));
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
  const bodyweight = (await db.bodyweightLogs.orderBy('date').last())?.weight ?? (await db.profile.get(1))?.bodyweight ?? 0;
  return sets
    // Timed sets (a 60 s plank) have no reps but are still real work.
    .filter((set) => set.exerciseId && (Number(set.reps) > 0 || Number(set.seconds) > 0))
    .map((set) => {
      const exercise = exercises.find((item) => String(item.id) === String(set.exerciseId)) ?? findSeed(set.exerciseId);
      const volume = setVolume(set, setLoad(set, exercise, bodyweight));
      return {
        // <select> hands back strings; keep the exercise's real id type so
        // numeric custom-exercise ids survive export/import remapping.
        exerciseId: exercise?.id ?? set.exerciseId,
        reps: Number(set.reps) || 0,
        ...(Number(set.seconds) > 0 ? { seconds: Math.round(Number(set.seconds)) } : {}),
        weight: Number(set.weight) || 0,
        rpe: set.rpe === '' || set.rpe == null ? null : Number(set.rpe),
        volume,
        attribution: attributeVolume(exercise, volume)
      };
    });
}

export async function getProfile() {
  const saved = await db.profile.get(1);
  if (!saved) return null;
  // Profiles from before direct body-composition targets existed have no target
  // fields. Expose a migrated shape immediately and recalculate their estimate
  // from the new defaults without rewriting the user's stored data on every read.
  const hasCompositionTargets = saved.targetBodyweight != null || saved.targetBodyFat != null;
  const next = { ...DEFAULT_PROFILE, ...saved, ...normalizeBodyCompositionTargets(saved) };
  return {
    ...next,
    // Profiles written before the appearance model existed carry a flat
    // themeMode/palette pair; read them as the two fields they map onto and let
    // normaliseAppearance default the other seven.
    appearance: normaliseAppearance(saved.appearance ?? { themeMode: saved.themeMode, palette: saved.palette }),
    targets: hasCompositionTargets ? (saved.targets ?? calculateNutritionTargets(next)) : calculateNutritionTargets(next)
  };
}

export async function updateProfile(patch) {
  const current = (await db.profile.get(1)) ?? DEFAULT_PROFILE;
  return saveProfile({ ...current, ...patch });
}

export async function saveProfile(profile) {
  const merged = { ...DEFAULT_PROFILE, ...profile, id: 1, appearance: normaliseAppearance(profile.appearance) };
  const composition = normalizeBodyCompositionTargets({ ...profile, bodyweight: profile.bodyweight ?? DEFAULT_PROFILE.bodyweight });
  const next = { ...merged, ...composition };
  const hasCompositionTargets = profile.targetBodyweight != null || profile.targetBodyFat != null;
  const targets = hasCompositionTargets ? (next.targets ?? calculateNutritionTargets(next)) : calculateNutritionTargets(next);
  return db.profile.put({ ...next, targets });
}

export const getFoods = () => db.foods.orderBy('name').toArray();
export const addFood = (food) => db.foods.add({ ...stripId(food), barcode: food.barcode ? String(food.barcode) : null, brand: food.brand || null });
export const updateFood = (id, updates) => db.foods.update(id, { ...stripId(updates), barcode: updates.barcode ? String(updates.barcode) : null });
// Deletes return the removed row so the caller can offer Undo via the matching restore helper.
async function removeRow(table, id) {
  const row = await db[table].get(id);
  if (row) await db[table].delete(id);
  return row;
}

// Undo for simple tables (no derived counters): put the row back with its original id.
const RESTORABLE = new Set(['foods', 'bodyweightLogs', 'goals', 'meals', 'templates', 'photos', 'routes']);
export function restoreRow(table, row) {
  if (!RESTORABLE.has(table)) throw new Error(`Cannot restore ${table}`);
  return db[table].put(row);
}

export const deleteFood = (id) => removeRow('foods', id);
export const findFoodByBarcode = (barcode) => db.foods.where('barcode').equals(String(barcode)).first();

export const getFoodLogs = () => db.foodLogs.orderBy('date').reverse().toArray();
export const getDailyTotals = () => db.dailyTotals.orderBy('date').toArray();

// Must run inside a transaction covering foodLogs + dailyTotals.
async function insertFoodLog(food, input) {
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
}

export async function addFoodLog(input) {
  return db.transaction('rw', db.foodLogs, db.foods, db.dailyTotals, async () => {
    const food = input.foodSnapshot ?? await db.foods.get(input.foodId);
    if (!food) throw new Error('Food not found');
    return insertFoodLog(food, input);
  });
}

// Re-log existing entries on another date/meal. Copies keep the source logs'
// frozen nutrition exactly — it's the same food eaten again.
export async function copyFoodLogs(logs, { date, mealType }) {
  return db.transaction('rw', db.foodLogs, db.dailyTotals, async () => {
    for (const log of logs) {
      const { id: _id, ...row } = log;
      await db.foodLogs.add({ ...row, date, mealType: mealType ?? log.mealType });
      await adjustDailyTotal(date, log.computed, 1);
    }
  });
}

export const getMeals = () => db.meals.orderBy('name').toArray();
export const addMeal = (meal) => db.meals.add({ name: meal.name, mealType: meal.mealType ?? null, items: meal.items ?? [] });
export const deleteMeal = (id) => removeRow('meals', id);

// A saved meal is a template, like a library food: logging scales each item
// from the current library food when it still exists, else from the snapshot
// captured when the meal was saved.
export async function logMeal(mealId, { date, mealType }) {
  return db.transaction('rw', db.meals, db.foods, db.foodLogs, db.dailyTotals, async () => {
    const meal = await db.meals.get(mealId);
    if (!meal) throw new Error('Meal not found');
    for (const item of meal.items ?? []) {
      const library = item.foodId != null ? await db.foods.get(item.foodId) : null;
      const food = library ?? { name: item.foodName, brand: item.brand, ...item.foodSnapshot };
      await insertFoodLog(food, { foodId: item.foodId, date, mealType: mealType ?? meal.mealType ?? 'snack', quantity: item.quantity, unit: item.unit, computed: library ? undefined : item.computed });
    }
    return meal.items?.length ?? 0;
  });
}

export async function updateFoodLog(id, updates) {
  return db.transaction('rw', db.foodLogs, db.foods, db.dailyTotals, async () => {
    const old = await db.foodLogs.get(id);
    if (!old) throw new Error('Food log not found');
    await adjustDailyTotal(old.date, old.computed, -1);
    const next = { ...old, ...updates };
    if (updates.computed) next.computed = updates.computed;
    else {
      const foodId = updates.foodId ?? old.foodId;
      const food = old.foodSnapshot ? { ...old, ...old.foodSnapshot } : foodId != null ? await db.foods.get(foodId) : null;
      next.computed = food ? scaleNutrition(food, next.quantity, next.unit) : old.computed;
    }
    await db.foodLogs.put(next);
    await adjustDailyTotal(next.date, next.computed, 1);
  });
}

export async function deleteFoodLog(id) {
  return db.transaction('rw', db.foodLogs, db.dailyTotals, async () => {
    const old = await db.foodLogs.get(id);
    if (!old) return undefined;
    await db.foodLogs.delete(id);
    await adjustDailyTotal(old.date, old.computed, -1);
    return old;
  });
}

export async function restoreFoodLog(log) {
  return db.transaction('rw', db.foodLogs, db.dailyTotals, async () => {
    await db.foodLogs.put(log);
    await adjustDailyTotal(log.date, log.computed, 1);
  });
}

// Log calories/macros directly, without a library food (e.g. a restaurant meal).
export async function addQuickLog(input) {
  return db.transaction('rw', db.foodLogs, db.dailyTotals, async () => {
    const computed = addTotals(undefined, input.computed, 1);
    const id = await db.foodLogs.add({ foodId: null, quick: true, foodName: input.name || 'Quick add', brand: null, foodSnapshot: null, date: input.date, mealType: input.mealType, quantity: 1, unit: 'serving', computed });
    await adjustDailyTotal(input.date, computed, 1);
    return id;
  });
}

export const getCustomExercises = () => db.exercises.orderBy('name').toArray();
export const addExercise = (exercise) => db.exercises.add({ ...exercise, isCustom: true });
export const updateExercise = (id, updates) => db.exercises.update(id, updates);
export const deleteExercise = (id) => db.exercises.delete(id);
export const getWorkouts = () => db.workouts.orderBy('date').reverse().toArray();
export const getMuscleVolume = () => db.muscleVolume.orderBy('weekKey').reverse().toArray();

// Fields a workout row may carry besides date/sets — live sessions add cardio
// segments and timing. Anything else (a stray `track`, an `id`) is dropped.
const WORKOUT_EXTRAS = ['name', 'planId', 'startedAt', 'durationSeconds', 'movingSeconds', 'elevationGain', 'cardio', 'distance', 'routeId', 'routePreview'];
const workoutExtras = (input) => Object.fromEntries(WORKOUT_EXTRAS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));

// Must run inside a transaction covering workouts + exercises + muscleVolume + bodyweightLogs + profile.
async function insertWorkout(input, exercises) {
  const workout = { ...workoutExtras(input), date: input.date, sets: await normaliseSets(input.sets, exercises) };
  const id = await db.workouts.add(workout);
  await adjustMuscleVolume(workout.date, collectAttribution(workout.sets), 1);
  return id;
}

export async function addWorkout(input, exercises = []) {
  return db.transaction('rw', db.workouts, db.exercises, db.muscleVolume, db.bodyweightLogs, db.profile, () => insertWorkout(input, exercises));
}

// A finished live session: the workout (sets → muscleVolume as usual) plus its
// GPS track, written together so a run is never saved without its route.
export async function saveSessionWorkout({ workout, track }, exercises = []) {
  return db.transaction('rw', [db.workouts, db.exercises, db.muscleVolume, db.bodyweightLogs, db.profile, db.tracks, db.activeSession], async () => {
    const id = await insertWorkout(workout, exercises);
    if (track?.segments?.length) await db.tracks.add({ workoutId: id, activity: track.activity ?? 'run', segments: track.segments });
    await db.activeSession.clear();
    return id;
  });
}

export const getTrackForWorkout = (workoutId) => (workoutId == null ? undefined : db.tracks.where('workoutId').equals(workoutId).first());

export async function updateWorkout(id, updates, exercises = []) {
  return db.transaction('rw', db.workouts, db.exercises, db.muscleVolume, db.bodyweightLogs, db.profile, async () => {
    const old = await db.workouts.get(id);
    if (!old) throw new Error('Workout not found');
    await adjustMuscleVolume(old.date, collectAttribution(old.sets), -1);
    const next = { ...old, ...updates, sets: await normaliseSets(updates.sets ?? old.sets, exercises) };
    await db.workouts.put(next);
    await adjustMuscleVolume(next.date, collectAttribution(next.sets), 1);
  });
}

// Returns the removed workout with its GPS track (if any) attached as `track`,
// so Undo can put both back.
export async function deleteWorkout(id) {
  return db.transaction('rw', db.workouts, db.muscleVolume, db.tracks, async () => {
    const old = await db.workouts.get(id);
    if (!old) return undefined;
    const track = await db.tracks.where('workoutId').equals(id).first();
    await db.workouts.delete(id);
    if (track) await db.tracks.delete(track.id);
    await adjustMuscleVolume(old.date, collectAttribution(old.sets), -1);
    return track ? { ...old, track } : old;
  });
}

// Restores with the original frozen attribution, not a recomputation.
export async function restoreWorkout({ track, ...workout }) {
  return db.transaction('rw', db.workouts, db.muscleVolume, db.tracks, async () => {
    await db.workouts.put(workout);
    if (track) await db.tracks.put(track);
    await adjustMuscleVolume(workout.date, collectAttribution(workout.sets), 1);
  });
}

// ---- Workout plans ----
// Stored in `templates` (the table predates plans). Rows saved before blocks
// existed are `{ name, sets }`; normalizePlan() reads both shapes.
export const getPlans = async () => (await db.templates.orderBy('name').toArray()).map(normalizePlan);
export const addPlan = (plan) => {
  const { id: _id, ...clean } = normalizePlan(plan);
  return db.templates.add({ ...clean, createdAt: new Date().toISOString() });
};
export const updatePlan = (id, plan) => {
  const { id: _id, ...clean } = normalizePlan(plan);
  return db.templates.put({ ...clean, id, updatedAt: new Date().toISOString() });
};
export const deletePlan = (id) => removeRow('templates', id);

// ---- Routes (planned on the map) ----
// { name, waypoints: [[lat, lon]], path: [[lat, lon]], distance (m), followPaths }
export const getRoutes = () => db.routes.orderBy('name').toArray();
const cleanRoute = (route) => ({
  name: String(route.name ?? '').trim() || 'Route',
  waypoints: route.waypoints ?? [],
  path: route.path ?? [],
  distance: Math.round(Number(route.distance) || 0),
  followPaths: Boolean(route.followPaths)
});
export const addRoute = (route) => db.routes.add({ ...cleanRoute(route), createdAt: new Date().toISOString() });
export const updateRoute = (id, route) => db.routes.update(id, cleanRoute(route));
export const deleteRoute = (id) => removeRow('routes', id);

// ---- The live session in progress (singleton, id 1) ----
export const hasActiveSession = () => db.activeSession.count();
export const getActiveSession = () => db.activeSession.get(1);
export const saveActiveSession = (state) => db.activeSession.put({ ...state, id: 1, savedAt: Date.now() });
export const clearActiveSession = () => db.activeSession.clear();

export const getBodyweightLogs = () => db.bodyweightLogs.orderBy('date').toArray();
export const addBodyweightLog = (row) => db.bodyweightLogs.add({ date: row.date, weight: Number(row.weight) });
export const deleteBodyweightLog = (id) => removeRow('bodyweightLogs', id);
export const getGoals = () => db.goals.orderBy('type').toArray();
export const addGoal = (goal) => db.goals.add(goal);
export const updateGoal = (id, updates) => db.goals.update(id, updates);
export const deleteGoal = (id) => removeRow('goals', id);

export async function exportData() {
  const payload = { version: 4, exportedAt: new Date().toISOString() };
  for (const table of TABLES) payload[table] = await db[table].toArray();
  return payload;
}

const key = (id) => String(id);

export function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('This file is not a Finesse Fit backup.');
  const known = TABLES.filter((table) => Array.isArray(data[table]));
  if (!known.length) throw new Error('This file does not contain any Finesse Fit tables.');
  const bad = TABLES.find((table) => data[table] != null && !Array.isArray(data[table]));
  if (bad) throw new Error(`"${bad}" should be a list.`);
  return known.reduce((counts, table) => ({ ...counts, [table]: data[table].length }), {});
}

export async function importData(data, mode = 'merge') {
  validateImport(data);
  return db.transaction('rw', ...TABLES.map((table) => db[table]), async () => {
    if (mode === 'replace') await Promise.all(TABLES.map((table) => db[table].clear()));
    // Keys are stringified: ids may round-trip as numbers or strings depending on where they were stored.
    const foodMap = new Map();
    const exerciseMap = new Map();
    const routeMap = new Map();
    const planMap = new Map();
    const workoutMap = new Map();
    const remapExercise = (id) => exerciseMap.get(key(id)) ?? id;
    const remap = (map, id) => (id == null ? id : map.get(key(id)) ?? id);
    if (data.profile?.[0]) await db.profile.put({ ...DEFAULT_PROFILE, ...data.profile[0], id: 1, onboarded: true });
    else if (mode === 'replace') await db.profile.put(DEFAULT_PROFILE);
    for (const food of data.foods ?? []) foodMap.set(key(food.id), await db.foods.add(stripId(food)));
    for (const exercise of data.exercises ?? []) exerciseMap.set(key(exercise.id), await db.exercises.add(stripId(exercise)));
    for (const route of data.routes ?? []) routeMap.set(key(route.id), await db.routes.add(stripId(route)));
    for (const row of data.templates ?? []) {
      const plan = stripId(row);
      const blocks = plan.blocks?.map((block) => ({
        ...block,
        ...(block.exerciseId != null ? { exerciseId: remapExercise(block.exerciseId) } : {}),
        ...(block.items ? { items: block.items.map((item) => ({ ...item, exerciseId: remapExercise(item.exerciseId) })) } : {}),
        ...(block.routeId != null ? { routeId: remap(routeMap, block.routeId) } : {})
      }));
      const sets = plan.sets?.map((set) => ({ ...set, exerciseId: remapExercise(set.exerciseId) }));
      planMap.set(key(row.id), await db.templates.add({ ...plan, ...(blocks ? { blocks } : {}), ...(sets ? { sets } : {}) }));
    }
    for (const row of data.foodLogs ?? []) await db.foodLogs.add({ ...stripId(row), foodId: foodMap.get(key(row.foodId)) ?? row.foodId });
    for (const row of data.dailyTotals ?? []) {
      const existing = await db.dailyTotals.where('date').equals(row.date).first();
      if (existing) await db.dailyTotals.update(existing.id, addTotals(existing, row, 1));
      else await db.dailyTotals.add(stripId(row));
    }
    for (const row of data.workouts ?? []) {
      const sets = (row.sets ?? []).map((set) => ({ ...set, exerciseId: remapExercise(set.exerciseId) }));
      const extras = { ...(row.planId != null ? { planId: remap(planMap, row.planId) } : {}), ...(row.routeId != null ? { routeId: remap(routeMap, row.routeId) } : {}) };
      workoutMap.set(key(row.id), await db.workouts.add({ ...stripId(row), ...extras, sets }));
    }
    // A track whose workout isn't in the backup has nothing to belong to.
    for (const row of data.tracks ?? []) {
      if (workoutMap.has(key(row.workoutId))) await db.tracks.add({ ...stripId(row), workoutId: workoutMap.get(key(row.workoutId)) });
    }
    for (const row of data.muscleVolume ?? []) {
      const existing = await db.muscleVolume.where('muscle').equals(row.muscle).and((item) => item.weekKey === row.weekKey).first();
      if (existing) await db.muscleVolume.update(existing.id, { volume: Math.max(0, round((existing.volume ?? 0) + (row.volume ?? 0), 1)) });
      else await db.muscleVolume.add(stripId(row));
    }
    for (const row of data.bodyweightLogs ?? []) await db.bodyweightLogs.add(stripId(row));
    for (const row of data.meals ?? []) {
      await db.meals.add({ ...stripId(row), items: (row.items ?? []).map((item) => ({ ...item, foodId: foodMap.get(key(item.foodId)) ?? item.foodId })) });
    }
    for (const row of data.goals ?? []) await db.goals.add(row.exerciseId == null ? stripId(row) : { ...stripId(row), exerciseId: remapExercise(row.exerciseId) });
  });
}

const ALL_TABLES = [...TABLES, ...BINARY_TABLES, ...DEVICE_TABLES];
export const clearAllData = () => db.transaction('rw', ALL_TABLES.map((table) => db[table]), async () => {
  await Promise.all(ALL_TABLES.map((table) => db[table].clear()));
  await db.profile.put(DEFAULT_PROFILE);
});

// ---- Progress photos ----
// Not part of exportData()/importData(): raw image bytes don't belong in a
// JSON backup, and BINARY_TABLES keeps that boundary in one place. Deleted
// only by removePhoto() or a full reset.
export const getProgressPhotos = () => db.photos.orderBy('date').toArray();

export async function addProgressPhoto({ date, full, thumb, width, height }) {
  return db.photos.add({ date, full, thumb, width, height, createdAt: new Date().toISOString() });
}

export const deleteProgressPhoto = (id) => removeRow('photos', id);
