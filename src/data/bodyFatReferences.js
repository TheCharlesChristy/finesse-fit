// Body-fat reference points shown when choosing a target body fat — a plain
// label and description per percentage, rendered by components/BodyFatReference.jsx
// as text-only rows (no illustration: a genuinely free-to-reuse image or open
// component for this didn't turn up, and drawing one in-house didn't read
// clearly at this size — see git history on this file for both attempts).
// Descriptions follow commonly cited visual guides — approximate by nature.
export const BODY_FAT_REFERENCES = {
  male: [
    { bodyFat: 8, label: 'Very lean', description: 'Sharp abs, visible veins' },
    { bodyFat: 12, label: 'Lean', description: 'Abs visible, clear muscle lines' },
    { bodyFat: 15, label: 'Fit', description: 'Ab outline, trim waist' },
    { bodyFat: 20, label: 'Average', description: 'Soft midsection, no abs' },
    { bodyFat: 25, label: 'Above average', description: 'Belly and chest fat' },
    { bodyFat: 30, label: 'High', description: 'Rounded belly, wide waist' }
  ],
  female: [
    { bodyFat: 15, label: 'Very lean', description: 'Athletic, visible abs' },
    { bodyFat: 20, label: 'Lean', description: 'Toned, some ab outline' },
    { bodyFat: 25, label: 'Fit', description: 'Flat stomach, defined curves' },
    { bodyFat: 30, label: 'Average', description: 'Softer shape, fuller hips' },
    { bodyFat: 35, label: 'Above average', description: 'Rounded stomach, fuller limbs' },
    { bodyFat: 40, label: 'High', description: 'Fuller throughout' }
  ]
};

// Below these, body fat is hard to sustain and isn't needed for health.
export const VERY_LOW_BODY_FAT = { male: 10, female: 18 };
