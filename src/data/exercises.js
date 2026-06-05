export const MUSCLES = [
  'chest',
  'upper_back',
  'lats',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'lower_back'
];

export const SEEDED_EXERCISES = [
  { id: 'seed:barbell_bench_press', name: 'Barbell Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'], equipment: 'barbell', isCustom: false },
  { id: 'seed:incline_dumbbell_press', name: 'Incline Dumbbell Press', primaryMuscles: ['chest', 'front_delts'], secondaryMuscles: ['triceps'], equipment: 'dumbbell', isCustom: false },
  { id: 'seed:overhead_press', name: 'Overhead Press', primaryMuscles: ['front_delts', 'side_delts'], secondaryMuscles: ['triceps', 'upper_back'], equipment: 'barbell', isCustom: false },
  { id: 'seed:lat_pulldown', name: 'Lat Pulldown', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper_back'], equipment: 'machine', isCustom: false },
  { id: 'seed:pull_up', name: 'Pull-Up', primaryMuscles: ['lats', 'upper_back'], secondaryMuscles: ['biceps', 'forearms'], equipment: 'bodyweight', isCustom: false },
  { id: 'seed:barbell_row', name: 'Barbell Row', primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['biceps', 'rear_delts', 'lower_back'], equipment: 'barbell', isCustom: false },
  { id: 'seed:back_squat', name: 'Back Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'lower_back', 'abs'], equipment: 'barbell', isCustom: false },
  { id: 'seed:romanian_deadlift', name: 'Romanian Deadlift', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'forearms'], equipment: 'barbell', isCustom: false },
  { id: 'seed:deadlift', name: 'Deadlift', primaryMuscles: ['hamstrings', 'glutes', 'lower_back'], secondaryMuscles: ['upper_back', 'lats', 'forearms'], equipment: 'barbell', isCustom: false },
  { id: 'seed:leg_press', name: 'Leg Press', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], equipment: 'machine', isCustom: false },
  { id: 'seed:biceps_curl', name: 'Biceps Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'dumbbell', isCustom: false },
  { id: 'seed:triceps_pushdown', name: 'Triceps Pushdown', primaryMuscles: ['triceps'], secondaryMuscles: [], equipment: 'cable', isCustom: false },
  { id: 'seed:lateral_raise', name: 'Lateral Raise', primaryMuscles: ['side_delts'], secondaryMuscles: ['rear_delts'], equipment: 'dumbbell', isCustom: false },
  { id: 'seed:plank', name: 'Plank', primaryMuscles: ['abs'], secondaryMuscles: ['glutes', 'lower_back'], equipment: 'bodyweight', isCustom: false },
  { id: 'seed:standing_calf_raise', name: 'Standing Calf Raise', primaryMuscles: ['calves'], secondaryMuscles: [], equipment: 'machine', isCustom: false }
];
