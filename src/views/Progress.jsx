import { useState } from 'react';
import { Activity, Plus, SwatchBook } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MUSCLES } from '../data/exercises.js';
import { CardTitle, EmptyState } from '../components/ui.jsx';
import { estimateOneRepMax, fmtWeight, weekKey } from '../utils.js';

const COLOR_PRESETS = {
  mintHeat: { label: 'Mint heat', stops: ['#14243a', '#5db8ff', '#4fffb0', '#fbbf70'] },
  ember: { label: 'Ember', stops: ['#172033', '#ff6b8a', '#fbbf70', '#fff0a8'] },
  marine: { label: 'Marine', stops: ['#111d31', '#5db8ff', '#4fffb0', '#f7fbff'] },
  violet: { label: 'Violet', stops: ['#14182d', '#5db8ff', '#c084fc', '#ff6b8a'] }
};

const MUSCLE_REGIONS = [
  { muscle: 'chest', view: 'front', label: 'Chest', d: 'M126 104 C106 104 94 116 91 137 C105 144 122 144 138 136 L138 108 C135 106 131 104 126 104 Z M154 108 L154 136 C170 144 187 144 201 137 C198 116 186 104 166 104 C161 104 157 106 154 108 Z' },
  { muscle: 'abs', view: 'front', label: 'Abs', d: 'M139 143 L153 143 C158 158 158 188 151 210 L141 210 C134 188 134 158 139 143 Z M128 151 C121 165 120 190 128 210 L137 210 C131 190 131 166 136 144 Z M156 144 C161 166 161 190 155 210 L164 210 C172 190 171 165 164 151 Z' },
  { muscle: 'front_delts', view: 'front', label: 'Front delts', d: 'M85 111 C68 119 58 136 55 156 C66 156 78 151 88 140 C89 129 91 119 96 111 Z M196 111 C201 119 203 129 204 140 C214 151 226 156 237 156 C234 136 224 119 207 111 Z' },
  { muscle: 'side_delts', view: 'front', label: 'Side delts', d: 'M55 157 C43 177 41 197 47 215 C58 207 66 186 66 160 Z M237 157 C249 177 251 197 245 215 C234 207 226 186 226 160 Z' },
  { muscle: 'biceps', view: 'front', label: 'Biceps', d: 'M68 159 C68 183 62 205 53 225 C63 231 75 225 80 211 C85 193 85 173 78 158 Z M224 159 C224 183 230 205 239 225 C229 231 217 225 212 211 C207 193 207 173 214 158 Z' },
  { muscle: 'forearms', view: 'front', label: 'Forearms', d: 'M52 229 C42 247 37 268 39 288 C50 292 62 281 68 258 C72 244 70 234 62 229 Z M240 229 C250 247 255 268 253 288 C242 292 230 281 224 258 C220 244 222 234 230 229 Z' },
  { muscle: 'quads', view: 'front', label: 'Quads', d: 'M114 224 C101 253 99 293 111 333 C126 324 134 284 136 224 Z M156 224 C158 284 166 324 181 333 C193 293 191 253 178 224 Z' },
  { muscle: 'calves', view: 'front', label: 'Calves', d: 'M111 342 C102 370 101 403 109 429 C123 419 131 383 128 343 Z M164 343 C161 383 169 419 183 429 C191 403 190 370 181 342 Z' },
  { muscle: 'upper_back', view: 'back', label: 'Upper back', d: 'M414 105 C395 110 384 124 381 145 C399 154 425 153 438 139 L438 109 C431 105 423 103 414 105 Z M454 109 L454 139 C467 153 493 154 511 145 C508 124 497 110 478 105 C469 103 461 105 454 109 Z' },
  { muscle: 'lats', view: 'back', label: 'Lats', d: 'M378 147 C365 163 361 190 368 218 C389 207 405 184 412 150 C400 153 388 152 378 147 Z M514 147 C527 163 531 190 524 218 C503 207 487 184 480 150 C492 153 504 152 514 147 Z' },
  { muscle: 'rear_delts', view: 'back', label: 'Rear delts', d: 'M375 113 C357 121 347 138 345 158 C357 157 370 151 381 143 C382 130 386 119 393 111 Z M499 111 C506 119 510 130 511 143 C522 151 535 157 547 158 C545 138 535 121 517 113 Z' },
  { muscle: 'triceps', view: 'back', label: 'Triceps', d: 'M358 160 C358 184 351 207 342 226 C353 232 365 225 370 210 C376 190 376 173 368 158 Z M534 160 C534 184 541 207 550 226 C539 232 527 225 522 210 C516 190 516 173 524 158 Z' },
  { muscle: 'forearms', view: 'back', label: 'Forearms', d: 'M341 230 C331 249 327 270 330 289 C341 292 352 281 358 258 C362 244 360 234 352 230 Z M551 230 C561 249 565 270 562 289 C551 292 540 281 534 258 C530 244 532 234 540 230 Z' },
  { muscle: 'lower_back', view: 'back', label: 'Lower back', d: 'M425 148 C415 171 413 196 424 218 L438 218 L438 145 Z M454 145 L454 218 L468 218 C479 196 477 171 467 148 Z' },
  { muscle: 'glutes', view: 'back', label: 'Glutes', d: 'M409 223 C396 240 397 264 415 278 C429 269 436 249 438 225 Z M454 225 C456 249 463 269 477 278 C495 264 496 240 483 223 Z' },
  { muscle: 'hamstrings', view: 'back', label: 'Hamstrings', d: 'M407 282 C397 315 399 348 414 371 C429 350 436 318 436 282 Z M456 282 C456 318 463 350 478 371 C493 348 495 315 485 282 Z' },
  { muscle: 'calves', view: 'back', label: 'Calves', d: 'M414 378 C404 404 404 430 414 451 C428 438 435 407 430 378 Z M462 378 C457 407 464 438 478 451 C488 430 488 404 478 378 Z' }
];

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function colorAt(stops, ratio) {
  const bounded = Math.max(0, Math.min(1, ratio));
  const scaled = bounded * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const a = hexToRgb(stops[index]);
  const b = hexToRgb(stops[index + 1]);
  const channel = (key) => Math.round(a[key] + (b[key] - a[key]) * local);
  return `rgb(${channel('r')}, ${channel('g')}, ${channel('b')})`;
}

function BodyMuscleMap({ rows, preset }) {
  const volumeByMuscle = Object.fromEntries(rows.map((row) => [row.id, row.volume]));
  const maxVolume = Math.max(1, ...rows.map((row) => row.volume));
  const stops = COLOR_PRESETS[preset].stops;
  const fillFor = (muscle) => colorAt(stops, volumeByMuscle[muscle] / maxVolume);

  return (
    <div className="muscle-map-surface" role="img" aria-label="Front and back body muscle volume heat map">
      <svg className="muscle-map" viewBox="0 0 600 490" aria-hidden="true">
        <g className="body-guide">
          <circle cx="146" cy="54" r="28" />
          <path d="M112 91 C124 76 168 76 180 91 L166 222 L184 454 L158 454 L146 302 L134 454 L108 454 L126 222 Z" />
          <circle cx="446" cy="54" r="28" />
          <path d="M412 91 C424 76 468 76 480 91 L466 222 L484 454 L458 454 L446 302 L434 454 L408 454 L426 222 Z" />
        </g>
        {MUSCLE_REGIONS.map((region) => (
          <path key={`${region.view}-${region.muscle}-${region.label}`} className="muscle-region" d={region.d} fill={fillFor(region.muscle)}>
            <title>{region.label}: {Math.round(volumeByMuscle[region.muscle] ?? 0)} volume</title>
          </path>
        ))}
        <text x="146" y="478" textAnchor="middle" className="muscle-map-label">Front</text>
        <text x="446" y="478" textAnchor="middle" className="muscle-map-label">Back</text>
      </svg>
    </div>
  );
}

export default function Progress({ muscleVolume, workouts, exercises, bodyweightLogs, units, onLogBodyweight }) {
  const [colorPreset, setColorPreset] = useState('mintHeat');
  const currentWeek = weekKey();
  const muscleRows = MUSCLES.map((muscle) => ({
    id: muscle,
    muscle: muscle.replaceAll('_', ' '),
    volume: Math.round(muscleVolume.find((row) => row.muscle === muscle && row.weekKey === currentWeek)?.volume ?? 0)
  }));
  const strength = workouts.flatMap((workout) => (workout.sets ?? []).map((set) => ({
    date: workout.date.slice(5, 10),
    exercise: exercises.find((item) => String(item.id) === String(set.exerciseId))?.name ?? 'Lift',
    e1rm: estimateOneRepMax(set.weight, set.reps)
  }))).slice(-18);
  const weightRows = bodyweightLogs.map((row) => ({ date: row.date.slice(5, 10), weight: row.weight }));
  return (
    <main className="page">
      <div className="split">
        <div>
          <h1 className="font-display page-title">Progress</h1>
          <p className="secondary">Muscle volume, strength curves, nutrition adherence, and bodyweight trends.</p>
        </div>
        <button className="btn-primary" type="button" onClick={onLogBodyweight}><Plus size={18} /> Bodyweight</button>
      </div>

      <div className="grid-auto">
        <section className="glass panel stack">
          <CardTitle
            icon={Activity}
            action={
              <label className="row" style={{ gap: 8 }}>
                <SwatchBook size={17} />
                <select className="glass-input" value={colorPreset} onChange={(event) => setColorPreset(event.target.value)} style={{ width: 156 }}>
                  {Object.entries(COLOR_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
                </select>
              </label>
            }
          >
            Muscle map
          </CardTitle>
          <BodyMuscleMap rows={muscleRows} preset={colorPreset} />
          <div className="muscle-legend">
            <span className="muted">Low</span>
            <div className="muscle-legend-bar" style={{ background: `linear-gradient(90deg, ${COLOR_PRESETS[colorPreset].stops.join(', ')})` }} />
            <span className="muted">High</span>
          </div>
        </section>

        <section className="glass panel stack">
          <CardTitle>Weekly muscle volume</CardTitle>
          {muscleRows.some((row) => row.volume) ? (
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={muscleRows}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="muscle" hide />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip />
                <Bar dataKey="volume" fill="var(--accent-mint)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No muscle volume">Log a workout to populate this chart.</EmptyState>}
        </section>

        <section className="glass panel stack">
          <CardTitle>Strength curve</CardTitle>
          {strength.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={strength}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip formatter={(value) => fmtWeight(value, units)} />
                <Area dataKey="e1rm" stroke="var(--accent-blue)" fill="rgba(93,184,255,0.22)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No strength data">Your estimated one-rep max trend appears after workouts.</EmptyState>}
        </section>

        <section className="glass panel stack">
          <CardTitle>Bodyweight</CardTitle>
          {weightRows.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={weightRows}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip formatter={(value) => fmtWeight(value, units)} />
                <Area dataKey="weight" stroke="var(--accent-purple)" fill="rgba(192,132,252,0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No bodyweight logs">Add one from the button above.</EmptyState>}
        </section>
      </div>
    </main>
  );
}
