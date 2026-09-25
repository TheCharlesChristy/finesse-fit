// EU food-label reference intakes for adults. These are general label
// references, not personalised dietary recommendations.
export const MICRONUTRIENTS = [
  { key: 'vitaminA', label: 'Vitamin A', unit: 'µg', target: 800, group: 'Vitamins', offKeys: ['vitamin-a'], labelPattern: /vitamin\s*a|retinol/i },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'µg', target: 5, group: 'Vitamins', featured: true, offKeys: ['vitamin-d'], labelPattern: /vitamin\s*d/i },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', target: 12, group: 'Vitamins', offKeys: ['vitamin-e'], labelPattern: /vitamin\s*e|tocopherol/i },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'µg', target: 75, group: 'Vitamins', offKeys: ['vitamin-k', 'phylloquinone'], labelPattern: /vitamin\s*k|phylloquinone/i },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', target: 80, group: 'Vitamins', featured: true, offKeys: ['vitamin-c'], labelPattern: /vitamin\s*c|ascorbic\s+acid/i },
  { key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg', target: 1.1, group: 'Vitamins', offKeys: ['vitamin-b1', 'thiamin'], labelPattern: /thiamin|thiamine|vitamin\s*b1/i },
  { key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg', target: 1.4, group: 'Vitamins', offKeys: ['vitamin-b2', 'riboflavin'], labelPattern: /riboflavin|vitamin\s*b2/i },
  { key: 'niacin', label: 'Niacin (B3)', unit: 'mg', target: 16, group: 'Vitamins', offKeys: ['vitamin-pp', 'niacin'], labelPattern: /niacin|vitamin\s*pp|vitamin\s*b3/i },
  { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg', target: 1.4, group: 'Vitamins', offKeys: ['vitamin-b6'], labelPattern: /vitamin\s*b6/i },
  { key: 'folate', label: 'Folate (B9)', unit: 'µg', target: 200, group: 'Vitamins', offKeys: ['vitamin-b9', 'folates'], labelPattern: /folate|folic\s+acid|vitamin\s*b9/i },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'µg', target: 2.5, group: 'Vitamins', featured: true, offKeys: ['vitamin-b12'], labelPattern: /vitamin\s*b12|\bb12\b|cobalamin/i },
  { key: 'biotin', label: 'Biotin', unit: 'µg', target: 50, group: 'Vitamins', offKeys: ['biotin'], labelPattern: /biotin/i },
  { key: 'pantothenicAcid', label: 'Pantothenic acid (B5)', unit: 'mg', target: 6, group: 'Vitamins', offKeys: ['pantothenic-acid'], labelPattern: /pantothenic\s+acid|vitamin\s*b5/i },
  { key: 'potassium', label: 'Potassium', unit: 'mg', target: 2000, group: 'Minerals', featured: true, offKeys: ['potassium'], labelPattern: /potassium/i },
  { key: 'chloride', label: 'Chloride', unit: 'mg', target: 800, group: 'Minerals', offKeys: ['chloride'], labelPattern: /chloride/i },
  { key: 'calcium', label: 'Calcium', unit: 'mg', target: 800, group: 'Minerals', featured: true, offKeys: ['calcium'], labelPattern: /calcium/i },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', target: 700, group: 'Minerals', offKeys: ['phosphorus'], labelPattern: /phosphorus/i },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', target: 375, group: 'Minerals', featured: true, offKeys: ['magnesium'], labelPattern: /magnesium/i },
  { key: 'iron', label: 'Iron', unit: 'mg', target: 14, group: 'Minerals', featured: true, offKeys: ['iron'], labelPattern: /iron/i },
  { key: 'zinc', label: 'Zinc', unit: 'mg', target: 10, group: 'Minerals', featured: true, offKeys: ['zinc'], labelPattern: /zinc/i },
  { key: 'copper', label: 'Copper', unit: 'mg', target: 1, group: 'Minerals', offKeys: ['copper'], labelPattern: /copper/i },
  { key: 'manganese', label: 'Manganese', unit: 'mg', target: 2, group: 'Minerals', offKeys: ['manganese'], labelPattern: /manganese/i },
  { key: 'fluoride', label: 'Fluoride', unit: 'mg', target: 3.5, group: 'Minerals', offKeys: ['fluoride'], labelPattern: /fluoride/i },
  { key: 'selenium', label: 'Selenium', unit: 'µg', target: 55, group: 'Minerals', offKeys: ['selenium'], labelPattern: /selenium/i },
  { key: 'chromium', label: 'Chromium', unit: 'µg', target: 40, group: 'Minerals', offKeys: ['chromium'], labelPattern: /chromium/i },
  { key: 'molybdenum', label: 'Molybdenum', unit: 'µg', target: 50, group: 'Minerals', offKeys: ['molybdenum'], labelPattern: /molybdenum/i },
  { key: 'iodine', label: 'Iodine', unit: 'µg', target: 150, group: 'Minerals', offKeys: ['iodine'], labelPattern: /iodine/i }
];

export const MICRONUTRIENT_KEYS = MICRONUTRIENTS.map(({ key }) => key);

const canonicalUnit = (unit) => {
  const value = String(unit ?? '').trim().toLowerCase().replace('μ', 'µ');
  if (['µg', 'mcg', 'ug'].includes(value)) return 'µg';
  if (['mg', 'milligram', 'milligrams'].includes(value)) return 'mg';
  if (['g', 'gram', 'grams'].includes(value)) return 'g';
  if (['iu', 'ui'].includes(value)) return 'iu';
  return value;
};

export function convertNutrientAmount(value, fromUnit, toUnit, key) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  const from = canonicalUnit(fromUnit);
  const to = canonicalUnit(toUnit);
  if (!from || from === to) return amount;
  if (from === 'iu' && to === 'µg' && key === 'vitaminD') return amount / 40;
  if (from === 'iu') return null;
  if (from === 'g' && to === 'mg') return amount * 1000;
  if (from === 'g' && to === 'µg') return amount * 1_000_000;
  if (from === 'mg' && to === 'g') return amount / 1000;
  if (from === 'mg' && to === 'µg') return amount * 1000;
  if (from === 'µg' && to === 'mg') return amount / 1000;
  if (from === 'µg' && to === 'g') return amount / 1_000_000;
  return amount;
}

export function formatNutrientAmount(value) {
  const amount = Number(value) || 0;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
