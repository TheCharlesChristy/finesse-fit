// The app's folders are deliberately broader than any one provider's tags.
// A source exercise can still retain its original category in `sourceCategory`.
export const EXERCISE_CATEGORIES = [
  { id: 'chest', label: 'Chest', muscles: ['chest'] },
  { id: 'back', label: 'Back', muscles: ['upper_back', 'lats', 'lower_back'] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', label: 'Legs', muscles: ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors'] },
  { id: 'core', label: 'Core', muscles: ['abs', 'obliques'] },
  { id: 'hips', label: 'Hips', muscles: ['hip_flexors'] },
  { id: 'neck', label: 'Neck', muscles: ['neck'] },
  { id: 'cardio-conditioning', label: 'Cardio & conditioning', muscles: [] },
  { id: 'mobility-stretching', label: 'Mobility & stretching', muscles: [] },
  { id: 'recovery', label: 'Recovery & self-massage', muscles: ['palmar_fascia', 'plantar_fascia'] },
  { id: 'other', label: 'Other', muscles: [] }
];

export const EXERCISE_EQUIPMENT = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band',
  'ez_bar', 'exercise_ball', 'bench', 'foam_roll', 'medicine_ball', 'other'
];

export const EXERCISE_TYPES = ['strength', 'warmup', 'cardio', 'plyometrics', 'smr', 'stretching', 'other'];

export const categoryById = (id) => EXERCISE_CATEGORIES.find((category) => category.id === id);

export const categoryLabel = (id) => categoryById(id)?.label ?? 'Other';
