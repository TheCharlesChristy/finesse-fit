import { addDays, addWeeks, format, getISOWeek, getISOWeekYear, isValid, parseISO, startOfISOWeek } from 'date-fns';
import { fmtClock, fmtDistance, fmtPace, paceOf } from './geo.js';

export const SECONDARY_WEIGHT = 0.5;
export const KG_TO_LB = 2.2046226218;
export const CM_TO_IN = 0.3937007874;
// Macros have targets; fibre/sugar/salt are tracked for information only.
export const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'salt'];
export const EXTRA_NUTRIENTS = [
  { key: 'fibre', label: 'Fibre' },
  { key: 'sugar', label: 'Sugar' },
  { key: 'salt', label: 'Salt' }
];
const NUTRIENT_PLACES = { calories: 0, salt: 2 };
export const EMPTY_TOTALS = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]));
// Only read for profiles saved before body-composition targets existed.
export const DEFAULT_GOAL_MIX = { fatLoss: 45, muscleGain: 55, performance: 45, health: 50 };
// No current body-fat reading is stored, so a body-fat target is judged against
// what's typical for the user's sex (the midpoint when sex isn't set).
export const TYPICAL_BODY_FAT = { male: 20, female: 28 };
const TYPICAL_BODY_FAT_UNSET = 24;
const DEFAULT_AGE = 30;

// Ranked by the user, most important first. RANK_WEIGHTS gives the top pick the most say.
export const TRAINING_PRIORITIES = [
  { id: 'size', label: 'Muscle size', effect: 'The most protein, to build muscle' },
  { id: 'strength', label: 'Strength', effect: 'More protein for heavy training' },
  { id: 'health', label: 'General health', effect: 'More healthy fats, a gentler pace' },
  { id: 'endurance', label: 'Endurance', effect: 'Extra calories and carbs for fuel' }
];
export const DEFAULT_PRIORITIES = TRAINING_PRIORITIES.map((priority) => priority.id);
const RANK_WEIGHTS = [0.4, 0.3, 0.2, 0.1];

// Training days set the Mifflin-St Jeor activity multiplier.
export const TRAINING_DAYS = [
  { id: '0-1', label: '0–1', activity: 1.2 },
  { id: '2-3', label: '2–3', activity: 1.375 },
  { id: '4-5', label: '4–5', activity: 1.55 },
  { id: '6+', label: '6+', activity: 1.725 }
];
export const DEFAULT_TRAINING_DAYS = '2-3';

const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round(number(value) * factor) / factor;
};

export function dateKey(date = new Date()) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const value = typeof date === 'string' ? parseISO(date) : date;
  return format(value, 'yyyy-MM-dd');
}

export function weekKey(date = new Date()) {
  const value = typeof date === 'string' ? parseISO(date) : date;
  return `${getISOWeekYear(value)}-W${String(getISOWeek(value)).padStart(2, '0')}`;
}

export function shiftWeekKey(key, weeks) {
  const [year, week] = key.split('-W').map(Number);
  // Jan 4th is always in ISO week 1.
  const monday = addWeeks(startOfISOWeek(new Date(year, 0, 4)), week - 1 + weeks);
  return weekKey(monday);
}

export function weekDays(key) {
  const [year, week] = key.split('-W').map(Number);
  const monday = addWeeks(startOfISOWeek(new Date(year, 0, 4)), week - 1);
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(monday, i)));
}

export function weekLabel(key) {
  const days = weekDays(key);
  return `${fmtDate(days[0], 'd MMM')} – ${fmtDate(days[6], 'd MMM')}`;
}

export function lastNDays(n, from = new Date()) {
  return Array.from({ length: n }, (_, i) => dateKey(addDays(from, i - n + 1)));
}

export function fmtDate(date, pattern = 'EEE d MMM') {
  if (!date) return '';
  const value = typeof date === 'string' ? parseISO(date) : date;
  return isValid(value) ? format(value, pattern) : String(date);
}

export function fmtRelativeDay(date, today = dateKey()) {
  const key = dateKey(date);
  if (key === today) return 'Today';
  if (key === dateKey(addDays(parseISO(today), -1))) return 'Yesterday';
  return fmtDate(key);
}

export function mealForTime(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}

export function servingLabel(food) {
  const serving = food?.servings?.[0];
  if (!serving) return 'serving';
  const grams = round(serving.grams, 0);
  return /\d/.test(serving.label ?? '') ? serving.label : `${serving.label || 'serving'} (${grams} g)`;
}

export function scaleNutrition(food, quantity, unit) {
  if (!food?.per100) return { ...EMPTY_TOTALS };
  const qty = Math.max(0, number(quantity));
  const serving = food.servings?.[0] ?? { grams: 100 };
  const grams = unit === 'serving' ? qty * number(serving.grams, 100) : qty;
  const factor = grams / 100;
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, round(number(food.per100[key]) * factor, NUTRIENT_PLACES[key] ?? 1)]));
}

export function addTotals(a = EMPTY_TOTALS, b = EMPTY_TOTALS, sign = 1) {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, Math.max(0, round(number(a?.[key]) + number(b?.[key]) * sign, NUTRIENT_PLACES[key] ?? 1))]));
}

// Bodyweight movements (pull-ups, dips…) load the body plus any added weight;
// without this they would contribute zero volume to the muscle map.
export function setLoad(set, exercise, bodyweight = 0) {
  const weight = number(set?.weight);
  return exercise?.equipment === 'bodyweight' ? weight + number(bodyweight) : weight;
}

export function setVolume(set, load = set?.weight) {
  return round(number(set?.reps) * number(load), 1);
}

export function attributeVolume(exercise, volume) {
  const result = {};
  const add = (muscle, amount) => {
    if (!muscle) return;
    result[muscle] = round((result[muscle] ?? 0) + amount, 1);
  };
  for (const muscle of exercise?.primaryMuscles ?? []) add(muscle, volume);
  for (const muscle of exercise?.secondaryMuscles ?? []) add(muscle, volume * SECONDARY_WEIGHT);
  return result;
}

export function estimateOneRepMax(weight, reps) {
  const r = number(reps);
  if (r <= 0) return 0;
  // Epley overestimates a true single; a 1-rep set is its own max.
  return r === 1 ? round(weight, 1) : round(number(weight) * (1 + r / 30), 1);
}

export function bestSetsByDate(workouts = [], exerciseId) {
  const byDate = new Map();
  for (const workout of workouts) {
    const key = dateKey(workout.date);
    for (const set of workout.sets ?? []) {
      if (String(set.exerciseId) !== String(exerciseId)) continue;
      const e1rm = estimateOneRepMax(set.weight, set.reps);
      const best = byDate.get(key);
      if (!best || e1rm > best.e1rm) byDate.set(key, { date: key, e1rm, weight: number(set.weight), reps: number(set.reps) });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function summariseSets(sets = []) {
  const groups = new Map();
  for (const set of sets) {
    const key = String(set.exerciseId);
    const group = groups.get(key) ?? { exerciseId: set.exerciseId, sets: 0, best: null };
    group.sets += 1;
    if (!group.best || estimateOneRepMax(set.weight, set.reps) > estimateOneRepMax(group.best.weight, group.best.reps)) group.best = set;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function toDisplayWeight(kg, units = 'metric') {
  return units === 'imperial' ? round(number(kg) * KG_TO_LB, 1) : round(kg, 1);
}

export function fromDisplayWeight(value, units = 'metric') {
  return units === 'imperial' ? round(number(value) / KG_TO_LB, 2) : round(value, 2);
}

export function toDisplayHeight(cm, units = 'metric') {
  return units === 'imperial' ? round(number(cm) * CM_TO_IN, 1) : round(cm, 0);
}

export function fromDisplayHeight(value, units = 'metric') {
  return units === 'imperial' ? round(number(value) / CM_TO_IN, 1) : round(value, 1);
}

export function fromFeetInches(feet, inches) {
  return round((number(feet) * 12 + number(inches)) / CM_TO_IN, 1);
}

export function toFeetInches(cm) {
  const total = Math.max(0, toDisplayHeight(cm, 'imperial'));
  const feet = Math.floor(total / 12);
  return { feet, inches: round(total - feet * 12, 1) };
}

export function normalizeGoalMix(goalMix = {}) {
  return {
    fatLoss: Math.max(0, Math.min(100, number(goalMix.fatLoss, DEFAULT_GOAL_MIX.fatLoss))),
    muscleGain: Math.max(0, Math.min(100, number(goalMix.muscleGain, DEFAULT_GOAL_MIX.muscleGain))),
    performance: Math.max(0, Math.min(100, number(goalMix.performance, DEFAULT_GOAL_MIX.performance))),
    health: Math.max(0, Math.min(100, number(goalMix.health, DEFAULT_GOAL_MIX.health)))
  };
}

// Target body fat is optional: blank (null/'') stays null rather than being defaulted.
export function normalizeBodyCompositionTargets(profile = {}) {
  const bodyweight = Math.max(35, number(profile.bodyweight, 78));
  const bodyFat = profile.targetBodyFat === '' || profile.targetBodyFat == null ? NaN : Number(profile.targetBodyFat);
  return {
    targetBodyweight: Math.max(35, number(profile.targetBodyweight, bodyweight)),
    targetBodyFat: Number.isFinite(bodyFat) ? Math.max(3, Math.min(60, bodyFat)) : null
  };
}

// Keeps known ids in the user's order, drops duplicates/unknowns and appends any missing priority.
export function normalizePriorities(priorities) {
  const ranked = [...new Set((Array.isArray(priorities) ? priorities : []).filter((id) => DEFAULT_PRIORITIES.includes(id)))];
  return [...ranked, ...DEFAULT_PRIORITIES.filter((id) => !ranked.includes(id))];
}

export function normalizeTrainingDays(id) {
  return TRAINING_DAYS.some((option) => option.id === id) ? id : DEFAULT_TRAINING_DAYS;
}

export const priorityLabel = (id) => TRAINING_PRIORITIES.find((priority) => priority.id === id)?.label ?? id;
export const trainingDaysLabel = (id) => TRAINING_DAYS.find((option) => option.id === id)?.label ?? id;

export function ageFromBirthYear(birthYear, today = new Date()) {
  if (birthYear == null || birthYear === '' || !Number.isFinite(Number(birthYear))) return null;
  const year = (typeof today === 'string' ? parseISO(today) : today).getFullYear();
  return year - Number(birthYear);
}

// Mifflin-St Jeor BMR × the training-days activity multiplier. Missing sex uses
// the midpoint of the male/female constants; missing age uses DEFAULT_AGE.
export function estimateMaintenanceCalories(profile = {}, today = new Date()) {
  const weight = Math.max(35, number(profile.bodyweight, 78));
  const heightCm = Math.max(120, number(profile.height, 178));
  const age = Math.max(13, Math.min(100, ageFromBirthYear(profile.birthYear, today) ?? DEFAULT_AGE));
  const sexConstant = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * heightCm - 5 * age + sexConstant;
  const activity = TRAINING_DAYS.find((option) => option.id === normalizeTrainingDays(profile.trainingDays)).activity;
  return Math.round(bmr * activity);
}

// { direction: 'lose' | 'gain' | 'maintain', kg } — the absolute change the target bodyweight asks for.
export function compositionGoal(profile = {}) {
  const weight = Math.max(35, number(profile.bodyweight, 78));
  const delta = round(normalizeBodyCompositionTargets(profile).targetBodyweight - weight, 1);
  if (Math.abs(delta) < 0.5) return { direction: 'maintain', kg: 0 };
  return { direction: delta < 0 ? 'lose' : 'gain', kg: Math.abs(delta) };
}

export function calculateNutritionTargets(profile = {}, today = new Date()) {
  const weight = Math.max(35, number(profile.bodyweight, 78));
  // The target bodyweight sets direction and pace; an optional body-fat target
  // nudges towards a deficit or surplus. Profiles saved before composition
  // targets existed fall back to the old fatLoss/muscleGain blend.
  const hasCompositionTargets = profile.targetBodyweight != null || profile.targetBodyFat != null;
  const composition = normalizeBodyCompositionTargets({ ...profile, bodyweight: weight });
  const weightDelta = composition.targetBodyweight - weight;
  const weightIntensity = Math.min(1, Math.abs(weightDelta) / Math.max(weight * 0.15, 1));
  const typicalBodyFat = TYPICAL_BODY_FAT[profile.sex] ?? TYPICAL_BODY_FAT_UNSET;
  const bodyFatBias = composition.targetBodyFat == null ? 0 : Math.max(-1, Math.min(1, (typicalBodyFat - composition.targetBodyFat) / 10));
  const mix = normalizeGoalMix(profile.goalMix);
  const fatLoss = hasCompositionTargets
    ? Math.max(0, Math.min(1, (weightDelta < 0 ? weightIntensity : 0) + Math.max(0, bodyFatBias) * 0.35))
    : mix.fatLoss / 100;
  const muscleGain = hasCompositionTargets
    ? Math.max(0, Math.min(1, (weightDelta > 0 ? weightIntensity : 0) + Math.max(0, -bodyFatBias) * 0.35))
    : mix.muscleGain / 100;

  const ranked = normalizePriorities(profile.priorities);
  const [size, strength, health, endurance] = DEFAULT_PRIORITIES.map((id) => RANK_WEIGHTS[ranked.indexOf(id)]);

  // Health slows the pace of a cut or bulk. Endurance is the only priority that
  // adds calories (0–3% extra fuel above last place), so choosing to maintain
  // weight lands on maintenance; size and strength shape protein instead.
  const goalShift = (muscleGain * 0.12 - fatLoss * 0.2) * (1 - health * 0.5);
  const calorieShift = goalShift + (endurance - RANK_WEIGHTS.at(-1)) * 0.1;
  const floor = profile.sex === 'female' ? 1200 : profile.sex === 'male' ? 1500 : 1350;
  const calories = Math.max(floor, Math.round((estimateMaintenanceCalories(profile, today) * (1 + calorieShift)) / 25) * 25);

  // Protein and fat scale with the lighter of current and target weight, so a
  // large cut doesn't set protein from weight the user is trying to lose.
  const leanBasis = Math.min(weight, composition.targetBodyweight);
  const proteinFactor = Math.min(2.4, 1.6 + fatLoss * 0.3 + muscleGain * 0.2 + size * 0.5 + strength * 0.4);
  const protein = Math.round(leanBasis * proteinFactor);
  const fat = Math.round(Math.max(leanBasis * (0.7 + health * 0.5), (calories * (0.2 + health * 0.25)) / 9));
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export function fmtCalories(value) {
  return `${Math.round(number(value)).toLocaleString()} kcal`;
}

export function fmtCompact(value) {
  const n = number(value);
  return Math.abs(n) >= 10_000 ? `${round(n / 1000, 1).toLocaleString()}k` : Math.round(n).toLocaleString();
}

export function fmtMacro(value) {
  return `${round(value, 0).toLocaleString()} g`;
}

export function fmtWeight(value, units = 'metric') {
  return `${toDisplayWeight(value, units).toLocaleString()} ${units === 'imperial' ? 'lb' : 'kg'}`;
}

export function fmtHeight(value, units = 'metric') {
  if (units === 'imperial') {
    const { feet, inches } = toFeetInches(value);
    return `${feet} ft ${inches} in`;
  }
  return `${toDisplayHeight(value, units).toLocaleString()} cm`;
}

export function percent(current, target) {
  const t = number(target);
  return t <= 0 ? 0 : Math.min(999, Math.round((number(current) / t) * 100));
}

export const NUTRITION_WINDOW_DAYS = 14;

// A day "hits" a macro when it lands near the profile target. Protein is a
// floor (more is fine); calories, carbs and fat are a ±10% band.
export function hitsTarget(metric, value, target) {
  const t = number(target);
  const v = number(value);
  if (t <= 0 || v <= 0) return false;
  return metric === 'protein' ? v >= t * 0.9 : v >= t * 0.9 && v <= t * 1.1;
}

export function goalProgress(goal, data = {}) {
  const target = number(goal?.target);
  let current = 0;
  let ratio = 0;
  if (goal?.type === 'bodyweight') {
    const logs = (data.bodyweightLogs ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    // Smoothed trend, so one salty-dinner weigh-in doesn't flip the goal status.
    current = number(weightTrend(logs).at(-1)?.trend);
    const start = number(logs[0]?.weight);
    const down = goal.direction === 'down';
    if (!logs.length) ratio = 0;
    else if (down ? current <= target : current >= target) ratio = 1;
    else if (start === target || (down ? start < target : start > target)) ratio = 0;
    else ratio = (start - current) / (start - target);
  } else if (goal?.type === 'volume') {
    const wk = weekKey();
    current = number(data.muscleVolume?.find((row) => row.muscle === goal.muscle && row.weekKey === wk)?.volume);
    ratio = target > 0 ? current / target : 0;
  } else if (goal?.type === 'nutrition') {
    const metric = goal.metric || 'calories';
    const days = new Set(lastNDays(NUTRITION_WINDOW_DAYS));
    const dailyTarget = data.profile?.targets?.[metric];
    current = data.dailyTotals?.filter((row) => days.has(row.date) && hitsTarget(metric, row[metric], dailyTarget)).length ?? 0;
    ratio = target > 0 ? current / target : 0;
  } else if (goal?.type === 'strength') {
    current = data.workouts?.flatMap((workout) => workout.sets ?? [])
      .filter((set) => String(set.exerciseId) === String(goal.exerciseId))
      .reduce((best, set) => Math.max(best, estimateOneRepMax(set.weight, set.reps)), 0) ?? 0;
    ratio = target > 0 ? current / target : 0;
  }
  ratio = Math.max(0, ratio);
  const status = ratio >= 1 ? 'achieved' : ratio >= 0.7 ? 'on-track' : 'behind';
  return { current: round(current, 1), target, pct: Math.min(100, Math.round(ratio * 100)), status };
}

// Projects a bodyweight goal forward from the current 4-week rate: divide the
// distance left by the weekly rate, the way a savings goal divides what's left
// by the payment per period. Returns null for every other goal type — there's
// no meaningful trend to project a strength or volume number from week to week.
export function goalEta(goal, data = {}, today = dateKey()) {
  if (goal?.type !== 'bodyweight') return null;
  const logs = data.bodyweightLogs ?? [];
  const target = number(goal?.target);
  const current = number(weightTrend(logs).at(-1)?.trend);
  if (!(current > 0) || !(target > 0)) return null;
  const down = goal.direction === 'down';
  const remaining = down ? current - target : target - current;
  if (remaining <= 0) return { weeks: 0, date: today, onTrack: true };

  const rate = weightRatePerWeek(logs, { today });
  // No trustworthy rate yet, or it's moving the wrong way — no honest ETA to give.
  if (rate == null || (down ? rate >= 0 : rate <= 0)) return { weeks: null, date: null, onTrack: false };

  const weeks = remaining / Math.abs(rate);
  return { weeks: Math.ceil(weeks), date: dateKey(addWeeks(parseISO(today), weeks)), onTrack: true };
}

export const GOAL_STATUS = {
  achieved: { label: 'Achieved', className: 'status-good' },
  'on-track': { label: 'On track', className: 'status-warn' },
  behind: { label: 'Behind', className: 'status-danger' }
};

export function goalValueLabel(goal, value, units = 'metric') {
  if (goal?.type === 'strength' || goal?.type === 'bodyweight') return fmtWeight(value, units);
  if (goal?.type === 'nutrition') return `${round(value, 0)} days`;
  return `${Math.round(number(value)).toLocaleString()} vol`;
}

export function goalDescription(goal, exercises = []) {
  if (goal?.type === 'strength') return `Estimated 1RM · ${exerciseName(exercises, goal.exerciseId)}`;
  if (goal?.type === 'bodyweight') return goal.direction === 'down' ? 'Bodyweight · lose to target' : 'Bodyweight · gain to target';
  if (goal?.type === 'volume') return `Weekly volume · ${muscleLabel(goal.muscle)}`;
  if (goal?.type === 'nutrition') return `Days hitting ${goal.metric || 'calories'} target · last ${NUTRITION_WINDOW_DAYS} days`;
  return 'Goal';
}

export function muscleLabel(muscle = '') {
  const text = muscle.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function mealLabel(mealType) {
  return ({ breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' })[mealType] ?? 'Meal';
}

export function exerciseName(exercises, id) {
  return exercises.find((exercise) => String(exercise.id) === String(id))?.name ?? 'Deleted exercise';
}

// ---- Training history ----

const setE1rm = (set) => (number(set?.weight) > 0 ? estimateOneRepMax(set.weight, set.reps) : 0);

// Most recent earlier session containing the exercise (excluding the workout being edited).
export function lastSessionFor(workouts = [], exerciseId, { excludeId, beforeDate } = {}) {
  const candidates = workouts
    .filter((workout) => workout.id !== excludeId && (!beforeDate || dateKey(workout.date) <= beforeDate))
    .sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)) || (b.id ?? 0) - (a.id ?? 0));
  for (const workout of candidates) {
    const sets = (workout.sets ?? []).filter((set) => String(set.exerciseId) === String(exerciseId));
    if (sets.length) return { date: dateKey(workout.date), sets };
  }
  return null;
}

// Best loaded e1RM per exercise across workouts, optionally skipping one workout.
export function bestE1rmByExercise(workouts = [], { excludeId } = {}) {
  const best = new Map();
  for (const workout of workouts) {
    if (workout.id === excludeId) continue;
    for (const set of workout.sets ?? []) {
      const e1rm = setE1rm(set);
      const key = String(set.exerciseId);
      if (e1rm > (best.get(key) ?? 0)) best.set(key, e1rm);
    }
  }
  return best;
}

// Exercises in `sets` whose best e1RM beats all previous history. A first-ever
// log isn't a PR — there's nothing to beat yet.
export function findPersonalRecords(workouts = [], sets = [], { excludeId } = {}) {
  const previous = bestE1rmByExercise(workouts, { excludeId });
  const records = new Map();
  for (const set of sets) {
    const key = String(set.exerciseId);
    const e1rm = setE1rm(set);
    const before = previous.get(key);
    if (!before || e1rm <= before) continue;
    if (e1rm > (records.get(key)?.e1rm ?? 0)) records.set(key, { exerciseId: set.exerciseId, e1rm, previous: before, set });
  }
  return [...records.values()];
}

// Workout id → exercise ids that set a PR in that session, replaying history in date order.
export function personalRecordsByWorkout(workouts = []) {
  const ordered = workouts.slice().sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || (a.id ?? 0) - (b.id ?? 0));
  const best = new Map();
  const result = new Map();
  for (const workout of ordered) {
    const sessionBest = new Map();
    for (const set of workout.sets ?? []) {
      const key = String(set.exerciseId);
      sessionBest.set(key, Math.max(sessionBest.get(key) ?? 0, setE1rm(set)));
    }
    const prs = new Set();
    for (const [key, e1rm] of sessionBest) {
      if (best.has(key) && e1rm > best.get(key)) prs.add(key);
      if (e1rm > 0) best.set(key, Math.max(best.get(key) ?? 0, e1rm));
    }
    if (prs.size) result.set(workout.id, prs);
  }
  return result;
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.ceil(number(seconds)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- Meals ----

export function sumComputed(items = []) {
  return items.reduce((total, item) => addTotals(total, item.computed), { ...EMPTY_TOTALS });
}

export function mealItemsFromLogs(logs = []) {
  return logs.map((log) => ({
    foodId: log.foodId,
    foodName: log.foodName,
    brand: log.brand ?? null,
    foodSnapshot: log.foodSnapshot,
    quantity: log.quantity,
    unit: log.unit,
    computed: log.computed
  }));
}

// ---- Backups ----

export const BACKUP_REMINDER_DAYS = 14;

// Returns how many days of data are unprotected, or null when no reminder is due.
export function backupReminder({ lastExportAt, snoozedUntil, firstActivityDate, today = dateKey() }) {
  if (!firstActivityDate) return null;
  if (snoozedUntil && today < snoozedUntil) return null;
  const daysSince = (from) => Math.floor((parseISO(today) - parseISO(dateKey(from))) / 86_400_000);
  if (lastExportAt) {
    const days = daysSince(lastExportAt);
    return days >= BACKUP_REMINDER_DAYS ? { days, neverExported: false } : null;
  }
  const days = daysSince(firstActivityDate);
  return days >= 3 ? { days, neverExported: true } : null;
}

export function snoozeUntil(days, from = new Date()) {
  return dateKey(addDays(from, days));
}

export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

export function shiftDay(key, days) {
  return dateKey(addDays(parseISO(key), days));
}

export function groupLogsByMeal(logs = []) {
  return MEAL_ORDER
    .map((meal) => {
      const items = logs.filter((log) => log.mealType === meal);
      return { meal, logs: items, calories: items.reduce((sum, log) => sum + number(log.computed?.calories), 0) };
    })
    .filter((group) => group.logs.length);
}

// ---- Bodyweight trend ----

export const TREND_WINDOW_DAYS = 7;

const dayDiff = (a, b) => Math.round((parseISO(dateKey(b)) - parseISO(dateKey(a))) / 86_400_000);

// Each weigh-in gets the average of all weigh-ins in the trailing 7 days.
export function weightTrend(logs = [], windowDays = TREND_WINDOW_DAYS) {
  const sorted = logs.slice().sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)));
  return sorted.map((log, index) => {
    const window = sorted.slice(0, index + 1).filter((item) => dayDiff(item.date, log.date) < windowDays);
    return { ...log, trend: round(window.reduce((sum, item) => sum + number(item.weight), 0) / window.length, 2) };
  });
}

// Least-squares slope of weight over time within the last `days`, in kg per week.
export function weightRatePerWeek(logs = [], { days = 28, today = dateKey() } = {}) {
  const points = logs
    .filter((log) => dayDiff(log.date, today) < days && dayDiff(log.date, today) >= 0)
    .map((log) => ({ x: -dayDiff(log.date, today), y: number(log.weight) }));
  if (points.length < 3) return null;
  const span = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  if (span < 7) return null;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const numerator = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  const denominator = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  return denominator ? round((numerator / denominator) * 7, 2) : null;
}

// ---- Adaptive energy estimate ----

export const KCAL_PER_KG = 7700;
export const TDEE_WINDOW_DAYS = 28;

// Estimates real maintenance calories from logged intake and the bodyweight
// trend: if you ate X on average and lost Y kg/week, maintenance ≈ X + Y·7700/7.
// Today is excluded because it's usually only partly logged.
export function estimateTdee({ dailyTotals = [], bodyweightLogs = [], today = dateKey(), days = TDEE_WINDOW_DAYS } = {}) {
  const window = new Set(lastNDays(days, addDays(parseISO(today), -1)));
  const logged = dailyTotals.filter((row) => window.has(row.date) && number(row.calories) >= 800);
  const rate = weightRatePerWeek(bodyweightLogs, { days, today });
  const needs = { loggedDays: logged.length, minLoggedDays: 14, weighIns: bodyweightLogs.filter((log) => window.has(dateKey(log.date)) || dateKey(log.date) === today).length, minWeighIns: 3 };
  if (logged.length < needs.minLoggedDays || rate == null) return { ready: false, ...needs };
  const avgIntake = logged.reduce((sum, row) => sum + number(row.calories), 0) / logged.length;
  const tdee = Math.round((avgIntake - (rate * KCAL_PER_KG) / 7) / 25) * 25;
  return { ready: true, ...needs, tdee, avgIntake: Math.round(avgIntake), kgPerWeek: rate, confidence: logged.length >= 24 ? 'good' : 'rough' };
}

export function caloriesForRate(tdee, kgPerWeek) {
  return Math.round((tdee + (kgPerWeek * KCAL_PER_KG) / 7) / 25) * 25;
}

// Change calories but keep protein and fat, letting carbs absorb the difference.
export function retargetCalories(targets = {}, calories) {
  const protein = number(targets.protein);
  const fat = number(targets.fat);
  return { ...targets, calories, carbs: Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)) };
}

// ---- Training suggestions ----

const LOWER_BODY = new Set(['quads', 'glutes', 'hamstrings', 'calves', 'adductors', 'abductors', 'hip_flexors']);

// Double-progression rule of thumb: if every set of last session hit its reps
// without grinding (RPE ≤ 8 when recorded), add a small jump; otherwise repeat.
export function suggestProgression(last, exercise, units = 'metric') {
  if (!last?.sets?.length) return null;
  const sets = last.sets;
  const rpes = sets.map((set) => set.rpe).filter((rpe) => rpe != null && rpe !== '');
  const grinding = rpes.some((rpe) => number(rpe) >= 9);
  const targetReps = number(sets[0].reps);
  const heldReps = sets.every((set) => number(set.reps) >= targetReps);
  const easy = rpes.length ? rpes.every((rpe) => number(rpe) <= 8) : heldReps;
  if (sets.every((set) => !number(set.weight))) {
    return easy && !grinding ? { kind: 'reps', delta: 1, label: '+1 rep' } : { kind: 'repeat', label: 'Repeat' };
  }
  if (!easy || grinding) return { kind: 'repeat', label: 'Repeat' };
  const lower = (exercise?.primaryMuscles ?? []).some((muscle) => LOWER_BODY.has(muscle));
  const step = units === 'imperial' ? (lower ? 10 : 5) / KG_TO_LB : lower ? 5 : 2.5;
  return { kind: 'weight', delta: round(step, 3), label: `+${units === 'imperial' ? (lower ? 10 : 5) : lower ? 5 : 2.5} ${units === 'imperial' ? 'lb' : 'kg'}` };
}

export function applyProgression(sets = [], suggestion) {
  return sets.map((set) => {
    if (suggestion?.kind === 'weight' && number(set.weight) > 0) return { ...set, weight: round(number(set.weight) + suggestion.delta, 2) };
    if (suggestion?.kind === 'reps') return { ...set, reps: number(set.reps) + suggestion.delta };
    return set;
  });
}

// Most recent date each muscle received any volume.
export function lastTrainedByMuscle(workouts = []) {
  const result = {};
  for (const workout of workouts) {
    const key = dateKey(workout.date);
    for (const set of workout.sets ?? []) {
      for (const [muscle, volume] of Object.entries(set.attribution ?? {})) {
        if (number(volume) > 0 && (!result[muscle] || key > result[muscle])) result[muscle] = key;
      }
    }
  }
  return result;
}

export function neglectedMuscles(muscles = [], workouts = [], { today = dateKey(), days = 10 } = {}) {
  if (!workouts.length) return [];
  const last = lastTrainedByMuscle(workouts);
  return muscles
    .map((muscle) => ({ muscle, lastDate: last[muscle] ?? null, days: last[muscle] ? dayDiff(last[muscle], today) : null }))
    .filter((row) => row.days == null || row.days >= days)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
}

// ---- Weekly review ----

export function weeklyReview({ week, dailyTotals = [], workouts = [], muscleVolume = [], bodyweightLogs = [], profile }) {
  const days = weekDays(week);
  const daySet = new Set(days);
  const previousWeek = shiftWeekKey(week, -1);
  const totals = dailyTotals.filter((row) => daySet.has(row.date) && number(row.calories) > 0);
  const targets = profile?.targets ?? {};
  const sessions = workouts.filter((workout) => weekKey(workout.date) === week);
  const volumeFor = (key) => muscleVolume.filter((row) => row.weekKey === key).reduce((sum, row) => sum + number(row.volume), 0);
  const volume = volumeFor(week);
  const previousVolume = volumeFor(previousWeek);
  const prs = personalRecordsByWorkout(workouts);
  const trend = weightTrend(bodyweightLogs);
  const trendAtOrBefore = (key) => trend.filter((row) => dateKey(row.date) <= key).at(-1)?.trend ?? null;
  const endWeight = trend.some((row) => daySet.has(dateKey(row.date))) ? trendAtOrBefore(days[6]) : null;
  const startWeight = trendAtOrBefore(shiftDay(days[0], -1));
  return {
    week,
    daysLogged: totals.length,
    caloriesOnTarget: totals.filter((row) => hitsTarget('calories', row.calories, targets.calories)).length,
    proteinOnTarget: totals.filter((row) => hitsTarget('protein', row.protein, targets.protein)).length,
    avgCalories: totals.length ? Math.round(totals.reduce((sum, row) => sum + number(row.calories), 0) / totals.length) : 0,
    sessions: sessions.length,
    sets: sessions.reduce((sum, workout) => sum + (workout.sets?.length ?? 0), 0),
    volume: Math.round(volume),
    volumeChange: previousVolume > 0 ? Math.round(((volume - previousVolume) / previousVolume) * 100) : null,
    prs: sessions.reduce((sum, workout) => sum + (prs.get(workout.id)?.size ?? 0), 0),
    weightChange: endWeight != null && startWeight != null ? round(endWeight - startWeight, 2) : null,
    isEmpty: !totals.length && !sessions.length
  };
}

// ---- AI context export ----

/**
 * A plain-text, paste-ready summary of today's nutrition, training and goal
 * status — meant to be dropped at the start of a chat with an AI so the user
 * doesn't have to type all of this out by hand. It only ever states what's
 * true today; it never asks a question on the user's behalf, so the same
 * export works whatever they're about to ask.
 */
export function buildAiContext({ today, profile, totals = {}, meals = [], todayWorkouts = [], exercises = [], goals = [], goalData = {} }) {
  const units = profile.units;
  const targets = profile.targets ?? {};
  const lines = [];

  lines.push(`Here's my fitness and nutrition data for ${fmtDate(today, 'EEEE d MMMM yyyy')}. Please use this as background context for our conversation — I'll ask my actual question after this.`);
  lines.push('');

  // Only state what the user actually set — unset fields are left out, not defaulted.
  const age = ageFromBirthYear(profile.birthYear, today);
  const stats = [
    profile.sex && `Sex: ${profile.sex}`,
    age != null && `Age: ${age}`,
    profile.height && `Height: ${fmtHeight(profile.height, profile.heightUnit ?? units)}`
  ].filter(Boolean);
  const about = [
    stats.length && stats.join(' · '),
    profile.trainingDays && `Training: ${trainingDaysLabel(profile.trainingDays)} days per week`,
    Array.isArray(profile.priorities) && `Training priorities, most important first: ${normalizePriorities(profile.priorities).map((id, index) => `${index + 1}. ${priorityLabel(id)}`).join(', ')}`
  ].filter(Boolean);
  if (about.length) lines.push('ABOUT ME', ...about, '');

  lines.push('MY TARGETS');
  lines.push(`Daily calories: ${fmtCalories(targets.calories)}`);
  lines.push(`Protein ${fmtMacro(targets.protein)} · Carbs ${fmtMacro(targets.carbs)} · Fat ${fmtMacro(targets.fat)}`);
  const goal = compositionGoal(profile);
  const goalText = profile.targetBodyweight == null ? ''
    : ` → target ${fmtWeight(profile.targetBodyweight, units)} (${goal.direction === 'maintain' ? 'maintaining' : `aiming to ${goal.direction} ${fmtWeight(goal.kg, units)}`})`;
  const bodyFatText = profile.targetBodyFat != null ? `target body fat ${round(profile.targetBodyFat, 1)}%` : 'no body-fat target set';
  lines.push(`Bodyweight: ${fmtWeight(profile.bodyweight, units)}${goalText} · ${bodyFatText}`);
  lines.push('');

  lines.push("TODAY'S NUTRITION SO FAR");
  const remaining = Math.round(number(targets.calories) - number(totals.calories));
  lines.push(`${fmtCalories(totals.calories ?? 0)} logged (${remaining >= 0 ? `${remaining.toLocaleString()} kcal remaining` : `${Math.abs(remaining).toLocaleString()} kcal over target`})`);
  lines.push(`Protein ${fmtMacro(totals.protein ?? 0)} / ${fmtMacro(targets.protein)} · Carbs ${fmtMacro(totals.carbs ?? 0)} / ${fmtMacro(targets.carbs)} · Fat ${fmtMacro(totals.fat ?? 0)} / ${fmtMacro(targets.fat)}`);
  if (meals.length) {
    lines.push('Meals:');
    for (const group of meals) {
      const items = group.logs.map((log) => {
        const amount = log.quick ? '' : ` (${log.quantity}${log.unit === 'g' ? 'g' : log.quantity === 1 ? ' serving' : ' servings'})`;
        return `${log.foodName}${amount} — ${fmtCalories(log.computed?.calories ?? 0)}`;
      }).join('; ');
      lines.push(`- ${mealLabel(group.meal)}: ${items}`);
    }
  } else {
    lines.push('Nothing logged yet today.');
  }
  lines.push('');

  lines.push("TODAY'S WORKOUT");
  if (todayWorkouts.length) {
    for (const workout of todayWorkouts) {
      if (workout.name) lines.push(`${workout.name}${workout.durationSeconds ? ` (${fmtClock(workout.durationSeconds)})` : ''}:`);
      for (const segment of workout.cardio ?? []) {
        const pace = paceOf(segment.seconds, segment.meters);
        lines.push(`- ${segment.label || segment.activity}: ${[segment.meters > 0 ? fmtDistance(segment.meters, units) : null, segment.seconds > 0 ? fmtClock(segment.seconds) : null, pace ? fmtPace(pace, units) : null].filter(Boolean).join(', ')}`);
      }
      const bySet = new Map();
      for (const set of workout.sets ?? []) {
        const name = exerciseName(exercises, set.exerciseId);
        const rpe = set.rpe != null ? ` @RPE${set.rpe}` : '';
        const amount = set.seconds ? `${set.seconds}s` : set.reps;
        const entry = number(set.weight) > 0 ? `${fmtWeight(set.weight, units)} × ${amount}${rpe}` : `${set.seconds ? amount : `${set.reps} reps`}${rpe}`;
        if (!bySet.has(name)) bySet.set(name, []);
        bySet.get(name).push(entry);
      }
      for (const [name, sets] of bySet) lines.push(`- ${name}: ${sets.join(', ')}`);
    }
  } else {
    lines.push('No workout logged today.');
  }
  lines.push('');

  lines.push('GOALS');
  if (goals.length) {
    for (const goal of goals) {
      const progress = goalProgress(goal, goalData);
      const status = GOAL_STATUS[progress.status]?.label ?? progress.status;
      lines.push(`- ${goal.title}: ${status} — currently ${goalValueLabel(goal, progress.current, units)} of ${goalValueLabel(goal, progress.target, units)} (${progress.pct}%)`);
    }
  } else {
    lines.push('No goals set.');
  }
  lines.push('');
  lines.push("That's all the background — I'll ask my question now.");

  return lines.join('\n');
}
