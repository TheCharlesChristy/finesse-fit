import { describe, expect, it } from 'vitest';
import {
  appendFix, buildGpx, computeSplits, currentPace, elevationGain, emptyTrack, fmtClock, fmtDistance, fmtPace,
  fromDisplayDistance, haversine, movingSeconds, pathDistance, previewPath, samplePath, startSegment, toDisplayDistance, trackDistance
} from '../geo.js';

// ~1.112 m per 0.00001° of latitude.
const METERS_PER_DEG_LAT = 111_195;
const north = (meters, seconds, { acc = 5, alt = null, lat0 = 51.5, lon = -0.12, t0 = 1_000_000 } = {}) => [lat0 + meters / METERS_PER_DEG_LAT, lon, t0 + seconds * 1000, acc, alt];

// A steady run due north: `speed` m/s, one fix per second.
const run = (seconds, speed = 3, options) => Array.from({ length: seconds + 1 }, (_, s) => north(s * speed, s, options));

describe('haversine / pathDistance', () => {
  it('measures a degree of latitude as ~111 km', () => {
    expect(haversine([0, 0], [1, 0]) / 1000).toBeCloseTo(111.2, 1);
  });

  it('sums a path', () => {
    expect(pathDistance([north(0, 0), north(100, 0), north(250, 0)])).toBeCloseTo(250, 0);
  });
});

describe('appendFix — filtering GPS noise while recording', () => {
  const record = (fixes, track = emptyTrack()) => fixes.reduce((current, fix) => appendFix(current, fix), track);

  it('accumulates distance along a clean run', () => {
    const track = record(run(100, 3));
    expect(track.distance).toBeCloseTo(300, -1);
    expect(trackDistance(track.segments)).toBeCloseTo(track.distance, 5);
  });

  it('ignores fixes that are too inaccurate', () => {
    const track = record([north(0, 0), north(50, 10, { acc: 80 })]);
    expect(track.distance).toBe(0);
    expect(track.segments[0]).toHaveLength(1);
  });

  it('does not count jitter while standing still', () => {
    const jitter = [0, 1.5, -1, 2, 0.5, -1.5, 1].map((m, s) => north(m, s, { acc: 8 }));
    expect(record(jitter).distance).toBe(0);
  });

  it('drops a single impossible jump but keeps the run going', () => {
    const fixes = [...run(10, 3), north(2000, 11), ...run(10, 3, { t0: 1_000_000 + 12_000 }).map((fix) => [fix[0] + 30 / METERS_PER_DEG_LAT, ...fix.slice(1)])];
    const track = record(fixes);
    expect(track.distance).toBeGreaterThan(50);
    expect(track.distance).toBeLessThan(100);
  });

  it('re-anchors after a streak of "impossible" fixes instead of freezing forever', () => {
    const far = Array.from({ length: 6 }, (_, i) => north(5000 + i * 3, 2 + i));
    const track = record([north(0, 0), north(3, 1), ...far]);
    expect(track.segments.length).toBe(2);
    expect(track.segments[1].length).toBeGreaterThan(1);
    expect(track.distance).toBeLessThan(30); // the jump itself isn't distance
  });

  it('never counts the gap between segments', () => {
    let track = record(run(10, 3));
    track = startSegment(track);
    track = record(run(10, 3, { lat0: 51.6, t0: 1_000_000 + 60_000 }), track);
    expect(track.segments).toHaveLength(2);
    expect(track.distance).toBeCloseTo(60, -1);
    expect(movingSeconds(track.segments)).toBe(20);
  });

  it('returns the same object for a rejected fix (so the UI can skip a render)', () => {
    const track = record([north(0, 0)]);
    expect(appendFix(track, north(0.5, 1))).toBe(track);
  });
});

describe('pace, splits, elevation', () => {
  it('reads current pace over the recent window', () => {
    const track = { segments: [run(60, 4)] };
    expect(currentPace(track.segments)).toBeCloseTo(0.25, 2);
  });

  it('has no pace without enough movement', () => {
    expect(currentPace([[north(0, 0), north(3, 1)]])).toBeNull();
  });

  it('splits a steady 2.5 km run into two full kilometres and a partial', () => {
    const splits = computeSplits([run(625, 4)], 1000);
    expect(splits.map((split) => split.partial)).toEqual([false, false, true]);
    expect(splits[0].seconds).toBeCloseTo(250, -1);
    expect(splits[1].meters).toBe(1000);
    expect(splits[2].meters).toBeCloseTo(500, -1);
  });

  it('ignores GPS altitude wobble but counts a real climb', () => {
    const wobble = [100, 102, 99, 101, 100].map((alt, s) => north(s * 3, s, { alt }));
    const climb = [100, 103, 106, 109, 112].map((alt, s) => north(s * 3, s, { alt }));
    expect(elevationGain([wobble])).toBe(0);
    expect(elevationGain([climb])).toBe(12);
    expect(elevationGain([run(5)])).toBeNull();
  });
});

describe('formatting & units', () => {
  it('formats distances in the profile units', () => {
    expect(fmtDistance(400)).toBe('400 m');
    expect(fmtDistance(5210)).toBe('5.21 km');
    expect(fmtDistance(1609.344, 'imperial')).toBe('1.00 mi');
    expect(fmtDistance(91.44, 'imperial')).toBe('100 yd');
  });

  it('round-trips display distances', () => {
    expect(fromDisplayDistance(toDisplayDistance(5000))).toBe(5000);
    expect(fromDisplayDistance(3.1, 'imperial')).toBe(4989);
  });

  it('formats clocks and paces', () => {
    expect(fmtClock(75)).toBe('1:15');
    expect(fmtClock(3725)).toBe('1:02:05');
    expect(fmtPace(0.312)).toBe('5:12 /km');
    expect(fmtPace(0.312, 'imperial')).toBe('8:22 /mi');
    expect(fmtPace(null)).toBe('– /km');
    expect(fmtPace(10)).toBe('– /km'); // standing still isn't a pace
  });
});

describe('shapes', () => {
  it('samples long paths down, keeping both ends', () => {
    const path = Array.from({ length: 1000 }, (_, i) => [i, i]);
    const sampled = samplePath(path, 50);
    expect(sampled).toHaveLength(50);
    expect(sampled[0]).toEqual([0, 0]);
    expect(sampled.at(-1)).toEqual([999, 999]);
  });

  it('projects a preview path inside its box', () => {
    const d = previewPath([[[51.5, -0.12], [51.51, -0.12], [51.51, -0.1]]], 100, 60, 5);
    const numbers = d.match(/-?\d+(\.\d+)?/g).map(Number);
    expect(d.startsWith('M')).toBe(true);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100);
  });

  it('writes a GPX track with one trkseg per segment and escaped names', () => {
    const gpx = buildGpx({ name: 'Park <loop> & back', segments: [run(2), run(1, 3, { alt: 12 })] });
    expect(gpx).toContain('<name>Park &lt;loop&gt; &amp; back</name>');
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx.match(/<trkpt /g)).toHaveLength(5);
    expect(gpx).toContain('<ele>12</ele>');
  });
});
