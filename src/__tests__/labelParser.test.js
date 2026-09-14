import { describe, expect, it } from 'vitest';
import { parseNutritionLabel } from '../labelParser.js';

describe('parseNutritionLabel', () => {
  it('reads a UK-style label with per-100g and per-serving columns', () => {
    const text = `
      Typical Values
      per 100g        per 30g serving
      Energy           1780kJ/425kcal   534kJ/127kcal
      Fat              20.5g            6.2g
      of which saturates 12.9g          3.9g
      Carbohydrate     56.5g            17.0g
      of which sugars  35.0g            10.5g
      Fibre            3.0g             0.9g
      Protein          6.0g             1.8g
      Salt             1.10g            0.33g
    `;
    const result = parseNutritionLabel(text);
    expect(result.per100).toEqual({
      calories: 425,
      fat: 20.5,
      carbs: 56.5,
      sugar: 35.0,
      fibre: 3.0,
      protein: 6.0,
      salt: 1.10
    });
    expect(result.matched).toBe(7);
  });

  it('reads a US-style label with sodium and no 100g column, scaling from the serving size', () => {
    const text = `
      Nutrition Facts
      Serving size 2/3 cup (55g)
      Amount per serving
      Calories 230
      Total Fat 8g
      Saturated Fat 1g
      Sodium 160mg
      Total Carbohydrate 37g
      Dietary Fiber 4g
      Total Sugars 12g
      Protein 3g
    `;
    const result = parseNutritionLabel(text);
    // 55g serving -> scale factor 100/55 ≈ 1.8182
    expect(result.servingGrams).toBe(55);
    expect(result.per100.calories).toBeCloseTo(230 * (100 / 55), 0);
    expect(result.per100.fat).toBeCloseTo(8 * (100 / 55), 1);
    expect(result.per100.carbs).toBeCloseTo(37 * (100 / 55), 1);
    expect(result.per100.fibre).toBeCloseTo(4 * (100 / 55), 1);
    expect(result.per100.sugar).toBeCloseTo(12 * (100 / 55), 1);
    expect(result.per100.protein).toBeCloseTo(3 * (100 / 55), 1);
    // Sodium 160mg -> salt = 160/1000 * 2.5 = 0.4g, then scaled to per-100g.
    expect(result.per100.salt).toBeCloseTo(0.4 * (100 / 55), 1);
  });

  it('does not confuse "of which saturates" with the total fat line', () => {
    const text = `
      per 100g
      Saturated Fat 12.9g
      Fat 20.5g
    `;
    const result = parseNutritionLabel(text);
    expect(result.per100.fat).toBe(20.5);
  });

  it('does not confuse "of which sugars" with the total carbohydrate line', () => {
    const text = `
      per 100g
      of which sugars 35.0g
      Carbohydrate 56.5g
    `;
    const result = parseNutritionLabel(text);
    expect(result.per100.carbs).toBe(56.5);
    expect(result.per100.sugar).toBe(35.0);
  });

  it('prefers an explicit salt line over sodium', () => {
    const text = `
      per 100g
      Sodium 400mg
      Salt 1.10g
    `;
    const result = parseNutritionLabel(text);
    expect(result.per100.salt).toBe(1.10);
  });

  it('handles decimal commas', () => {
    const text = `
      per 100g
      Fat 20,5g
      Protein 6,0g
    `;
    const result = parseNutritionLabel(text);
    expect(result.per100.fat).toBe(20.5);
    expect(result.per100.protein).toBe(6.0);
  });

  it('reads the serving size, not the 100g heading, when both numbers land on one OCR line', () => {
    // Real Tesseract output for a UK label where "per 100g" and "per 30g
    // serving" both flattened onto a single line — regression test for a bug
    // where the 100g heading's own number was picked up as the serving size.
    const text = 'per 100g per 30g serving\nEnergy 425kcal 127kcal\nProtein 6.0g 1.8g';
    const result = parseNutritionLabel(text);
    expect(result.servingGrams).toBe(30);
  });

  it('reads a US-style "Serving size 2/3 cup (55g)" line', () => {
    const text = 'Serving size 2/3 cup (55g)\nCalories 230';
    const result = parseNutritionLabel(text);
    expect(result.servingGrams).toBe(55);
  });

  it('returns an empty per100 with matched 0 for unreadable text', () => {
    const result = parseNutritionLabel('lorem ipsum dolor sit amet');
    expect(result.per100).toEqual({});
    expect(result.matched).toBe(0);
    expect(result.servingGrams).toBeNull();
  });

  it('leaves values unscaled when no serving size and no 100g heading are found', () => {
    const text = `
      Calories 200
      Protein 10g
    `;
    const result = parseNutritionLabel(text);
    expect(result.per100.calories).toBe(200);
    expect(result.per100.protein).toBe(10);
    expect(result.servingGrams).toBeNull();
  });
});
