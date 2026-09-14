import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT, EXERCISE_TYPES } from './categories.js';

const unique = (values) => [...new Set(values.filter(Boolean))];
const asArray = (value) => (Array.isArray(value) ? value : value == null || value === '' ? [] : String(value).split(/[,;|]/));
const clean = (value) => String(value ?? '').trim();
const slug = (value) => clean(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CATEGORY_ALIASES = {
  abdominals: 'core', abs: 'core', abdominal: 'core', obliques: 'core', core: 'core',
  back: 'back', 'upper-back': 'back', 'lower-back': 'back', lats: 'back', traps: 'back',
  chest: 'chest', pectorals: 'chest', pecs: 'chest',
  shoulders: 'shoulders', shoulder: 'shoulders', delts: 'shoulders',
  arms: 'arms', arm: 'arms', biceps: 'arms', triceps: 'arms', forearms: 'arms',
  legs: 'legs', leg: 'legs', quads: 'legs', quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', abductors: 'legs', adductors: 'legs',
  'hip-flexors': 'hips', 'hip-flexor': 'hips', hips: 'hips',
  neck: 'neck',
  cardio: 'cardio-conditioning', conditioning: 'cardio-conditioning', plyometrics: 'cardio-conditioning',
  stretching: 'mobility-stretching', stretch: 'mobility-stretching', mobility: 'mobility-stretching', warmup: 'mobility-stretching', 'warm-up': 'mobility-stretching',
  smr: 'recovery', recovery: 'recovery', 'foam-rolling': 'recovery',
  'it-band': 'recovery', 'palmar-fascia': 'recovery', 'plantar-fascia': 'recovery'
};

const MUSCLE_ALIASES = {
  abs: 'abs', abdominal: 'abs', abdominals: 'abs', core: 'abs',
  'upper back': 'upper_back', 'upper-back': 'upper_back', 'middle back': 'upper_back', 'middle-back': 'upper_back', traps: 'upper_back', trapezius: 'upper_back',
  back: 'upper_back', lats: 'lats', latissimus: 'lats',
  chest: 'chest', pecs: 'chest', pectorals: 'chest',
  shoulders: 'side_delts', shoulder: 'side_delts', delts: 'side_delts', 'front delts': 'front_delts', 'side delts': 'side_delts', 'rear delts': 'rear_delts',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  quads: 'quads', quadriceps: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves',
  abductors: 'abductors', adductors: 'adductors', 'hip flexors': 'hip_flexors', 'hip-flexors': 'hip_flexors',
  'lower back': 'lower_back', 'lower-back': 'lower_back', neck: 'neck', obliques: 'obliques',
  'it band': 'it_band', 'it-band': 'it_band', 'palmar fascia': 'palmar_fascia', 'plantar fascia': 'plantar_fascia'
};

const EQUIPMENT_ALIASES = {
  'ez bar': 'ez_bar', 'ez-bar': 'ez_bar', ezbar: 'ez_bar', dumbbells: 'dumbbell', barbells: 'barbell',
  'exercise ball': 'exercise_ball', 'stability ball': 'exercise_ball', 'foam roll': 'foam_roll', 'foam roller': 'foam_roll',
  'medicine ball': 'medicine_ball', medball: 'medicine_ball', kettlebells: 'kettlebell', 'kettle bells': 'kettlebell', bands: 'band',
  none: 'bodyweight', 'no equipment': 'bodyweight', 'body weight': 'bodyweight'
};

const TYPE_ALIASES = { warmup: 'warmup', 'warm-up': 'warmup', strength: 'strength', cardio: 'cardio', plyometrics: 'plyometrics', plyometric: 'plyometrics', smr: 'smr', stretching: 'stretching', stretch: 'stretching' };

const normalizeKey = (value) => slug(value).replace(/-/g, ' ');

export function normalizeCategory(value) {
  const key = slug(value);
  return CATEGORY_ALIASES[key] ?? (EXERCISE_CATEGORIES.some((category) => category.id === key) ? key : 'other');
}

export function normalizeMuscle(value) {
  const key = normalizeKey(value);
  return MUSCLE_ALIASES[key] ?? slug(value).replace(/-/g, '_');
}

export function normalizeEquipment(value) {
  const key = normalizeKey(value);
  const normalized = EQUIPMENT_ALIASES[key] ?? slug(value).replace(/-/g, '_');
  return EXERCISE_EQUIPMENT.includes(normalized) ? normalized : 'other';
}

export function normalizeType(value, category) {
  const normalized = TYPE_ALIASES[slug(value)] ?? slug(value);
  if (EXERCISE_TYPES.includes(normalized)) return normalized;
  if (category === 'mobility-stretching') return 'stretching';
  if (category === 'cardio-conditioning') return 'cardio';
  if (category === 'recovery') return 'smr';
  return 'strength';
}

export function categoryForExercise(exercise) {
  if (exercise?.category && normalizeCategory(exercise.category) !== 'other') return normalizeCategory(exercise.category);
  const inferred = normalizeExercise(exercise).category;
  if (inferred !== 'other') return inferred;
  const primary = asArray(exercise?.primaryMuscles).map(normalizeMuscle);
  const type = slug(exercise?.type ?? exercise?.mechanics ?? '');
  if (['stretching', 'stretch', 'warmup', 'warm-up', 'smr'].includes(type)) return normalizeCategory(type);
  return EXERCISE_CATEGORIES.find((category) => primary.some((muscle) => category.muscles.includes(muscle)))?.id ?? 'other';
}

export function normalizeExercise(raw = {}, { source = 'built-in', id } = {}) {
  const name = clean(raw.name ?? raw.title ?? raw.exercise);
  const sourceCategory = clean(raw.sourceCategory ?? raw.source_category ?? raw.muscleGroup ?? raw.muscle_group ?? raw.bodyPart ?? raw.body_part ?? raw.category);
  const suppliedMuscles = raw.primaryMuscles ?? raw.primary_muscles ?? raw.targetMuscles ?? raw.target_muscles ?? raw.muscles ?? raw.targetMuscle ?? raw.target_muscle;
  const primaryMuscles = unique(asArray(suppliedMuscles).map(normalizeMuscle));
  const secondaryMuscles = unique(asArray(raw.secondaryMuscles ?? raw.secondary_muscles).map(normalizeMuscle)).filter((muscle) => !primaryMuscles.includes(muscle));
  const categoryInput = raw.category ?? raw.folder ?? sourceCategory;
  const typeCategory = normalizeCategory(raw.type);
  const typeOwnsFolder = ['mobility-stretching', 'cardio-conditioning', 'recovery'].includes(typeCategory);
  const requestedCategory = typeOwnsFolder ? typeCategory : normalizeCategory(categoryInput ?? raw.type);
  const nameKey = slug(name);
  const inferredCategory = /stretch|mobility|pose|cat-cow|worlds-greatest|thoracic-rotation|wall-angels|open-book/.test(nameKey)
    ? 'mobility-stretching'
    : /cycling|rowing-machine|running|jump-rope|walking|jumping-jack|high-knees|burpee|mountain-climber|bear-crawl|box-jump|broad-jump|sled-/.test(nameKey)
      ? 'cardio-conditioning'
      : EXERCISE_CATEGORIES.find((item) => primaryMuscles.some((muscle) => item.muscles.includes(muscle)))?.id ?? 'other';
  const explicitOther = slug(categoryInput) === 'other';
  const category = (!categoryInput || requestedCategory === 'other' && !explicitOther) ? inferredCategory : requestedCategory;
  const fallbackMuscle = EXERCISE_CATEGORIES.find((item) => item.id === category)?.muscles[0];
  const finalPrimary = primaryMuscles.length ? primaryMuscles : fallbackMuscle ? [fallbackMuscle] : [];
  const rawCategories = asArray(raw.categories ?? raw.folders).map(normalizeCategory);
  const categories = unique([category, ...rawCategories]);
  const sourceId = clean(raw.id ?? raw.sourceId ?? raw.source_id);
  const sourceUrl = clean(raw.sourceUrl ?? raw.source_url ?? raw.url ?? raw.link);

  return {
    id: clean(id ?? raw.id) || `${source}:${slug(name)}`,
    name,
    category,
    categories,
    sourceCategory: sourceCategory || null,
    primaryMuscles: finalPrimary,
    secondaryMuscles,
    equipment: normalizeEquipment(raw.equipment ?? raw.equipmentRequired ?? raw.equipment_required),
    type: normalizeType(raw.type ?? raw.exerciseType ?? raw.exercise_type, category),
    mechanics: clean(raw.mechanics ?? raw.mechanic) || null,
    difficulty: clean(raw.difficulty ?? raw.experience ?? raw.experienceLevel ?? raw.experience_level) || null,
    aliases: unique(asArray(raw.aliases ?? raw.alternateNames ?? raw.alternate_names).map(clean)),
    source,
    sourceId: sourceId || null,
    sourceUrl: sourceUrl || null,
    isCustom: Boolean(raw.isCustom)
  };
}

export const exerciseSlug = slug;
