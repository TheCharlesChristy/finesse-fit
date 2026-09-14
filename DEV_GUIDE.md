# Finesse Fit — Developer Guide

A personal fitness PWA built with React + Vite + Dexie.js. It tracks workouts, food, and nutrition against goals. All data lives in the browser's IndexedDB — no backend, no accounts. The only runtime network calls go to Open Food Facts: resolving a scanned barcode and user-triggered name search (once per product, then cached). Nutrition-label scanning is a separate, self-hosted OCR pipeline (tesseract.js) that never sends anything anywhere — see "Nutrition-label OCR" below.

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
| OCR | tesseract.js | 7 | Nutrition-label text recognition, self-hosted, lazy-loaded |

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
├── main.jsx              # React entry point — imports pwa.js for its registerSW side effect
├── App.jsx               # Root: nav, modal state, all useLiveQuery calls, orchestration
├── db.js                 # Dexie schema + all database helpers
├── utils.js              # Pure functions: nutrition math, volume math, formatting, dates
├── foodApi.js            # Open Food Facts barcode resolution + name search (the ONLY network module)
├── ocr.js                # Tesseract OCR worker lifecycle, self-hosted, lazy-loaded (see below)
├── labelParser.js        # Pure: OCR'd label text → candidate per-100g macros
├── storage.js            # Persistent-storage permission state + quota estimate
├── share.js              # Web Share API wrapper (native share sheet, falls back to download)
├── pwa.js                # Service worker registration, update polling, updateApp()
├── photos.js             # Progress-photo downscale/compress to full + thumbnail JPEG bytes
├── buildInfo.js          # APP_VERSION / APP_COMMIT / APP_BUILT_AT (from vite.config.js define)
├── index.css             # Design system: CSS variables, island card classes, base styles
│
├── data/
│   ├── exercises.js      # Seeded exercise library with muscle mappings
│   └── palettes.js       # Colour palette metadata ({ id, name, description }) for the picker
│
├── views/
│   ├── Dashboard.jsx     # Today's macros, meals, training, goals
│   ├── LogFood.jsx       # Barcode scan + search + quantity entry (the hero screen)
│   ├── Foods.jsx         # Food library management
│   ├── Workouts.jsx      # Session + set logging
│   ├── Progress.jsx      # Per-muscle volume, muscle map, strength/bodyweight charts, photos
│   ├── Goals.jsx         # Goal tracking, incl. bodyweight-goal ETA
│   └── Settings.jsx      # Appearance, units, storage/quota, backup, About/update-check
│
├── __tests__/            # Vitest suite (see Testing)
│   ├── setup.js
│   ├── utils.test.js
│   ├── db.test.js
│   └── labelParser.test.js
│
└── components/
    ├── Modals.jsx        # AddFoodModal, LogFoodModal, AddExerciseModal, LogWorkoutModal,
    │                     # AddGoalModal, ImportModeModal, ...
    ├── ui.jsx            # Modal, Field, IconButton, CardTitle
    ├── useDialog.jsx     # Promise-based confirm/alert/prompt
    ├── useScrollLock.js  # Ref-counted body scroll lock (nested-modal safe)
    ├── useBlobUrl.js     # Object-URL lifecycle hook for raw bytes/Blob
    ├── DateInput.jsx     # Accessible date picker
    ├── ProgressPhotos.jsx# Photo strip + lightbox, used by Progress.jsx
    ├── ScanLabelModal.jsx# Photo → OCR → parsed macros, hands off to FoodModal's `prefill`
    ├── RestTimer.jsx     # Rest countdown bar in the workout editor
    ├── WeekReview.jsx    # Weekly summary stat grid
    ├── PaletteSelect.jsx # Accessible palette dropdown with live swatches
    ├── useRestTimer.js   # Timestamp-based rest timer hook
    └── BarcodeScanner.jsx# Camera capture + decode
```

---

## Data layer (`src/db.js`)

### Schema

The Dexie database is named `FinesseFit`, schema version 4 (v2 added `meals`, v3 added `templates`, v4 added `photos`).

| Table | Key | Indexed fields | Description |
|---|---|---|---|
| `profile` | `++id` | — | Singleton: units, bodyweight, composition targets, activity level, calorie + macro targets |
| `foods` | `++id` | `barcode`, `name` | Food library: scanned, searched, or custom |
| `foodLogs` | `++id` | `date`, `mealType` | Individual eating occasions with frozen computed macros |
| `dailyTotals` | `++id` | `&date` | Derived per-day calorie/macro aggregates (one row per date) |
| `exercises` | `++id` | `name` | Custom exercises (the built-in seed lives in `data/exercises.js`) |
| `workouts` | `++id` | `date` | Sessions containing an array of sets |
| `muscleVolume` | `++id` | `muscle`, `weekKey` | Derived per-muscle weekly volume aggregates |
| `bodyweightLogs` | `++id` | `date` | Bodyweight measurements |
| `goals` | `++id` | `type` | Tracked goals |
| `templates` | `++id` | `name` | Workout templates: `{ name, sets: [{ exerciseId, reps, weight, rpe }] }` (weights in kg) |
| `meals` | `++id` | `name` | Saved meal templates: `{ name, mealType, items: [{ foodId, foodName, brand, foodSnapshot, quantity, unit, computed }] }` |
| `photos` | `++id` | `date` | Progress photos: `{ date, full, thumb, width, height, createdAt }` — `full`/`thumb` are compressed JPEG `Uint8Array`s. A **binary table** — listed in `BINARY_TABLES`, not `TABLES`, so it's wiped by a full reset but excluded from the JSON export (see Export / import format). |

### Profile shape (singleton)

```js
{
  id: 1,                        // always 1
  units: 'metric',              // 'metric' | 'imperial'
  bodyweight: 78,               // canonical kg
  targetBodyweight: 78,         // canonical kg
  targetBodyFat: 20,            // percentage
  activityLevel: 'moderate',
  goalMix: {
    performance: 45,
    health: 50,
  },
  targets: {
    calories: 2600,
    protein: 180,               // grams
    carbs: 280,
    fat: 80,
  },
  themeMode: 'dark',            // 'dark' | 'light' | 'system'
}
```

### Nutrition targets: body composition + training priorities

`calculateNutritionTargets()` (`utils.js`) is what turns the Profile modal's inputs into daily calories/protein/carbs/fat. Two inputs feed it:

- **Body composition targets** — `targetBodyweight` (kg) and `targetBodyFat` (%), set directly in the Profile modal's "Body composition targets" card. These describe the *outcome*: `weightDelta = targetBodyweight - bodyweight` sets direction and pace (a deficit when the target is below current weight, a surplus when above, scaled by how far off — `weightIntensity`), and `targetBodyFat` vs `DEFAULT_TARGET_BODY_FAT` (20%) nudges the same calculation towards more/less aggressive recomposition (`bodyFatBias`). Together they produce internal `fatLoss`/`muscleGain` intensities (0–1) — these are derived, not user-set; there's no fat-loss or muscle-gain slider in the UI.
- **Training priorities** — `goalMix.performance` and `goalMix.health` (0–100 each, the only two sliders left in the Profile modal), affecting training-day calorie need and macro split independently of the composition goal.

`normalizeBodyCompositionTargets(profile)` clamps `targetBodyweight` (≥35kg) and `targetBodyFat` (3–60%), defaulting a missing `targetBodyweight` to the current `bodyweight` (i.e. "no change" unless the user sets one) and a missing `targetBodyFat` to `DEFAULT_TARGET_BODY_FAT`.

**Legacy fallback:** profiles saved before composition targets existed have neither field. `calculateNutritionTargets` checks `hasCompositionTargets = profile.targetBodyweight != null || profile.targetBodyFat != null` — false only for these old profiles — and falls back to reading `fatLoss`/`muscleGain` straight off `profile.goalMix` (still present in `DEFAULT_GOAL_MIX` for exactly this reason, even though nothing in the UI writes to those two keys anymore). `db.js`'s `getProfile()`/`saveProfile()` apply the same `hasCompositionTargets` check to decide whether to trust a profile's stored `targets` or recompute them, so an old profile's calorie target doesn't silently jump the moment `normalizeBodyCompositionTargets` fills in defaults for display.

If you touch this function, `src/__tests__/utils.test.js` has cases for both the composition-target path and the legacy `goalMix`-only fallback — keep both passing.

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
  target: 100,                  // canonical units: kg for strength/bodyweight, volume units, or days
  exerciseId: 'seed:barbell_bench_press', // strength only
  direction: 'down',            // bodyweight only: 'down' (lose) | 'up' (gain)
  muscle: 'chest',              // volume only
  metric: 'protein',            // nutrition only
}
```

How `goalProgress()` measures each type:

- **strength** — best estimated 1RM ever logged for the exercise vs `target` kg
- **bodyweight** — distance travelled from the first bodyweight log towards `target`, respecting `direction`
- **volume** — this ISO week's `muscleVolume` for the muscle vs `target`
- **nutrition** — days in the last 14 where the metric hit the profile's daily target (protein ≥ 90%, others within ±10%) vs `target` days

### Saved meals

A saved meal is a template, like a library food. `logMeal()` scales each item from the current library food if it still exists, otherwise from the item's snapshot. `copyFoodLogs()` ("copy yesterday") is different: it duplicates existing logs with their frozen `computed` values unchanged.

### Quick-add logs

`addQuickLog()` stores a food log with `foodId: null`, `quick: true`, no `foodSnapshot`, and the entered `computed` values. Editing one opens `QuickAddModal`; `updateFoodLog()` accepts explicit `computed` and never looks up a library food for it.

### Nutrients

`NUTRIENT_KEYS` in `utils.js` (calories, protein, carbs, fat, fibre, sugar, salt) drive `scaleNutrition`, `addTotals` and therefore `dailyTotals`. Only the four macros have targets; fibre/sugar/salt are informational. Older rows simply read as 0 for the new keys.

### Estimates and suggestions (all pure, in `utils.js`)

- `weightTrend()` — 7-day trailing average per weigh-in; bodyweight goals use the latest trend value.
- `weightRatePerWeek()` — least-squares slope over the last 28 days.
- `estimateTdee()` — average logged intake (days ≥ 800 kcal, excluding today) minus weight change × 7700 kcal/kg. Needs 14 logged days and 3 weigh-ins spanning a week.
- `suggestProgression()` — +2.5 kg upper / +5 kg lower body (5/10 lb) when every set of last session held its reps at RPE ≤ 8; +1 rep for unloaded bodyweight work; otherwise repeat.
- `neglectedMuscles()` — muscles with no attributed volume in 10+ days.
- `weeklyReview()` — per-ISO-week adherence, training, PR and weight-trend summary.
- `goalEta()` — for `type: 'bodyweight'` goals only: projects weeks-to-target from the current 7-day weight trend and `weightRatePerWeek()`. Returns `{ weeks, date, onTrack }`, or `null` if the trend is moving the wrong way, the goal is already achieved, or there's no trustworthy rate yet (needs the same 4-week window as `weightRatePerWeek`). `Goals.jsx` renders it as a line under bodyweight goal cards only.
- `buildAiContext()` — formats today's targets, nutrition, workout and goal status as one plain-text block, meant to be pasted at the start of an AI chat. Pure formatting only: it takes already-computed pieces (`totals`, `meals` from `groupLogsByMeal`, `todayWorkouts`, `goalData`) rather than reaching into raw tables itself, and it never phrases a question — just states what's true today. `Dashboard.jsx`'s "AI context" button opens `AiContextModal` (`components/Modals.jsx`) with the result, editable before the user copies or shares it via `copyText`/`shareText` (`share.js`).

### Profile extras

`restSeconds` (rest timer default), `lastExportAt` and `backupSnoozedUntil` (backup reminder), and `reviewDismissedWeek` (weekly review card) live on the profile singleton.

### Home-screen shortcuts

`vite.config.js` declares manifest `shortcuts` that open `/?action=scan|workout|food`; `App.jsx` handles the parameter once on launch and strips it from the URL.

### Bodyweight exercises

Sets for exercises with `equipment: 'bodyweight'` count latest bodyweight + any added weight as the load when computing volume, so pull-ups and dips show up on the muscle map. The stored `weight` on the set is still only the added weight.

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

### Name search (`foodApi.js`)

```
tap "Search Open Food Facts" → searchFoods(query):
  1. session cache hit for the query → return it (NO network)
  2. offline → FoodSearchError('offline')
  3. GET world.openfoodfacts.org/cgi/search.pl (9s timeout), up to 3 attempts with backoff
       success → keep products with a name + kcal/100g, normalise (source 'search'), dedupe, top 20
       all attempts fail → FoodSearchError('busy') → UI shows message + Retry
pick a result → saveSearchResult(food): reuse existing food with that barcode, else add to `foods`
```

Only user-triggered — Open Food Facts rate-limits search (~10/min). The newer `search.openfoodfacts.org` API lacks CORS headers, so browsers can't call it.

### Privacy

Only the barcode number or the search words are ever sent. Camera frames are processed in-browser and never uploaded. No personal or health data leaves the device.

---

## Nutrition-label OCR

Three pieces, mirroring the barcode subsystem's shape: capture, OCR, parsing — except nothing here is a network module.

```
Log Food → "Scan label" → ScanLabelModal
  pick a photo (plain <input type="file" accept="image/*"> — the native
    picker's own "Take Photo" option covers the camera case, no live
    preview needed since only one still frame is read)
  → ocr.js: recognizeLabel(file, onProgress) → raw text (Tesseract)
  → labelParser.js: parseNutritionLabel(text) → { per100, servingGrams, matched }
  → onScanned(result) → App.jsx opens FoodModal with prefill={result}
```

### `ocr.js` — self-hosted, lazy-loaded, and why

Same pattern as Finesse's statement OCR, trimmed down: no pdf.js, no page rendering, no `StageError`-per-page bookkeeping, because a label photo is always a single still image, never a multi-page PDF.

- **tesseract.js and wasm-feature-detect are loaded on demand** (`import('tesseract.js')` inside `createOcrWorker`), not from the main bundle — most sessions never open this flow, and tesseract.js's own JS plus several MB of wasm and language data would otherwise sit in every page load.
- **Nothing is fetched from a CDN.** The worker script, wasm core, and English `traineddata` are committed under `public/tesseract/` and served same-origin. `vite.config.js` excludes `public/tesseract/**` and the `vendor-ocr` chunk from the service worker's precache (multi-megabyte, rarely needed) but adds a `runtimeCaching` rule so the first real scan caches them for offline reuse after that.
- **Only the SIMD build of tesseract-core is shipped**, and `corePath` points at that exact file rather than a directory — tesseract.js's own feature-detection otherwise reaches for a "relaxed SIMD" build this app doesn't ship, which would 404. `simd()` from `wasm-feature-detect` checks support with a few throwaway bytes *before* the multi-megabyte core fetch starts, so a genuine incompatibility (`OcrUnsupportedError`) is never confused with a bad/truncated download (which gets its cache entry evicted and one automatic retry via `StageError`).
- The worker is a **module-level singleton** (`getOcrWorker`/`workerPromise`) — reused across scans in the same session, torn down explicitly via `terminateOcr()` if you ever need to free its memory (not currently called anywhere; add it if label scanning gets a way to be closed without navigating away).

### `labelParser.js` — pure, best-effort, never trusted directly

Turns Tesseract's raw text into `{ per100, servingGrams, matched }`. It is deliberately a heuristic, not a real table-layout reader — flattened OCR text has no columns, only line order — so its result only ever seeds `FoodModal`'s draft via the `prefill` prop; every value still gets a human check before `addFood` is called. See CLAUDE.md's "Nutrition-label scanning" for the heuristics themselves (100g-column-first convention, sodium→salt conversion, why a missing nutrient is left out rather than zeroed) and `src/__tests__/labelParser.test.js` for the layouts it's tested against.

### Privacy

Same guarantee as the rest of the app: the photo is decoded and OCR'd entirely on-device (Tesseract runs in a Web Worker against the local image), and it is never uploaded, stored outside the current scan, or sent anywhere. The only network activity this feature ever causes is fetching its own static engine files from the same origin, once.

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

The **floating islands** look: flat solid cards with soft shadows over a plain background, in dark or light mode, with six colour palettes (Settings → Appearance → Colour palette dropdown). No blur, gradients or glow.

### Palettes

| id | Name | Character |
|---|---|---|
| `mint` | Glacier Mint | Mint and blue (default) |
| `aurora` | Aurora | Violet and cyan |
| `ember` | Ember | Coral and amber |
| `evergreen` | Evergreen | Green and lime |
| `rose` | Rosé | Rose and peach |
| `graphite` | Graphite | Monochrome with a gold accent |

Each palette is two token blocks in `index.css` plus a `{ id, name, description }` entry in `src/data/palettes.js`; the choice is stored as `profile.palette`.

### CSS variables

```css
/* Structure */   --radius-xs … --radius-xl, --gap, --tabbar-height
/* Palette */     --bg, --accent, --accent-2, --accent-3, --accent-4, --on-accent
/* Mode */        --surface, --surface-2, --surface-hover, --surface-raised,
                  --line, --line-strong, --text-primary/-secondary/-muted,
                  --good, --warn, --danger, --shadow, --shadow-lg, --track, --scrim
/* Derived */     --accent-soft, --accent-line, --accent-hover, --heat-0 … --heat-3
```

Charts and the muscle map use these tokens (`fill="var(--accent-2)"`, `color-mix(...)` in inline `style`), so they follow the palette. `.progress-fill` reads `--bar` from any ancestor — the Today macro cards set a different accent each.

### Utility classes

| Class | Purpose |
|---|---|
| `.card` / `.card-raised` | Floating island surfaces (a card inside a card or modal renders flat) |
| `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-icon` | Buttons |
| `.input` | Styled input / select |
| `.nav-item` (+ `.active`) | Sidebar nav link |
| `.progress-track` / `.progress-fill` | Progress bar (macro rings, goal bars) |
| `.status-good` / `.status-warn` / `.status-danger` | Status pill |
| `.modal-overlay` / `.modal-box` | Modal backdrop + container |
| `.font-display` | DM Serif Display heading font |

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

`photos` is deliberately absent from this format — see the `BINARY_TABLES` note on the schema table above. Export now goes through `shareJson()` (`share.js`), which opens the native share sheet on supported browsers/devices and falls back to a plain download.

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

## Device integration modules

Small standalone modules, each wrapping one browser capability. None of them touch Dexie directly (except `photos.js` feeding rows into `db.js` callers) and none are the network module — `foodApi.js` is still the only file allowed to `fetch`.

### `storage.js` — persistent storage & quota

`navigator.storage` is unreliable across browsers, so this exposes a small state machine instead of a boolean:

- `getPersistenceState()` → `STORAGE_UNSUPPORTED | STORAGE_PERSISTED | STORAGE_BEST_EFFORT`
- `requestPersistence()` — must be called from a user gesture (a click handler), per the browser permission model; `App.jsx` also offers it automatically the first time a save happens while `STORAGE_BEST_EFFORT`
- `getStorageEstimate()` → `{ usage, quota, percent }` or `null` when unsupported
- `formatBytes()` — display helper

Surfaced in Settings → Storage card, with a "Protect my data" button and a quota bar.

### `share.js` — Web Share API

`shareFile({ blob, filename, title, text })` tries `navigator.share({ files: [file] })` (native share sheet — AirDrop, Messages, Files, etc. on iOS) when `navigator.canShare` says the browser can share that file type, otherwise falls back to a synthetic `<a download>` click. Returns `'shared' | 'downloaded' | 'cancelled'` — an `AbortError` from a dismissed share sheet is `'cancelled'`, not a failure, and callers must not show an error for it. `shareJson({ data, filename, title, text })` wraps it for the backup export.

For plain text (the AI context export), `shareText({ text, title })` tries `navigator.share({ text })` and falls back to `copyText()` — a download would be the wrong fallback for something the user is about to paste elsewhere. `copyText()` uses `navigator.clipboard.writeText`, with a hidden-textarea + `execCommand('copy')` fallback for contexts that lack the Clipboard API.

### `pwa.js` — service worker & update flow

Wraps `registerSW` from `virtual:pwa-register` (registered as a side effect by importing `pwa.js` from `main.jsx` — don't call `registerSW` anywhere else). Because Finesse Fit is typically opened as a home-screen PWA, it can sit on a stale cached build for a while; this module polls the service worker file hourly for changes and exposes:

- `isUpdatePending()` — a new worker is installed and waiting to activate
- `updateApp()` → `{ status: 'updated' | 'current' | 'unregistered' | 'unsupported' | 'error' }` — tells the waiting worker to activate and reloads the page

Surfaced in Settings → About, alongside `buildInfo.js`'s version/commit/build-time (from `vite.config.js`'s `define` block, computed via `git rev-parse --short HEAD` at build time — falls back to `'dev'` outside a git checkout).

### `photos.js` — progress-photo compression

`buildPhoto(file)` downscales an uploaded/captured image via `createImageBitmap` + canvas into two JPEG `Uint8Array`s — a full copy (long edge ≤1600px, quality 0.75) and a thumbnail (long edge ≤320px, quality 0.6) — rather than storing the original. Bytes, not `Blob`s, so they go straight into Dexie without an extra async step; `useBlobUrl.js` converts them back to a displayable `<img src>` on demand. Throws user-facing `Error` messages directly (bad file type, file too large, HEIC decode failure, browser unsupported) — callers show `error.message` as-is.

---

## Testing

```bash
npm test          # run the Vitest suite once
npm run test:watch
```

Config is `vitest.config.js` (kept separate from `vite.config.js` so the PWA/Tailwind plugins don't run for tests): `environment: 'node'`, `setupFiles: ['./src/__tests__/setup.js']` (imports `fake-indexeddb/auto`, giving Dexie a real in-memory IndexedDB rather than a mock), tests matched by `src/__tests__/**/*.test.{js,jsx}`.

Each test file's `beforeEach` opens the db if needed and clears every table (`db.tables.map(t => t.clear())`) — the schema stays intact between tests, only rows are reset.

- **`utils.test.js`** — pure-function coverage: nutrition scaling, volume attribution, e1RM, `goalProgress`/`goalEta`, week-keying (careful with ISO week edge cases — 2025 has 52 ISO weeks, not 53), formatting, `estimateTdee`, `backupReminder`, etc.
- **`db.test.js`** — the two most important invariants in the codebase: derived counters (`dailyTotals`/`muscleVolume`) staying correct across add/edit/delete, and frozen historical values not being rewritten when a food/exercise template changes later. Also covers undo/restore, export/import round-trips (asserting `photos` is excluded), exerciseId remapping and merge-mode on import, and `clearAllData` wiping `BINARY_TABLES` alongside `TABLES`.
- **`labelParser.test.js`** — the nutrition-label heuristics: UK (per-100g + per-serving columns) and US (per-serving + sodium) layouts, nested "of which" lines not overwriting their parent nutrient, decimal commas, and a couple of real-OCR-output regression cases.

When you touch a derived-counter mutation in `db.js` or add non-trivial logic to `utils.js`/`labelParser.js`, add a test rather than relying on manual browser verification alone.

---

## Deployment

`npm run build` produces a fully static `dist/`, including `public/tesseract/`'s ~8.5MB of OCR engine files — real weight, but not part of the service worker's precache (see "Nutrition-label OCR" above), so it only costs a download the first time someone actually scans a label. Drop `dist/` anywhere:

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

**Nutrition-label OCR reads by keyword, not by table column.** `labelParser.js` can't reconstruct a label's real columns from flattened OCR text, so it falls back to "first number on the matched line" — usually right, occasionally wrong when a unit gets misread (a "g" dropped from a number skips that value rather than mis-assigning it, which is the safer failure). This is why the scanned result always lands in the food form for review, never saved directly. Improving this would mean reading the image's own text-position geometry (like Finesse's PDF statement columns) rather than plain OCR text — a much bigger lift, not attempted here.
