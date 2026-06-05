import { format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns';

export const SECONDARY_WEIGHT = 0.5;
export const KG_TO_LB = 2.2046226218;
export const CM_TO_IN = 0.3937007874;
export const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fat: 0 };
export const DEFAULT_GOAL_MIX = { fatLoss: 45, muscleGain: 55, performance: 45, health: 50 };

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

export function scaleNutrition(food, quantity, unit) {
  if (!food?.per100) return { ...EMPTY_TOTALS };
  const qty = Math.max(0, number(quantity));
  const serving = food.servings?.[0] ?? { grams: 100 };
  const grams = unit === 'serving' ? qty * number(serving.grams, 100) : qty;
  const factor = grams / 100;
  return {
    calories: round(number(food.per100.calories) * factor, 0),
    protein: round(number(food.per100.protein) * factor),
    carbs: round(number(food.per100.carbs) * factor),
    fat: round(number(food.per100.fat) * factor)
  };
}

export function addTotals(a = EMPTY_TOTALS, b = EMPTY_TOTALS, sign = 1) {
  return {
    calories: Math.max(0, round(number(a.calories) + number(b.calories) * sign, 0)),
    protein: Math.max(0, round(number(a.protein) + number(b.protein) * sign)),
    carbs: Math.max(0, round(number(a.carbs) + number(b.carbs) * sign)),
    fat: Math.max(0, round(number(a.fat) + number(b.fat) * sign))
  };
}

export function setVolume(set) {
  return round(number(set?.reps) * number(set?.weight), 1);
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
  return round(number(weight) * (1 + number(reps) / 30), 1);
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

export function calculateNutritionTargets(profile = {}) {
  const weight = Math.max(35, number(profile.bodyweight, 78));
  const heightCm = Math.max(120, number(profile.height, 178));
  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  const mix = normalizeGoalMix(profile.goalMix);
  const fatLoss = mix.fatLoss / 100;
  const muscleGain = mix.muscleGain / 100;
  const performance = mix.performance / 100;
  const health = mix.health / 100;
  const trainingFactor = 29 + muscleGain * 4 + performance * 6 + health * 2;
  const baseCalories = weight * trainingFactor;
  const calorieShift = muscleGain * 0.14 + performance * 0.08 - fatLoss * 0.2 + health * 0.02;
  const bmiAdjustment = bmi > 30 ? -0.05 * fatLoss : bmi < 20 ? 0.05 * muscleGain : 0;
  const calories = Math.round((baseCalories * (1 + calorieShift + bmiAdjustment)) / 25) * 25;
  const proteinFactor = 1.65 + fatLoss * 0.35 + muscleGain * 0.35;
  const fatFactor = 0.7 + health * 0.2 + muscleGain * 0.1;
  const protein = Math.round(weight * proteinFactor);
  const fat = Math.round(Math.max(weight * fatFactor, (calories * 0.2) / 9));
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export function fmtCalories(value) {
  return `${Math.round(number(value)).toLocaleString()} kcal`;
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

export function goalProgress(goal, data = {}) {
  const target = number(goal?.target);
  let current = 0;
  if (goal?.type === 'bodyweight') {
    current = data.bodyweightLogs?.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weight ?? 0;
  } else if (goal?.type === 'volume') {
    current = data.muscleVolume?.filter((row) => row.muscle === goal.muscle).reduce((sum, row) => sum + number(row.volume), 0) ?? 0;
  } else if (goal?.type === 'nutrition') {
    const metric = goal.metric || 'calories';
    current = data.dailyTotals?.slice(-14).filter((row) => number(row[metric]) >= target).length ?? 0;
  } else if (goal?.type === 'strength') {
    current = data.workouts?.flatMap((workout) => workout.sets ?? [])
      .filter((set) => String(set.exerciseId) === String(goal.exerciseId))
      .reduce((best, set) => Math.max(best, estimateOneRepMax(set.weight, set.reps)), 0) ?? 0;
  }
  const achieved = goal?.type === 'bodyweight' && goal.direction === 'down' ? current <= target && current > 0 : current >= target;
  const ratio = target > 0 ? current / target : 0;
  return { current: round(current, 1), target, status: achieved ? 'achieved' : ratio >= 0.7 ? 'on-track' : 'behind' };
}

export function mealLabel(mealType) {
  return ({ breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' })[mealType] ?? 'Meal';
}

export function exerciseName(exercises, id) {
  return exercises.find((exercise) => String(exercise.id) === String(id))?.name ?? 'Deleted exercise';
}
