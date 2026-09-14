import { MUSCLES, SEEDED_EXERCISES as LEGACY_EXERCISES } from '../exercises.js';
import { EXERCISE_CATEGORIES, EXERCISE_EQUIPMENT, EXERCISE_TYPES, categoryLabel } from './categories.js';
import { IMPORTED_EXERCISES, IMPORT_MANIFEST } from './imported/index.js';
import { categoryForExercise, normalizeExercise } from './schema.js';

const normalized = [...LEGACY_EXERCISES, ...IMPORTED_EXERCISES]
  .filter((exercise) => exercise?.name)
  .map((exercise) => normalizeExercise(exercise, { source: exercise.source ?? 'built-in' }));

// Imported files and the original starter catalogue may overlap. Prefer the first
// stable id and keep the old IDs intact so saved workouts continue to resolve.
const seen = new Set();
export const SEEDED_EXERCISES = normalized.filter((exercise) => {
  const keys = [exercise.name.toLowerCase(), exercise.sourceUrl].filter(Boolean);
  if (keys.some((key) => seen.has(key))) return false;
  keys.forEach((key) => seen.add(key));
  return true;
});

export {
  MUSCLES,
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  EXERCISE_TYPES,
  IMPORT_MANIFEST,
  categoryForExercise,
  categoryLabel,
  normalizeExercise
};
