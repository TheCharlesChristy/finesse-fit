// Route snapping for the route planner — the second network module (see
// foodApi.js for the first, mapTiles.js for map images).
//
// Only ever called when the user taps the map with "Follow paths" switched on:
// it sends the two waypoints of the new leg (their coordinates, nothing else)
// to the FOSSGIS-run OSRM server that openstreetmap.org itself uses for
// directions, and gets back a walking path between them. Planned routes are
// then stored locally; running one is fully offline.
//
// The public server is for light use — one request per tap, sequential, cached
// for the session — never call it in a loop or on a timer.

const BASE = 'https://routing.openstreetmap.de';
const PROFILES = { foot: 'routed-foot/route/v1/foot', bike: 'routed-bike/route/v1/bike' };
const TIMEOUT_MS = 10_000;
const cache = new Map();

export class RoutingError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'RoutingError';
    this.reason = reason; // 'offline' | 'unavailable' | 'no-route'
  }
}

const fixed = (value) => Number(value).toFixed(6);

// from/to: [lat, lon] → { path: [[lat, lon]], distance: metres }
export async function routeLeg(from, to, { profile = 'foot', signal } = {}) {
  const key = `${profile}:${fixed(from[0])},${fixed(from[1])}>${fixed(to[0])},${fixed(to[1])}`;
  if (cache.has(key)) return cache.get(key);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new RoutingError('offline', 'You’re offline — drawing straight lines instead.');

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, TIMEOUT_MS);
  try {
    // OSRM takes lon,lat.
    const coords = `${fixed(from[1])},${fixed(from[0])};${fixed(to[1])},${fixed(to[0])}`;
    const response = await fetch(`${BASE}/${PROFILES[profile] ?? PROFILES.foot}/${coords}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal });
    if (!response.ok) throw new RoutingError('unavailable', 'The routing service is busy — drew a straight line instead.');
    const body = await response.json();
    const route = body?.routes?.[0];
    if (body?.code !== 'Ok' || !route?.geometry?.coordinates?.length) throw new RoutingError('no-route', 'No path found between those points — drew a straight line instead.');
    const result = { path: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]), distance: Math.round(route.distance) };
    cache.set(key, result);
    return result;
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    if (signal?.aborted) throw error;
    throw new RoutingError('unavailable', 'Couldn’t reach the routing service — drew a straight line instead.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
