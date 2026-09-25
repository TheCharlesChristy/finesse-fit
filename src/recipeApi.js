// Recipe discovery for the taste-profile swipe deck — the third network
// module (see foodApi.js for the first, routingApi.js for the second,
// mapTiles.js for map images).
//
// Only ever called while FoodSwiper.jsx is on screen: one request per card,
// sequential, never a batch and never on a timer. Each response is a public
// recipe name/photo/category/area from TheMealDB's free test API — nothing
// about the user is sent. Nothing is cached: a card the user swipes is asked
// for again only because a *new* card is needed, never re-fetched, and only
// the recipe's name is kept (in profile.tasteProfile) — the photo is
// discarded once the card is decided, so re-reading a saved taste profile
// never needs the network again.

const RANDOM_URL = 'https://www.themealdb.com/api/json/v1/1/random.php';
const TIMEOUT_MS = 8000;

export class RecipeFetchError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'RecipeFetchError';
    this.reason = reason; // 'offline' | 'unavailable'
  }
}

function normaliseMeal(meal) {
  return {
    id: meal.idMeal,
    name: meal.strMeal,
    image: meal.strMealThumb ? `${meal.strMealThumb}/preview` : null,
    category: meal.strCategory || null,
    area: meal.strArea || null
  };
}

export async function fetchRandomRecipe({ signal } = {}) {
  if (navigator.onLine === false) throw new RecipeFetchError('offline', 'You’re offline — recipe swiping needs an internet connection.');

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  const timer = window.setTimeout(abort, TIMEOUT_MS);
  try {
    const response = await fetch(RANDOM_URL, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new RecipeFetchError('unavailable', 'The recipe database is unavailable right now.');
    const payload = await response.json();
    const meal = payload?.meals?.[0];
    if (!meal?.strMeal) throw new RecipeFetchError('unavailable', 'The recipe database is unavailable right now.');
    return normaliseMeal(meal);
  } catch (error) {
    if (error instanceof RecipeFetchError) throw error;
    if (signal?.aborted) throw error;
    throw new RecipeFetchError('unavailable', 'Couldn’t reach the recipe database — check your connection and try again.');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
