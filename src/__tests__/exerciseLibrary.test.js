import { describe, expect, it } from 'vitest';
import { EXERCISE_CATEGORIES, SEEDED_EXERCISES, categoryForExercise, normalizeExercise } from '../data/exercise-library/index.js';

describe('exercise library', () => {
  it('normalises the starter catalogue into folder categories', () => {
    expect(SEEDED_EXERCISES.length).toBeGreaterThan(100);
    expect(new Set(SEEDED_EXERCISES.map((exercise) => exercise.category))).toEqual(new Set(EXERCISE_CATEGORIES.map((category) => category.id).filter((id) => !['hips', 'neck', 'recovery', 'other'].includes(id))));
  });

  it('maps provider-style fields into the stable app schema', () => {
    const exercise = normalizeExercise({
      id: 'dumbbell-bench-press',
      name: 'Dumbbell Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Dumbbell',
      mechanics: 'Compound',
      experience: 'Beginner',
      url: 'https://www.muscleandstrength.com/exercises/dumbbell-bench-press'
    }, { source: 'muscle-and-strength', id: 'ms:dumbbell-bench-press' });

    expect(exercise).toMatchObject({ id: 'ms:dumbbell-bench-press', category: 'chest', equipment: 'dumbbell', mechanics: 'Compound', difficulty: 'Beginner', source: 'muscle-and-strength' });
    expect(exercise.primaryMuscles).toEqual(['chest']);
    expect(exercise.sourceUrl).toContain('/exercises/dumbbell-bench-press');
  });

  it('keeps stretch and conditioning exercises in their specialist folders', () => {
    expect(categoryForExercise({ name: 'Couch Stretch', primaryMuscles: ['quads'] })).toBe('mobility-stretching');
    expect(categoryForExercise({ name: 'Box Jump', primaryMuscles: ['quads', 'glutes'] })).toBe('cardio-conditioning');
  });
});
