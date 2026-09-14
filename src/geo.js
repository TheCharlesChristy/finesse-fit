// Pure GPS / route maths. No browser APIs, no Dexie — the geolocation hook
// (components/useGeolocation.js) feeds fixes in, the session reducer
// (session.js) owns the resulting track, and views only format it.
//
// Track points are compact arrays, not objects, because a one-hour run at
// one fix per second is ~3,600 of them and they're stored in IndexedDB and in
// the JSON backup:  [lat, lon, timeMs, accuracyM, altitudeM | null]
// A track is a list of segments (a new one starts after every pause) so the
// distance and moving time never include the gap while paused.

export const LAT = 0;
export const LON = 1;
export const T = 2;
export const ACC = 3;
export const ALT = 4;

export const METERS_PER_MILE = 1609.344;
const EARTH_RADIUS = 6_371_008.8;
const toRad = (deg) => (deg * Math.PI) / 180;
const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function haversine(a, b) {
  const dLat = toRad(b[LAT] - a[LAT]);
  const dLon = toRad(b[LON] - a[LON]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[LAT])) * Math.cos(toRad(b[LAT])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathDistance(latlngs = []) {
  let total = 0;
  for (let i = 1; i < latlngs.length; i += 1) total += haversine(latlngs[i - 1], latlngs[i]);
  return total;
}

// ---- Recording ----

export const FIX_FILTER = {
  maxAccuracy: 35, // metres — worse fixes (indoors, cold start) are ignored outright
  maxSpeed: 12, // m/s ≈ 43 km/h — anything faster is a GPS jump, not a runner
  minMove: 3, // metres — below this (or half the accuracy) it's jitter while standing
  jumpStreak: 5 // after this many "impossible" fixes in a row, trust the new position
};

export const emptyTrack = () => ({ segments: [], distance: 0, streak: 0 });

export function fixFromPosition(position) {
  const { latitude, longitude, accuracy, altitude } = position.coords;
  return [round6(latitude), round6(longitude), position.timestamp ?? Date.now(), Math.round(num(accuracy, 999)), altitude == null ? null : Math.round(altitude * 10) / 10];
}
const round6 = (value) => Math.round(value * 1e6) / 1e6;

// A new segment begins the next time a fix is accepted.
export function startSegment(track = emptyTrack()) {
  const last = track.segments.at(-1);
  if (last && !last.length) return track;
  return { ...track, segments: [...track.segments, []], streak: 0 };
}

// Returns the same track object when the fix is rejected, so callers can
// skip a re-render.
export function appendFix(track = emptyTrack(), fix, options = {}) {
  const opts = { ...FIX_FILTER, ...options };
  if (!Array.isArray(fix) || num(fix[ACC], 999) > opts.maxAccuracy) return track;
  const segments = track.segments.length ? track.segments : [[]];
  const segment = segments.at(-1);
  const anchor = segment.at(-1);
  const replaceLast = (points, distance, streak = 0) => ({ segments: [...segments.slice(0, -1), points], distance, streak });

  if (!anchor) return replaceLast([fix], track.distance);
  const dt = (fix[T] - anchor[T]) / 1000;
  if (dt <= 0) return track;
  const d = haversine(anchor, fix);
  if (d / dt > opts.maxSpeed) {
    const streak = track.streak + 1;
    // Several impossible fixes in a row means the anchor was the bad one:
    // re-anchor here without counting the jump as distance.
    return streak >= opts.jumpStreak ? { segments: [...segments, [fix]], distance: track.distance, streak: 0 } : { ...track, segments, streak };
  }
  if (d < Math.max(opts.minMove, num(fix[ACC]) * 0.5)) return track.streak ? { ...track, segments, streak: 0 } : track;
  return replaceLast([...segment, fix], track.distance + d);
}

export function trackDistance(segments = []) {
  return segments.reduce((sum, segment) => sum + pathDistance(segment), 0);
}

export function movingSeconds(segments = []) {
  return segments.reduce((sum, segment) => sum + (segment.length > 1 ? (segment.at(-1)[T] - segment[0][T]) / 1000 : 0), 0);
}

export function trackLatLngs(segments = []) {
  return segments.map((segment) => segment.map((point) => [point[LAT], point[LON]])).filter((segment) => segment.length);
}

// Pace over the last `windowSeconds` of the latest segment, in seconds per metre.
export function currentPace(segments = [], windowSeconds = 30) {
  const segment = segments.at(-1) ?? [];
  if (segment.length < 2) return null;
  const end = segment.at(-1)[T];
  let distance = 0;
  let start = end;
  for (let i = segment.length - 1; i > 0; i -= 1) {
    if (end - segment[i - 1][T] > windowSeconds * 1000) break;
    distance += haversine(segment[i - 1], segment[i]);
    start = segment[i - 1][T];
  }
  const seconds = (end - start) / 1000;
  return distance >= 15 && seconds > 0 ? seconds / distance : null;
}

// GPS altitude is noisy: only climbs that clear `threshold` metres count.
export function elevationGain(segments = [], threshold = 4) {
  let gain = 0;
  let seen = false;
  for (const segment of segments) {
    let base = null;
    for (const point of segment) {
      const alt = point[ALT];
      if (alt == null) continue;
      seen = true;
      if (base == null || alt < base) base = alt;
      else if (alt - base >= threshold) {
        gain += alt - base;
        base = alt;
      }
    }
  }
  return seen ? Math.round(gain) : null;
}

// Splits every `splitMeters` of moving distance, interpolating the moment
// each boundary was crossed. A trailing partial split is included when it's
// long enough to mean something.
export function computeSplits(segments = [], splitMeters = 1000) {
  const splits = [];
  let covered = 0;
  let elapsed = 0;
  let splitStartDistance = 0;
  let splitStartTime = 0;
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i += 1) {
      const d = haversine(segment[i - 1], segment[i]);
      const dt = (segment[i][T] - segment[i - 1][T]) / 1000;
      while (d > 0 && covered + d >= (splits.length + 1) * splitMeters) {
        const boundary = (splits.length + 1) * splitMeters;
        const crossAt = elapsed + dt * ((boundary - covered) / d);
        splits.push({ index: splits.length + 1, meters: boundary - splitStartDistance, seconds: crossAt - splitStartTime, partial: false });
        splitStartDistance = boundary;
        splitStartTime = crossAt;
      }
      covered += d;
      elapsed += dt;
    }
  }
  const rest = covered - splitStartDistance;
  if (rest >= Math.min(100, splitMeters * 0.1)) splits.push({ index: splits.length + 1, meters: rest, seconds: elapsed - splitStartTime, partial: true });
  return splits.map((split) => ({ ...split, meters: Math.round(split.meters), seconds: Math.round(split.seconds) }));
}

export function trackStats(segments = []) {
  const distance = trackDistance(segments);
  const moving = movingSeconds(segments);
  return {
    distance: Math.round(distance),
    movingSeconds: Math.round(moving),
    elevationGain: elevationGain(segments),
    points: segments.reduce((sum, segment) => sum + segment.length, 0)
  };
}

// ---- Units & formatting ----

export const splitLength = (units) => (units === 'imperial' ? METERS_PER_MILE : 1000);
export const distanceUnitLabel = (units) => (units === 'imperial' ? 'mi' : 'km');

export function toDisplayDistance(meters, units = 'metric') {
  return Math.round((num(meters) / splitLength(units)) * 100) / 100;
}

export function fromDisplayDistance(value, units = 'metric') {
  return Math.round(num(value) * splitLength(units));
}

export function fmtDistance(meters, units = 'metric') {
  const m = Math.max(0, num(meters));
  if (units === 'imperial') {
    return m < 160 ? `${Math.round(m * 1.0936)} yd` : `${(m / METERS_PER_MILE).toFixed(2)} mi`;
  }
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(num(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// secondsPerMeter → "5:12 /km". Absurd paces (standing still) read as "–".
export function fmtPace(secondsPerMeter, units = 'metric', { suffix = true } = {}) {
  const perUnit = num(secondsPerMeter) * splitLength(units);
  const label = suffix ? ` /${distanceUnitLabel(units)}` : '';
  if (!(perUnit > 0) || perUnit > 60 * 60) return `–${label}`;
  return `${fmtClock(perUnit)}${label}`;
}

export const paceOf = (seconds, meters) => (num(meters) > 0 && num(seconds) > 0 ? num(seconds) / num(meters) : null);

// ---- Shapes for display ----

// Keeps the ends and evenly samples the middle — plenty for a list thumbnail
// or a saved route, and stable (no floating-point RDP surprises in tests).
export function samplePath(latlngs = [], maxPoints = 60) {
  if (latlngs.length <= maxPoints) return latlngs.slice();
  const step = (latlngs.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => latlngs[Math.round(i * step)]);
}

// Projects lat/lngs into an SVG path `d` fitting a width×height box. Longitude
// is scaled by cos(latitude) so a square block of streets stays square.
export function previewPath(paths = [], width = 120, height = 72, padding = 6) {
  const all = paths.flat();
  if (all.length < 2) return '';
  const meanLat = all.reduce((sum, p) => sum + p[LAT], 0) / all.length;
  const k = Math.cos(toRad(meanLat));
  const xs = all.map((p) => p[LON] * k);
  const ys = all.map((p) => -p[LAT]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return paths
    .filter((path) => path.length > 1)
    .map((path) => path.map((p, i) => `${i ? 'L' : 'M'}${((p[LON] * k - minX) * scale + offX).toFixed(1)} ${((-p[LAT] - minY) * scale + offY).toFixed(1)}`).join(' '))
    .join(' ');
}

const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);

// GPX 1.1 — opens in Strava, Garmin Connect, Komoot, etc.
export function buildGpx({ name = 'Finesse Fit activity', segments = [], activity = 'run' } = {}) {
  const segmentXml = segments.filter((segment) => segment.length).map((segment) => [
    '    <trkseg>',
    ...segment.map((p) => `      <trkpt lat="${p[LAT]}" lon="${p[LON]}">${p[ALT] != null ? `<ele>${p[ALT]}</ele>` : ''}<time>${new Date(p[T]).toISOString()}</time></trkpt>`),
    '    </trkseg>'
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Finesse Fit" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <trk>',
    `    <name>${escapeXml(name)}</name>`,
    `    <type>${escapeXml(activity)}</type>`,
    ...segmentXml,
    '  </trk>',
    '</gpx>',
    ''
  ].join('\n');
}
