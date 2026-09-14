import { addFood, findFoodByBarcode } from './db.js';

const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product';
// The legacy search endpoint is the one Open Food Facts serves with CORS headers
// (search.openfoodfacts.org does not). It sheds load with fast 503s, so we retry.
const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const SEARCH_FIELDS = 'code,product_name,generic_name,brands,serving_size,serving_quantity,nutriments';
const SEARCH_ATTEMPTS = 3;
const SEARCH_TIMEOUT_MS = 9000;

const value = (product, keys) => {
  for (const key of keys) {
    const found = product?.nutriments?.[key];
    if (found !== '' && found != null && Number.isFinite(Number(found))) return Number(found);
  }
  return 0;
};

const firstBrand = (brands) => (Array.isArray(brands) ? brands[0] : brands?.split(',')[0])?.trim() || null;

function normaliseProduct(code, product, source = 'scan') {
  const name = product.product_name || product.generic_name || `Barcode ${code}`;
  const servingGrams = Number.parseFloat(product.serving_quantity);
  return {
    barcode: String(code),
    name: name.trim(),
    brand: firstBrand(product.brands),
    source,
    servings: [
      Number.isFinite(servingGrams) && servingGrams > 0
        ? { label: product.serving_size || 'serving', grams: servingGrams }
        : { label: '100 g', grams: 100 },
      { label: '100 g', grams: 100 }
    ],
    per100: {
      calories: value(product, ['energy-kcal_100g', 'energy-kcal']),
      protein: value(product, ['proteins_100g', 'proteins']),
      carbs: value(product, ['carbohydrates_100g', 'carbohydrates']),
      fat: value(product, ['fat_100g', 'fat']),
      fibre: value(product, ['fiber_100g', 'fiber']),
      sugar: value(product, ['sugars_100g', 'sugars']),
      salt: value(product, ['salt_100g', 'salt'])
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

export class FoodSearchError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason; // 'offline' | 'busy'
  }
}

// Results for a query are remembered for the session so repeat searches don't hit the network.
const searchCache = new Map();
const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function fetchSearchPage(query, signal) {
  const params = new URLSearchParams({ search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '30', fields: SEARCH_FIELDS });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  try {
    const response = await fetch(`${OFF_SEARCH_URL}?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

// Online name search. Returns normalised foods that are NOT yet saved — call
// saveSearchResult() for the one the user picks, which caches it locally for good.
export async function searchFoods(query, { signal } = {}) {
  const term = query.trim();
  const key = term.toLowerCase();
  if (term.length < 2) return [];
  if (searchCache.has(key)) return searchCache.get(key);
  if (navigator.onLine === false) throw new FoodSearchError('offline', 'You’re offline. Online search needs an internet connection.');

  for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const payload = await fetchSearchPage(term, signal);
      if (payload?.products) {
        const seen = new Set();
        const results = payload.products
          .filter((product) => product.code && (product.product_name || product.generic_name) && product.nutriments?.['energy-kcal_100g'] != null)
          .map((product) => normaliseProduct(product.code, product, 'search'))
          .filter((food) => !seen.has(food.barcode) && seen.add(food.barcode))
          .slice(0, 20);
        searchCache.set(key, results);
        return results;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      // Network failure or an overloaded 503 without CORS headers — fall through and retry.
    }
    if (attempt < SEARCH_ATTEMPTS - 1) await wait(1200 * (attempt + 1));
  }
  throw new FoodSearchError('busy', 'Open Food Facts search is busy right now. Try again in a moment.');
}

export async function saveSearchResult(food) {
  const cached = food.barcode ? await findFoodByBarcode(food.barcode) : null;
  if (cached) return cached;
  const id = await addFood(food);
  return { ...food, id };
}
