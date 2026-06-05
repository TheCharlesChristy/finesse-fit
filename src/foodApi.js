import { addFood, findFoodByBarcode } from './db.js';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';

const value = (product, keys) => {
  for (const key of keys) {
    const found = product?.nutriments?.[key];
    if (Number.isFinite(Number(found))) return Number(found);
  }
  return 0;
};

function normaliseProduct(code, product) {
  const name = product.product_name || product.generic_name || `Barcode ${code}`;
  return {
    barcode: String(code),
    name,
    brand: product.brands?.split(',')[0]?.trim() || null,
    source: 'scan',
    servings: [
      { label: product.serving_size || 'serving', grams: Number.parseFloat(product.serving_quantity) || 100 },
      { label: '100 g', grams: 100 }
    ],
    per100: {
      calories: value(product, ['energy-kcal_100g', 'energy-kcal']),
      protein: value(product, ['proteins_100g', 'proteins']),
      carbs: value(product, ['carbohydrates_100g', 'carbohydrates']),
      fat: value(product, ['fat_100g', 'fat'])
    }
  };
}

export async function resolveBarcode(code) {
  const cached = await findFoodByBarcode(code);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`${OFF_URL}/${encodeURIComponent(code)}.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload.status !== 1 || !payload.product) return null;
    const food = normaliseProduct(code, payload.product);
    const id = await addFood(food);
    return { ...food, id };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
