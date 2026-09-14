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
  'lower_back',
  'abductors',
  'adductors',
  'hip_flexors',
  'neck',
  'obliques',
  'traps',
  'it_band',
  'palmar_fascia',
  'plantar_fascia'
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
  ,{ id: 'seed:close_grip_bench_press', name: 'Close-Grip Bench Press', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:decline_bench_press', name: 'Decline Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'front_delts'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:dumbbell_bench_press', name: 'Dumbbell Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:push_up', name: 'Push-Up', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps', 'abs'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:diamond_push_up', name: 'Diamond Push-Up', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:chest_fly', name: 'Chest Fly', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:cable_crossover', name: 'Cable Crossover', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts'], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:arnold_press', name: 'Arnold Press', primaryMuscles: ['front_delts', 'side_delts'], secondaryMuscles: ['triceps'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:front_raise', name: 'Front Raise', primaryMuscles: ['front_delts'], secondaryMuscles: [], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:face_pull', name: 'Face Pull', primaryMuscles: ['rear_delts', 'upper_back'], secondaryMuscles: ['side_delts', 'forearms'], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:reverse_fly', name: 'Reverse Fly', primaryMuscles: ['rear_delts'], secondaryMuscles: ['upper_back'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:upright_row', name: 'Upright Row', primaryMuscles: ['side_delts', 'upper_back'], secondaryMuscles: ['biceps'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:chin_up', name: 'Chin-Up', primaryMuscles: ['lats', 'biceps'], secondaryMuscles: ['upper_back', 'forearms'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:assisted_pull_up', name: 'Assisted Pull-Up', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper_back'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:seated_cable_row', name: 'Seated Cable Row', primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['biceps', 'rear_delts'], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:single_arm_row', name: 'Single-Arm Dumbbell Row', primaryMuscles: ['lats', 'upper_back'], secondaryMuscles: ['biceps', 'rear_delts'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:chest_supported_row', name: 'Chest-Supported Row', primaryMuscles: ['upper_back'], secondaryMuscles: ['lats', 'biceps', 'rear_delts'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:straight_arm_pulldown', name: 'Straight-Arm Pulldown', primaryMuscles: ['lats'], secondaryMuscles: ['abs'], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:barbell_shrug', name: 'Barbell Shrug', primaryMuscles: ['upper_back'], secondaryMuscles: ['forearms'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:front_squat', name: 'Front Squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'abs', 'lower_back'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:goblet_squat', name: 'Goblet Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['abs'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:split_squat', name: 'Bulgarian Split Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:walking_lunge', name: 'Walking Lunge', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:reverse_lunge', name: 'Reverse Lunge', primaryMuscles: ['glutes', 'quads'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:step_up', name: 'Step-Up', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:hip_thrust', name: 'Hip Thrust', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'abs'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:glute_bridge', name: 'Glute Bridge', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'abs'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:good_morning', name: 'Good Morning', primaryMuscles: ['hamstrings', 'lower_back'], secondaryMuscles: ['glutes', 'abs'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:sumo_deadlift', name: 'Sumo Deadlift', primaryMuscles: ['glutes', 'hamstrings'], secondaryMuscles: ['quads', 'lower_back', 'forearms'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:leg_extension', name: 'Leg Extension', primaryMuscles: ['quads'], secondaryMuscles: [], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:leg_curl', name: 'Seated Leg Curl', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:nordic_curl', name: 'Nordic Hamstring Curl', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:donkey_calf_raise', name: 'Donkey Calf Raise', primaryMuscles: ['calves'], secondaryMuscles: [], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:seated_calf_raise', name: 'Seated Calf Raise', primaryMuscles: ['calves'], secondaryMuscles: [], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:hammer_curl', name: 'Hammer Curl', primaryMuscles: ['biceps', 'forearms'], secondaryMuscles: [], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:preacher_curl', name: 'Preacher Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:incline_curl', name: 'Incline Dumbbell Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:skull_crusher', name: 'Skull Crusher', primaryMuscles: ['triceps'], secondaryMuscles: [], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:overhead_triceps_extension', name: 'Overhead Triceps Extension', primaryMuscles: ['triceps'], secondaryMuscles: [], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:close_grip_push_up', name: 'Close-Grip Push-Up', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:wrist_curl', name: 'Wrist Curl', primaryMuscles: ['forearms'], secondaryMuscles: [], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:hanging_knee_raise', name: 'Hanging Knee Raise', primaryMuscles: ['abs'], secondaryMuscles: ['forearms', 'lats'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:leg_raise', name: 'Lying Leg Raise', primaryMuscles: ['abs'], secondaryMuscles: ['quads'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:dead_bug', name: 'Dead Bug', primaryMuscles: ['abs'], secondaryMuscles: [], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:bird_dog', name: 'Bird Dog', primaryMuscles: ['abs', 'lower_back'], secondaryMuscles: ['glutes'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:side_plank', name: 'Side Plank', primaryMuscles: ['abs'], secondaryMuscles: ['glutes'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:mountain_climber', name: 'Mountain Climber', primaryMuscles: ['abs'], secondaryMuscles: ['quads', 'front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:burpee', name: 'Burpee', primaryMuscles: ['quads', 'chest'], secondaryMuscles: ['glutes', 'abs', 'front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:jumping_jack', name: 'Jumping Jack', primaryMuscles: ['calves'], secondaryMuscles: ['quads', 'side_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:bodyweight_squat', name: 'Bodyweight Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:high_knees', name: 'High Knees', primaryMuscles: ['quads'], secondaryMuscles: ['abs', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:bear_crawl', name: 'Bear Crawl', primaryMuscles: ['abs', 'front_delts'], secondaryMuscles: ['quads', 'chest'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:farmer_carry', name: 'Farmer Carry', primaryMuscles: ['forearms', 'upper_back'], secondaryMuscles: ['abs', 'glutes'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:rowing_machine', name: 'Rowing Machine', primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['quads', 'hamstrings', 'glutes'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:cycling', name: 'Cycling', primaryMuscles: ['quads'], secondaryMuscles: ['hamstrings', 'glutes', 'calves'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:jump_rope', name: 'Jump Rope', primaryMuscles: ['calves'], secondaryMuscles: ['quads', 'forearms'], equipment: 'other', isCustom: false }
  ,{ id: 'seed:walking', name: 'Walking', primaryMuscles: ['calves'], secondaryMuscles: ['quads', 'glutes'], equipment: 'other', isCustom: false }
  ,{ id: 'seed:neck_stretch', name: 'Neck Stretch', primaryMuscles: ['upper_back'], secondaryMuscles: [], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:shoulder_stretch', name: 'Cross-Body Shoulder Stretch', primaryMuscles: ['rear_delts'], secondaryMuscles: ['side_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:chest_stretch', name: 'Doorway Chest Stretch', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:triceps_stretch', name: 'Overhead Triceps Stretch', primaryMuscles: ['triceps'], secondaryMuscles: ['front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:lat_stretch', name: 'Child’s Pose Lat Stretch', primaryMuscles: ['lats'], secondaryMuscles: ['upper_back'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:upper_back_stretch', name: 'Upper-Back Reach Stretch', primaryMuscles: ['upper_back'], secondaryMuscles: ['rear_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:lower_back_stretch', name: 'Knees-to-Chest Stretch', primaryMuscles: ['lower_back'], secondaryMuscles: ['glutes'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:cat_cow', name: 'Cat-Cow Stretch', primaryMuscles: ['lower_back'], secondaryMuscles: ['abs'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:child_pose', name: 'Child’s Pose', primaryMuscles: ['lower_back'], secondaryMuscles: ['glutes', 'lats'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:hip_flexor_stretch', name: 'Half-Kneeling Hip Flexor Stretch', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:quad_stretch', name: 'Standing Quad Stretch', primaryMuscles: ['quads'], secondaryMuscles: [], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:hamstring_stretch', name: 'Seated Hamstring Stretch', primaryMuscles: ['hamstrings'], secondaryMuscles: ['lower_back'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:standing_hamstring_stretch', name: 'Standing Hamstring Stretch', primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:figure_four_stretch', name: 'Figure-Four Glute Stretch', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:butterfly_stretch', name: 'Butterfly Stretch', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:adductor_stretch', name: 'Adductor / Frog Stretch', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:calf_stretch', name: 'Wall Calf Stretch', primaryMuscles: ['calves'], secondaryMuscles: ['hamstrings'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:ankle_mobility', name: 'Knee-to-Wall Ankle Mobility', primaryMuscles: ['calves'], secondaryMuscles: ['quads'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:wrist_stretch', name: 'Wrist Flexor Stretch', primaryMuscles: ['forearms'], secondaryMuscles: [], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:worlds_greatest_stretch', name: 'World’s Greatest Stretch', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:thoracic_rotation', name: 'Open Book Thoracic Rotation', primaryMuscles: ['upper_back'], secondaryMuscles: ['abs'], equipment: 'bodyweight', isCustom: false }
  // Additional names sourced from the Muscle & Strength exercise database.
  ,{ id: 'seed:dumbbell_pullover', name: 'Dumbbell Pullover', primaryMuscles: ['lats', 'chest'], secondaryMuscles: ['upper_back', 'triceps'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:bent_over_dumbbell_row', name: 'Bent Over Dumbbell Row', primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['biceps', 'rear_delts', 'lower_back'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:bent_over_row', name: 'Bent Over Row', primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['biceps', 'rear_delts', 'lower_back'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:seated_dumbbell_press', name: 'Seated Dumbbell Press', primaryMuscles: ['front_delts', 'side_delts'], secondaryMuscles: ['triceps', 'upper_back'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:military_press', name: 'Military Press', primaryMuscles: ['front_delts', 'side_delts'], secondaryMuscles: ['triceps', 'upper_back'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:dumbbell_stiff_leg_deadlift', name: 'Dumbbell Stiff Leg Deadlift', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'forearms'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:straight_bar_tricep_extension', name: 'Straight Bar Tricep Extension', primaryMuscles: ['triceps'], secondaryMuscles: [], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:dumbbell_lateral_raise', name: 'Dumbbell Lateral Raise', primaryMuscles: ['side_delts'], secondaryMuscles: ['rear_delts'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:dumbbell_deadlift', name: 'Dumbbell Deadlift', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'upper_back', 'forearms'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:barbell_curl', name: 'Barbell Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'barbell', isCustom: false }
  ,{ id: 'seed:ez_bar_curl', name: 'EZ-Bar Curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'ez_bar', isCustom: false }
  ,{ id: 'seed:ez_bar_skullcrusher', name: 'EZ-Bar Skullcrusher', primaryMuscles: ['triceps'], secondaryMuscles: [], equipment: 'ez_bar', isCustom: false }
  ,{ id: 'seed:cable_lat_raise', name: 'Cable Lateral Raise', primaryMuscles: ['side_delts'], secondaryMuscles: [], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:cable_front_raise', name: 'Cable Front Raise', primaryMuscles: ['front_delts'], secondaryMuscles: [], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:cable_reverse_fly', name: 'Cable Reverse Fly', primaryMuscles: ['rear_delts'], secondaryMuscles: ['upper_back'], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:machine_chest_press', name: 'Machine Chest Press', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:machine_shoulder_press', name: 'Machine Shoulder Press', primaryMuscles: ['front_delts', 'side_delts'], secondaryMuscles: ['triceps'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:machine_row', name: 'Machine Row', primaryMuscles: ['upper_back', 'lats'], secondaryMuscles: ['biceps', 'rear_delts'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:machine_hack_squat', name: 'Hack Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:smith_machine_squat', name: 'Smith Machine Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['hamstrings', 'abs'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:smith_machine_bench_press', name: 'Smith Machine Bench Press', primaryMuscles: ['chest'], secondaryMuscles: ['front_delts', 'triceps'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:kettlebell_swing', name: 'Kettlebell Swing', primaryMuscles: ['glutes', 'hamstrings'], secondaryMuscles: ['lower_back', 'abs', 'forearms'], equipment: 'kettlebell', isCustom: false }
  ,{ id: 'seed:kettlebell_goblet_squat', name: 'Kettlebell Goblet Squat', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['abs'], equipment: 'kettlebell', isCustom: false }
  ,{ id: 'seed:kettlebell_clean', name: 'Kettlebell Clean', primaryMuscles: ['glutes', 'upper_back'], secondaryMuscles: ['hamstrings', 'front_delts', 'forearms'], equipment: 'kettlebell', isCustom: false }
  ,{ id: 'seed:kettlebell_snatch', name: 'Kettlebell Snatch', primaryMuscles: ['glutes', 'front_delts'], secondaryMuscles: ['hamstrings', 'upper_back', 'forearms'], equipment: 'kettlebell', isCustom: false }
  ,{ id: 'seed:turkish_get_up', name: 'Turkish Get-Up', primaryMuscles: ['abs', 'front_delts'], secondaryMuscles: ['glutes', 'quads', 'upper_back'], equipment: 'kettlebell', isCustom: false }
  ,{ id: 'seed:box_jump', name: 'Box Jump', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves', 'hamstrings'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:broad_jump', name: 'Broad Jump', primaryMuscles: ['glutes', 'quads'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:sled_push', name: 'Sled Push', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves', 'hamstrings'], equipment: 'other', isCustom: false }
  ,{ id: 'seed:sled_pull', name: 'Sled Pull', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['upper_back', 'biceps', 'forearms'], equipment: 'other', isCustom: false }
  ,{ id: 'seed:stair_climber', name: 'Stair Climber', primaryMuscles: ['quads', 'glutes'], secondaryMuscles: ['calves', 'hamstrings'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:treadmill_running', name: 'Treadmill Running', primaryMuscles: ['calves'], secondaryMuscles: ['quads', 'hamstrings', 'glutes'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:elliptical', name: 'Elliptical Trainer', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'hamstrings', 'calves'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:ab_wheel_rollout', name: 'Ab Wheel Rollout', primaryMuscles: ['abs'], secondaryMuscles: ['lats', 'front_delts'], equipment: 'other', isCustom: false }
  ,{ id: 'seed:cable_crunch', name: 'Cable Crunch', primaryMuscles: ['abs'], secondaryMuscles: [], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:decline_sit_up', name: 'Decline Sit-Up', primaryMuscles: ['abs'], secondaryMuscles: ['quads'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:russian_twist', name: 'Russian Twist', primaryMuscles: ['abs'], secondaryMuscles: ['lower_back'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:cable_woodchop', name: 'Cable Woodchop', primaryMuscles: ['abs'], secondaryMuscles: ['upper_back', 'glutes'], equipment: 'cable', isCustom: false }
  ,{ id: 'seed:hip_abduction', name: 'Hip Abduction Machine', primaryMuscles: ['glutes'], secondaryMuscles: [], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:hip_adduction', name: 'Hip Adduction Machine', primaryMuscles: ['glutes'], secondaryMuscles: ['quads'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:reverse_hyperextension', name: 'Reverse Hyperextension', primaryMuscles: ['glutes', 'hamstrings'], secondaryMuscles: ['lower_back'], equipment: 'machine', isCustom: false }
  ,{ id: 'seed:back_extension', name: 'Back Extension', primaryMuscles: ['lower_back', 'glutes'], secondaryMuscles: ['hamstrings'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:single_leg_deadlift', name: 'Single-Leg Romanian Deadlift', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['lower_back', 'calves'], equipment: 'dumbbell', isCustom: false }
  ,{ id: 'seed:curtsy_lunge', name: 'Curtsy Lunge', primaryMuscles: ['glutes', 'quads'], secondaryMuscles: ['hamstrings', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:wall_sit', name: 'Wall Sit', primaryMuscles: ['quads'], secondaryMuscles: ['glutes', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:clamshell', name: 'Clamshell', primaryMuscles: ['glutes'], secondaryMuscles: [], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:fire_hydrant', name: 'Fire Hydrant', primaryMuscles: ['glutes'], secondaryMuscles: ['abs'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:worlds_greatest_stretch_dynamic', name: 'Dynamic World’s Greatest Stretch', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['quads', 'front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:90_90_hip_switch', name: '90/90 Hip Switch', primaryMuscles: ['glutes'], secondaryMuscles: ['quads', 'lower_back'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:pigeon_pose', name: 'Pigeon Pose', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'lower_back'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:couch_stretch', name: 'Couch Stretch', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:seated_forward_fold', name: 'Seated Forward Fold', primaryMuscles: ['hamstrings'], secondaryMuscles: ['lower_back', 'calves'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:standing_calf_raise_stretch', name: 'Standing Calf Stretch', primaryMuscles: ['calves'], secondaryMuscles: [], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:doorway_lat_stretch', name: 'Doorway Lat Stretch', primaryMuscles: ['lats'], secondaryMuscles: ['upper_back'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:wall_angels', name: 'Wall Angels', primaryMuscles: ['rear_delts', 'upper_back'], secondaryMuscles: ['front_delts'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:scapular_push_up', name: 'Scapular Push-Up', primaryMuscles: ['front_delts', 'upper_back'], secondaryMuscles: ['chest', 'abs'], equipment: 'bodyweight', isCustom: false }
  ,{ id: 'seed:band_pull_apart', name: 'Band Pull-Apart', primaryMuscles: ['rear_delts', 'upper_back'], secondaryMuscles: ['forearms'], equipment: 'band', isCustom: false }
  ,{ id: 'seed:banded_glute_bridge', name: 'Banded Glute Bridge', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'abs'], equipment: 'band', isCustom: false }
];
