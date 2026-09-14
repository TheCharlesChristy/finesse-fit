/**
 * Turning raw OCR text of a nutrition label photo into candidate per-100g
 * macro values — pure text parsing, no Dexie, no React, no side effects.
 *
 * A photographed label is a much messier source than a barcode lookup: OCR
 * line breaks rarely land where the table's columns do, decimal commas and
 * decimal points both show up depending on the product's country of origin,
 * and layouts vary (UK/EU tables give both a "per 100g" and a "per serving"
 * column; US labels give only "per serving" plus sodium in mg instead of
 * salt in g). This is deliberately a best-effort reading, never the source
 * of truth — `ScanLabelModal` always hands its result to the same food form
 * a barcode or manual entry uses, so a wrong or missing value is just an
 * empty or incorrect field the user corrects before saving, never silently
 * wrong data.
 */

// Per UK/EU nutrition-label regulation, when a table has two value columns
// the "per 100g/100ml" column is always the first one, "per serving" second
// — so the first number on a matched line is taken as the 100g value
// whenever that heading is present anywhere on the label.
const PER_100_HEADING = /per\s*100\s*(g|ml)/i;
const SERVING_LINE = /serving/i;
// A "per 100g per 30g serving" heading often lands on one OCR'd line, so a
// bare "first gram number on a serving line" would grab the 100g heading
// instead of the real serving size — these two patterns anchor on adjacency
// to the word "serving" itself: a number immediately before it ("30g serving")
// or shortly after it ("Serving size 30g", "serving size 2/3 cup (55g)").
const GRAMS_BEFORE_SERVING = /(\d+(?:\.\d+)?)\s*g\s*serving/i;
const GRAMS_AFTER_SERVING = /serving[^\n]{0,24}?(\d+(?:\.\d+)?)\s*g\b/i;

const KCAL_NUMBER = /(\d+(?:\.\d+)?)\s*kcal/i;
const CALORIES_WORD_NUMBER = /\bcalories\b\D*(\d+(?:\.\d+)?)/i;
// Negative lookbehind excludes "mg" (sodium) from matching as a gram value.
const GRAM_NUMBER = /(\d+(?:\.\d+)?)\s*(?<!m)g\b/gi;
const MG_NUMBER = /(\d+(?:\.\d+)?)\s*mg\b/i;

const NUTRIENT_LINE_PATTERNS = {
  protein: /protein/i,
  carbs: /carbohydrate|\bcarbs?\b/i,
  fat: /\bfat\b/i,
  fibre: /fibre|fiber/i,
  sugar: /sugars?/i,
  salt: /\bsalt\b/i,
  sodium: /\bsodium\b/i
};

// A line matching one of these is a sub-line of another nutrient (e.g.
// "of which saturates" under "Fat") and must not be read as that nutrient's
// own total — fat's line match excludes these, protein/carbs/fibre/salt
// don't have same-word collisions so need no exclusion.
const FAT_EXCLUDE = /saturat/i;

function normaliseLines(text) {
  return String(text || '')
    .replace(/(\d),(\d)/g, '$1.$2') // decimal commas ("1,10g" -> "1.10g")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** First gram number on a line, honouring the "100g column comes first" convention. */
function firstGramValue(line) {
  const match = GRAM_NUMBER.exec(line);
  GRAM_NUMBER.lastIndex = 0; // GRAM_NUMBER is a shared /g regex — reset between calls
  return match ? Number.parseFloat(match[1]) : null;
}

function findCalories(lines) {
  for (const line of lines) {
    const match = KCAL_NUMBER.exec(line);
    if (match) return Number.parseFloat(match[1]);
  }
  for (const line of lines) {
    const match = CALORIES_WORD_NUMBER.exec(line);
    if (match) return Number.parseFloat(match[1]);
  }
  return null;
}

function findGramNutrient(lines, pattern, exclude) {
  for (const line of lines) {
    if (!pattern.test(line)) continue;
    if (exclude && exclude.test(line)) continue;
    const value = firstGramValue(line);
    if (value != null) return value;
  }
  return null;
}

/** Salt in grams, from an explicit "Salt" line or converted from sodium (salt = sodium × 2.5). */
function findSalt(lines) {
  const direct = findGramNutrient(lines, NUTRIENT_LINE_PATTERNS.salt);
  if (direct != null) return direct;

  for (const line of lines) {
    if (!NUTRIENT_LINE_PATTERNS.sodium.test(line)) continue;
    const mg = MG_NUMBER.exec(line);
    if (mg) return Math.round((Number.parseFloat(mg[1]) / 1000) * 2.5 * 100) / 100;
    const grams = firstGramValue(line);
    if (grams != null) return Math.round(grams * 2.5 * 100) / 100;
  }
  return null;
}

function findServingGrams(lines) {
  for (const line of lines) {
    if (!SERVING_LINE.test(line)) continue;
    const before = GRAMS_BEFORE_SERVING.exec(line);
    if (before) return Number.parseFloat(before[1]);
    const after = GRAMS_AFTER_SERVING.exec(line);
    if (after) return Number.parseFloat(after[1]);
  }
  return null;
}

const scale100 = (value, servingGrams) => (
  value == null || !servingGrams ? value : Math.round((value * (100 / servingGrams)) * 100) / 100
);

/**
 * Parse OCR'd nutrition-label text into candidate per-100g values.
 *
 * Returns `{ per100, servingGrams, matched }` — `per100` has a key for every
 * nutrient in `NUTRIENT_KEYS` that could be found (missing keys are left out
 * entirely, not zeroed, so the review form shows them blank rather than a
 * false 0), `servingGrams` is the detected serving size if one was stated,
 * and `matched` is the count of nutrients found — the caller uses it to
 * decide whether to say "read N values" or warn that almost nothing matched.
 */
export function parseNutritionLabel(text) {
  const lines = normaliseLines(text);
  const hasPer100Column = lines.some((line) => PER_100_HEADING.test(line));
  const servingGrams = findServingGrams(lines);
  // Scale per-serving readings up to per-100g only when there's no explicit
  // 100g column to read directly and a serving size was actually found.
  const scaleNeeded = !hasPer100Column && servingGrams;

  const raw = {
    calories: findCalories(lines),
    protein: findGramNutrient(lines, NUTRIENT_LINE_PATTERNS.protein),
    carbs: findGramNutrient(lines, NUTRIENT_LINE_PATTERNS.carbs, NUTRIENT_LINE_PATTERNS.sugar),
    fat: findGramNutrient(lines, NUTRIENT_LINE_PATTERNS.fat, FAT_EXCLUDE),
    fibre: findGramNutrient(lines, NUTRIENT_LINE_PATTERNS.fibre),
    sugar: findGramNutrient(lines, NUTRIENT_LINE_PATTERNS.sugar),
    salt: findSalt(lines)
  };

  const per100 = {};
  let matched = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    per100[key] = scaleNeeded ? scale100(value, servingGrams) : value;
    matched += 1;
  }

  return { per100, servingGrams: servingGrams ?? null, matched };
}
