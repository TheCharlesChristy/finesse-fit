// The one place the map-tile source is configured.
//
// Map tiles are the app's third kind of network traffic (after Open Food
// Facts in foodApi.js and route snapping in routingApi.js): whenever a map is
// on screen, Leaflet loads 256px PNG images of that area from OpenStreetMap's
// tile servers. Those requests reveal the tile coordinates being viewed (so,
// roughly, the area on the map) and the device's IP address — nothing else.
// GPS fixes, tracks and routes never leave the device through here.
//
// OSM's tile usage policy requires visible attribution and no bulk/offline
// pre-fetching. The service worker only caches tiles that were actually viewed
// (see vite.config.js `runtimeCaching`), which the policy allows.

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_HOST = 'tile.openstreetmap.org';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
export const TILE_MAX_ZOOM = 19;
