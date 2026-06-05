# Finesse Fit — Developer Guide

A personal fitness PWA built with React + Vite + Dexie.js. It tracks workouts, food, and nutrition against goals. All data lives in the browser's IndexedDB — no backend, no accounts. The only runtime network call is resolving a scanned barcode (once per product, then cached).

Architecturally identical to the **Finesse** finance app: reads at the root via `useLiveQuery`, mutations in `db.js`, pure logic in `utils.js`, views are presentational.

---

## Stack

| Layer | Library | Version | Purpose |
|---|---|---|---|
| Framework | React | 19 | UI |
| Build | Vite | 8 | Dev server, production bundler |
| CSS | Tailwind CSS | 4 | Utility classes (used sparingly) |
| Database | Dexie.js | 4 | IndexedDB wrapper |
| DB hooks | dexie-react-hooks | 4 | `useLiveQuery` reactive queries |
| Charts | Recharts | 3 | Progress visualisations |
| Icons | lucide-react | 1 | Icon set |
| Dates | date-fns | 4 | Date arithmetic |
| Scanning | @zxing/browser | latest | Barcode decode fallback |

---

## Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build locally
npm run lint      # ESLint
```

---

## Project structure

```
src/
├── main.jsx              # React entry point + PWA service worker registration
├── App.jsx               # Root: nav, modal state, all useLiveQuery calls, orchestration
├── db.js                 # Dexie schema + all database helpers
├── utils.js              # Pure functions: nutrition math, volume math, formatting, dates
├── foodApi.js            # Open Food Facts resolution (the ONLY network module)
├── index.css             # Design system: CSS variables, glass classes, base styles
│
├── data/
│   └── exercises.js      # Seeded exercise library with muscle mappings
│
├── views/
│   ├── Dashboard.jsx     # Today's macros, meals, training, goals
│   ├── LogFood.jsx       # Barcode scan + search + quantity entry (the hero screen)
│   ├── Foods.jsx         # Food library management
│   ├── Workouts.jsx      # Session + set logging
│   ├── Progress.jsx      # Per-muscle volume, muscle map, strength & bodyweight charts
│   ├── Goals.jsx         # Goal tracking
│   └── Settings.jsx      # Targets, units, theme, export/import
│
└── components/
    ├── Modals.jsx        # AddFoodModal, LogFoodModal, AddExerciseModal, LogWorkoutModal,
    │                     # AddGoalModal, ImportModeModal, ...
    ├── ui.jsx            # Modal, Field, IconButton, CardTitle
    ├── useDialog.jsx     # Promise-based confirm/alert/prompt
    ├── ItemSelect.jsx    # Searchable select (foods / exercises / meals)
    ├── DateInput.jsx     # Accessible date picker
    └── BarcodeScanner.jsx# Camera capture + decode
```

---

## Data layer (`src/db.js`)

### Schema

The Dexie database is named `FinesseFit`, schema version 1.

| Table | Key | Indexed fields | Description |
|---|---|---|---|
| `profile` | `++id` | — | Singleton: units, bodyweight, activity level, calorie + macro targets |
| `foods` | `++id` | `barcode`, `name` | Food library: scanned, searched, or custom |
| `foodLogs` | `++id` | `date`, `mealType` | Individual eating occasions with frozen computed macros |
| `dailyTotals` | `++id` | `&date` | Derived per-day calorie/macro aggregates (one row per date) |
| `exercises` | `++id` | `name` | Custom exercises (the built-in seed lives in `data/exercises.js`) |
| `workouts` | `++id` | `date` | Sessions containing an array of sets |
| `muscleVolume` | `++id` | `muscle`, `weekKey` | Derived per-muscle weekly volume aggregates |
| `bodyweightLogs` | `++id` | `date` | Bodyweight measurements |
| `goals` | `++id` | `type` | Tracked goals |

### Profile shape (singleton)

```js
{
  id: 1,                        // always 1
  units: 'metric',              // 'metric' | 'imperial'
  bodyweight: 78,               // canonical kg
  activityLevel: 'moderate',
  targets: {
    calories: 2600,
    protein: 180,               // grams
    carbs: 280,
    fat: 80,
  },
  themeMode: 'dark',            // 'dark' | 'light' | 'system'
}
```

### Food shape

```js
{
  id: 1,
  barcode: '5000159484695',     // nullable
  name: 'Greek Yoghurt',
  brand: 'Brand',               // nullable
  source: 'scan',               // 'scan' | 'search' | 'custom'
  servings: [
    { label: 'pot', grams: 150 },
    { label: '100 g', grams: 100 },
  ],
  per100: { calories: 97, protein: 9, carbs: 4, fat: 5 },  // canonical basis
}
```

### Food log shape

```js
{
  id: 1,
  foodId: 1,
  date: '2026-06-05T08:20:00Z',
  mealType: 'breakfast',        // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  quantity: 150,
  unit: 'g',
  computed: { calories: 146, protein: 14, carbs: 6, fat: 8 },  // FROZEN at log time
}
```

### Exercise shape

```js
{
  id: 1,
  name: 'Barbell Bench Press',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['front_delts', 'triceps'],
  equipment: 'barbell',
  isCustom: false,
}
```

### Workout shape

```js
{
  id: 1,
  date: '2026-06-05T18:00:00Z',
  sets: [
    { exerciseId: 1, reps: 8, weight: 80, rpe: 8 },
    { exerciseId: 1, reps: 8, weight: 80, rpe: 9 },
  ],
}
```

### Goal shape

```js
{
  id: 1,
  type: 'strength',             // 'strength' | 'bodyweight' | 'volume' | 'nutrition'
  title: 'Bench 100kg',
  target: 100,
  // type-specific refs, e.g. exerciseId for strength, muscle for volume
  exerciseId: 1,
  history: [{ date, value }],   // optional snapshots
}
```

### Important: derived counters

`dailyTotals` and `muscleVolume` are **derived counters**, not computed from source rows on the fly. The helper functions in `db.js` update them directly when a log or workout is added, edited, or deleted, all inside the same transaction:

- Add a food log → `dailyTotals[date] += computed macros`
- Delete a food log → `dailyTotals[date] -= computed macros` (floored at 0)
- Add a workout → for each set, attribute volume to the exercise's muscles → `muscleVolume[muscle][week] += contribution`
- Delete/edit a workout → apply the inverse/delta

This is the exact pattern Finesse uses for `categories.spent`. It keeps reads O(1) and the UI instantly reactive. Source records (`foodLogs`, `workouts`) are never deleted on any reset — they are retained for history and charts.

### Volume attribution

When a set is logged, its working volume (e.g. `reps × weight`) is attributed to the exercise's muscles. Primary muscles receive the full contribution; secondary muscles receive a fraction (default 0.5). The weighting factor lives in `utils.js` so it's easy to tune. Attribution is keyed by ISO week (`weekKey`) so the muscle map and volume charts can show "this week" cleanly.

### Schema migrations

To add a field or table, increment the version and keep all prior `version()` calls:

```js
db.version(2).stores({
  profile: '++id',
  foods: '++id, barcode, name',
  foodLogs: '++id, date, mealType',
  dailyTotals: '++id, &date',
  exercises: '++id, name',
  workouts: '++id, date',
  muscleVolume: '++id, muscle, weekKey',
  bodyweightLogs: '++id, date',
  goals: '++id, type',
  // new table:
  recipes: '++id, name',
}).upgrade(tx => {
  // optional data migration
});
```

Dexie handles the upgrade automatically on next open.

---

## The barcode subsystem

Two pieces: capture and resolution.

### Capture (`components/BarcodeScanner.jsx`)

- Prefers the native **`BarcodeDetector`** API when present (fast, battery-friendly — Android Chrome)
- Falls back to **`@zxing/browser`** decoding the camera stream where it isn't (notably **iOS Safari**)
- Supports EAN-13, EAN-8, UPC-A, UPC-E
- Acquires the rear camera via `getUserMedia`, gives visual feedback on detection, debounces duplicate reads, and **releases the stream when closed**
- Returns a barcode string to the caller; it does no resolution itself

### Resolution (`foodApi.js`) — the only network module

```
scan → resolveBarcode(code):
  1. look up `foods` where barcode === code      → hit: return cached food (NO network)
  2. miss: GET Open Food Facts (bounded timeout)
       success → normalise to per100 basis, cache into `foods`, return it
       fail/timeout/unknown → return null  → caller shows pre-filled manual entry
```

Keep the cache-first ordering and the graceful fallback. No other module should import `fetch`. A product, once resolved, is cached permanently — so the network is hit at most once per distinct product.

### Privacy

Only the barcode number is ever sent. Camera frames are processed in-browser and never uploaded. No personal or health data leaves the device.

---

## Nutrition & strength math (`src/utils.js`)

All stateless and pure. Representative functions:

| Function | Returns |
|---|---|
| `scaleNutrition(food, quantity, unit)` | `{ calories, protein, carbs, fat }` for the given amount |
| `sumDay(logs)` | totals for a set of logs (used to rebuild a `dailyTotals` row if ever needed) |
| `setVolume(set)` | working volume for one set (`reps × weight`) |
| `attributeVolume(exercise, volume)` | `{ [muscle]: contribution }` with primary/secondary weighting |
| `weekKey(date)` | ISO `YYYY-Www` key for muscle-volume bucketing |
| `estimateOneRepMax(weight, reps)` | e1RM for strength curves |
| `goalProgress(goal, data)` | `{ current, target, status }` where status ∈ on-track / behind / achieved |
| `toDisplayWeight(kg, units)` / `toDisplayMacro(...)` | unit-aware display conversion |
| `fmtMacro(n)` / `fmtCalories(n)` | formatting |

Canonical storage units are **kg** and **grams**; convert to imperial only at display time.

---

## Reactive data flow

All database reads in `App.jsx` use `useLiveQuery`. Any write to IndexedDB (from anywhere) automatically re-renders the relevant components — no manual state management.

```
User action → db helper (db.js) → Dexie writes IndexedDB
                                         ↓
                              useLiveQuery detects change
                                         ↓
                              App.jsx re-renders with new data
                                         ↓
                              Views receive updated props
```

Views receive data as props and call callbacks for mutations — they do not read the DB directly.

---

## Design system (`src/index.css`)

The **liquid glass** aesthetic, carried over from Finesse: dark deep-blue background, frosted glass panels, soft radial gradient mesh, with a light theme that inverts surfaces while keeping accents.

### CSS variables

```css
--glass-bg / --glass-bg-hover / --glass-bg-strong   /* panel fills */
--glass-border / --glass-border-strong
--blur                                              /* backdrop-filter blur */

--accent-mint   /* #4fffb0 — primary / positive */
--accent-blue   /* #5db8ff */
--accent-purple /* #c084fc */
--accent-warm   /* #fbbf70 */

--text-primary / --text-secondary / --text-muted

--good   /* #4fffb0 — on target / hit */
--warn   /* #fbbf70 — approaching / behind */
--danger /* #ff6b8a — over / missed */
```

### Utility classes

| Class | Purpose |
|---|---|
| `.glass` / `.glass-strong` | Frosted panels |
| `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-icon` | Buttons |
| `.glass-input` | Styled input / select |
| `.nav-item` (+ `.active`) | Sidebar nav link |
| `.progress-track` / `.progress-fill` | Progress bar (macro rings, goal bars) |
| `.status-good` / `.status-warn` / `.status-danger` | Status pill |
| `.modal-overlay` / `.modal-box` | Modal backdrop + container |
| `.font-display` | DM Serif Display heading font |
| `.fade-in` | Entrance animation (respects reduced-motion) |
| `.bg-mesh` | Fixed full-viewport gradient mesh background |

Inputs use `font-size: max(16px, 1em)` to prevent iOS zoom-on-focus.

---

## Responsive layout

Sidebar is fixed-width on desktop (≥768px) and slides off-canvas on mobile (<768px), toggled by a header menu button. Same approach as Finesse — controlled by an inline `<style>` block in `App.jsx` reading `sidebarOpen` state. Respect device safe-area insets via `env(safe-area-inset-*)`.

---

## Export / import format

A flat snapshot of all tables:

```json
{
  "version": 1,
  "exportedAt": "2026-06-05T...",
  "profile": [ { ...profileRow } ],
  "foods": [ ... ],
  "foodLogs": [ ... ],
  "dailyTotals": [ ... ],
  "exercises": [ ... ],
  "workouts": [ ... ],
  "muscleVolume": [ ... ],
  "bodyweightLogs": [ ... ],
  "goals": [ ... ]
}
```

On import, `id` fields are stripped before `bulkAdd` so Dexie assigns fresh IDs, preventing collisions. **Replace** mode clears all tables first. **Merge** mode appends (can create duplicates). Derived counters (`dailyTotals`, `muscleVolume`) can be imported as-is, or rebuilt from `foodLogs`/`workouts` after import using the pure helpers in `utils.js` — rebuilding is the safer choice in merge mode.

---

## Muscle list

The muscle map and the exercise seed share one canonical muscle vocabulary. Keep them in sync — an exercise referencing a muscle not in the map won't render. A compact starting set:

```
chest, upper_back, lats, traps, front_delts, side_delts, rear_delts,
biceps, triceps, forearms, abs, obliques, lower_back, glutes,
quads, hamstrings, calves
```

If you add a muscle, add it to both the map SVG regions and any seed exercises that should hit it.

---

## Deployment

`npm run build` produces a fully static `dist/`. Drop it anywhere:

- **Plesk** — upload `dist/` contents to a subdomain's document root
- **Netlify / Vercel** — connect the repo, build command `npm run build`, publish `dist`
- **GitHub Pages** — set `base: '/repo-name/'` in `vite.config.js` first

### PWA installation (iPhone)

1. Open the deployed URL in **Safari** (iOS only allows Add to Home Screen from Safari)
2. Tap Share → "Add to Home Screen"
3. Opens full-screen with no browser chrome

Camera permission is requested on first scan. Serve over **HTTPS** — `getUserMedia` and the service worker both require a secure context.

---

## Known limitations & future work

**Barcode resolution needs the network once per product.** First scan of an unknown item requires Open Food Facts; after caching it's offline forever. Unknown products fall back to manual entry.

**iOS scanning uses the @zxing fallback.** Safari lacks `BarcodeDetector`, so scanning is slightly heavier there. Acceptable, but worth revisiting if Safari ships the API.

**Volume weighting is a heuristic.** Primary/secondary weighting (default 0.5 for secondary) is a simplification of real biomechanics. Tunable in `utils.js`.

**Muscle map fidelity is coarse.** The starting muscle set is compact for a clean SVG. Finer anatomy can be added, but every new muscle must be wired into both the map and the exercise seed.

**Strength metric is e1RM-based.** Estimated one-rep-max smooths over rep-range and form differences; treat curves as trends, not precise maxes.
