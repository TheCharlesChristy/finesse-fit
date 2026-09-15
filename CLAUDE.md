# CLAUDE.md — Finesse Fit

This file gives AI assistants the context needed to work effectively on this codebase. Read it before making any changes.

---

## What this project is

A personal fitness PWA (Progressive Web App) for a single user. It tracks workouts, food intake, and nutrition against fitness goals. It runs almost entirely in the browser — no backend, no authentication, no account. Data lives in IndexedDB via Dexie.js. The app is deployed as a static site and installed on a phone via the browser's "Add to Home Screen".

It is the fitness sibling of the **Finesse** personal-finance app and shares its architecture exactly. If you know Finesse, you know how this is built.

**Do not add a backend, database server, or authentication system.** The local-first architecture is intentional.

**The network exceptions — each in exactly one module:**

1. **Barcode resolution** (`foodApi.js`, Open Food Facts) — only on a local cache miss; the result is then stored locally forever.
2. **Name search** (`foodApi.js`, Open Food Facts) — only when the user explicitly taps "Search Open Food Facts" (or presses Enter in the search box); never while typing. Results are held in memory for the session; the product the user picks is saved to `foods` and is offline from then on.
3. **Map tiles** (`mapTiles.js`, loaded as images by `components/RouteMap.jsx` via Leaflet) — OpenStreetMap tile PNGs for whatever area a visible map shows. They reveal the tile coordinates being viewed (roughly, the area) and the IP address; never GPS fixes, tracks or routes. The service worker caches only tiles actually viewed — never bulk pre-fetch (OSM's usage policy forbids it), and keep the visible attribution.
4. **Route snapping** (`routingApi.js`, FOSSGIS OSRM at `routing.openstreetmap.de`) — only when the user taps the route-planner map with "Follow paths" on: one request per new leg, sequential, sending just that leg's two coordinates. Never on a timer or in a loop.

Only the barcode, search words, tile coordinates or two waypoints are sent. Routine use (re-scans, library search, logging, running a saved route, GPS tracking, viewing history) is fully offline — GPS tracking works with no signal; the map just has no background. Do not add any other runtime network calls.

**A third, different kind of exception:** the nutrition-label scanner (`ocr.js`) fetches its own OCR engine files (Tesseract's worker script, wasm core, English language data) same-origin from `public/tesseract/` on first use, then never again — the service worker caches them offline after that (see vite.config.js's `runtimeCaching`). This never sends anything anywhere; it's a static-asset fetch, not a call to any API, and no label photo or its pixels ever leave the device. See "Nutrition-label scanning" below.

---

## Tech stack

- **React 19** with Vite
- **Dexie 4** + **dexie-react-hooks** for IndexedDB
- **Tailwind CSS 4** (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed)
- **Recharts 3** for charts
- **lucide-react** for icons
- **date-fns 4** for date arithmetic
- **@zxing/browser** for barcode scanning fallback (BarcodeDetector is preferred when available)
- **tesseract.js** + **wasm-feature-detect** for nutrition-label OCR, self-hosted under `public/tesseract/`, loaded on demand — see "Nutrition-label scanning" below
- **leaflet** for maps (runs, route planning), loaded on demand via `components/leaflet.js` — see "Workout plans, live sessions, GPS and maps" below
- **Vitest 3** + **fake-indexeddb** for tests (`npm test`) — see Testing below

---

## Project structure

```
src/
├── main.jsx               # React entry point — imports pwa.js for its registerSW side effect
├── App.jsx                # Root: navigation, modal state, all useLiveQuery calls, orchestration
├── db.js                  # Dexie schema + every database helper function
├── utils.js               # Pure functions only — nutrition math, volume math, formatting, dates
├── foodApi.js             # Open Food Facts barcode resolution + name search (network module)
├── routingApi.js          # Route-planner path snapping, OSRM (network module, user-triggered only)
├── mapTiles.js            # The one place the OpenStreetMap tile source is configured
├── plans.js               # Pure: workout-plan model, block → step expansion, estimates, descriptions
├── session.js             # Pure: live-session reducer (timers, auto-advance, GPS recording, saving)
├── geo.js                 # Pure: GPS filtering, distance, pace, splits, elevation, GPX, units
├── cues.js                # Beeps, vibration and on-device-only speech for timers and runs
├── ocr.js                 # Tesseract OCR engine lifecycle, self-hosted, lazy-loaded — see below
├── labelParser.js         # Pure: turns OCR'd label text into candidate per-100g macros
├── storage.js             # Persistent-storage permission + quota estimate (navigator.storage)
├── share.js               # Web Share API wrapper with a download-link fallback
├── pwa.js                 # Service-worker registration, update detection, updateApp()
├── photos.js              # Progress-photo compression (full + thumbnail JPEG bytes)
├── buildInfo.js           # APP_VERSION/APP_COMMIT/APP_BUILT_AT from vite.config.js define
├── index.css              # All styling. Everything above the app-specific marker is
│                          #   SHARED verbatim with Finesse — see DESIGN_SYSTEM.md
├── theme/                 # SHARED — the appearance model and the OKLCH palette generator
│   ├── palettes.js        #   the curated catalogue (names only; colours live in index.css)
│   ├── custom.js          #   hue/harmony/intensity/tint → six OKLCH tokens
│   ├── appearance.js      #   the model, normalisation, and applying it to <html>
│   └── useAppearance.js   #   the hook App.jsx calls once
├── data/
│   ├── exercises.js       # Seeded exercise library (name → primary/secondary muscles, equipment)
│   └── bodyFatReferences.js # Body-fat reference percentages + descriptions (men/women)
├── views/                 # One file per page/tab
│   ├── Dashboard.jsx
│   ├── LogFood.jsx
│   ├── Foods.jsx
│   ├── Training.jsx       # Workouts / Progress / Goals tabs
│   ├── Workouts.jsx       # Plans + quick starts, sessions, routes, exercise library
│   ├── Progress.jsx       # Includes the Progress photos card
│   ├── Goals.jsx          # Includes the bodyweight-goal ETA line
│   └── Settings.jsx       # Includes Storage (persistence/quota) and About (version/update) cards
├── components/
│   ├── Modals.jsx         # All modal dialogs
│   ├── ui.jsx             # SHARED — Modal, Card, Field, Stat, Meter, Banner, Tabs, Portal…
│   ├── useDialog.jsx      # Promise-based confirm/alert/prompt hook
│   ├── useScrollLock.js   # Ref-counted body scroll lock used by Modal (nested-modal safe)
│   ├── useBlobUrl.js      # object-URL lifecycle hook for raw bytes/Blob (photos, receipts-style)
│   ├── DateInput.jsx      # Accessible date picker
│   ├── ProgressPhotos.jsx # Photo strip + lightbox for the Progress view
│   ├── ScanLabelModal.jsx # Photo → OCR → parsed macros, hands off to FoodModal's `prefill`
│   ├── RestTimer.jsx      # Rest countdown bar shown in the (past) workout editor
│   ├── WorkoutSession.jsx # The live session overlay: now card, tick-off list, map, finish sheet
│   ├── inputs.jsx         # Fit-only controls: NumberInput, DurationInput, Toggle (NOT shared — ui.jsx is)
│   ├── PlanModal.jsx      # Plan designer (exercise / circuit / cardio / intervals / rest blocks)
│   ├── RoutePlannerModal.jsx # Tap-to-plot route planner with optional path snapping
│   ├── ActivityModal.jsx  # A saved session's detail: map, splits, segments, GPX export
│   ├── RouteMap.jsx       # Thin Leaflet wrapper, styled by class (follows palette/theme)
│   ├── leaflet.js         # Leaflet + its CSS, only reached through dynamic import()
│   ├── useGeolocation.js  # watchPosition hook + one-off fix helpers
│   ├── useWakeLock.js     # Keeps the screen on during a session
│   ├── WeekReview.jsx     # Weekly summary stat grid (Today + Progress)
│   ├── BodyFatReference.jsx # Text-only men/women body-fat reference rows for the Profile modal
│   ├── PriorityRanking.jsx  # Drag/keyboard ranked list of training priorities
│   ├── AppShell.jsx       # SHARED — sidebar + mobile tab bar + "More" sheet
│   ├── AppearanceSettings.jsx # SHARED — the palette/finish/density panel
│   ├── useRestTimer.js    # Timestamp-based rest timer hook (vibrate + beep on finish)
│   └── BarcodeScanner.jsx # Camera capture + decode, returns a barcode string
└── __tests__/              # Vitest suite — see Testing below
    ├── setup.js
    ├── utils.test.js
    ├── db.test.js
    ├── labelParser.test.js
    ├── plans.test.js
    ├── session.test.js
    └── geo.test.js
```

---

## Architecture rules

### Data flow

All database reads happen in `App.jsx` via `useLiveQuery`. Data is passed down to views as props. Views call prop callbacks for mutations — they do not import from `db.js` directly. (Simple single-argument deletes may be passed straight through as callbacks, as in Finesse.)

```
App.jsx (useLiveQuery) → props → views → callbacks → db.js → IndexedDB
                                                          ↓
                                              useLiveQuery re-renders automatically
```

Do not add `useLiveQuery` calls inside views. Keep all DB reads in `App.jsx`.

### Database helpers

All DB operations live in `db.js`. When adding a new operation:

1. Write a named async function (not a method on `db`)
2. Export it
3. Import it in `App.jsx`

### Derived counters — the most important rule

Two aggregates are **stored counters maintained by the helpers**, not recomputed from source rows at query time:

- **`dailyTotals`** — calories/protein/carbs/fat per day. `addFoodLog` increments it, `deleteFoodLog` decrements it (floored at 0), edits apply the delta. The daily reset is implicit (a new day = a new row).
- **`muscleVolume`** — working volume per muscle per ISO week. `addWorkout`/`saveWorkout` increments the muscles each set hits; deleting/editing applies the delta.

This mirrors Finesse's `categories.spent` counter exactly. **Never recompute these by scanning all `foodLogs` or `workouts` on read.** Update them inside the same transaction that mutates the underlying record.

### Frozen historical values

When a food is logged, the computed calories/macros for that quantity are **stored on the log entry**. Editing or deleting the food in the library later must NOT rewrite past logs. The library food is a template; the log is a record. Same principle applies to a workout set's contribution once logged.

### Pure utils

`utils.js` contains only pure functions. No Dexie imports, no React hooks, no side effects. Nutrition scaling, volume attribution, one-rep-max estimation, week-keying, and formatting all live here as named exports.

### The network modules

`foodApi.js` and `routingApi.js` are the only files allowed to call `fetch`; `RouteMap.jsx` loads tiles from the URL in `mapTiles.js` (see the exceptions at the top).

`foodApi.js` It exposes barcode resolution (`resolveBarcode`, cache-aware), name search (`searchFoods`, explicit-only, session-cached, returns unsaved candidates) and `saveSearchResult` (dedupes by barcode). Nothing else touches the network.

Search uses the legacy `world.openfoodfacts.org/cgi/search.pl` endpoint because it's the one served with CORS headers (`search.openfoodfacts.org` isn't). It sheds load with fast 503s that lack CORS headers — the browser logs those as CORS errors — so `searchFoods` retries up to 3 times with backoff, then throws a `FoodSearchError('busy')` the UI shows with a Retry button. Open Food Facts limits search to ~10 requests/minute, which is why it must stay user-triggered.

### Nutrition-label scanning

`ScanLabelModal.jsx` → `ocr.js` → `labelParser.js` → `FoodModal`'s `prefill` prop. A photo goes in, `ocr.js` (Tesseract, self-hosted under `public/tesseract/`, lazy-loaded via `import('tesseract.js')`) turns it into raw text, and `labelParser.js` (pure, `src/labelParser.js`) turns that text into candidate per-100g macros with best-effort regex heuristics — it is never treated as ground truth. The result only ever seeds `FoodModal`'s draft; the user reviews and corrects every field before saving, exactly like the barcode-not-found manual-entry fallback. Don't wire a scanned result straight into `addFood`/`updateFood` — always go through the food form.

The parser's heuristics (worth knowing before touching either file):
- UK/EU labels give a "per 100g" column and a "per serving" column, in that order — when the text contains a "per 100g" heading anywhere, the *first* number on a matched nutrient's line is taken as the 100g value.
- US labels give only a "per serving" column, often with sodium in mg instead of salt in g. When no "per 100g" heading is found but a serving size is detected, the per-serving reading is scaled up to per-100g (`× 100 / servingGrams`). Sodium is converted to salt via `salt(g) = sodium(mg) ÷ 1000 × 2.5`.
- A nutrient with no confident match is **left out of the returned `per100`**, not zeroed — so the review form shows it blank, not a false 0.
- OCR noise is real and expected (a misread "g" unit is a common way a value gets silently skipped rather than misread) — this is exactly why the result always goes through human review, not a bug to chase into the parser.

`ScanLabelModal` uses a `live` ref to guard state updates after unmount during the async OCR call — it must be **set to `true` inside the effect body**, not only at `useRef(true)` declaration, because React StrictMode's dev-only mount→cleanup→remount cycle runs the cleanup once immediately, and a ref only initialised at declaration never gets set back to `true` afterwards; every guarded state update (including the final `onScanned` call) then silently no-ops forever. This is a real bug class, not a hypothetical — it shipped once in this file. If you add another cleanup-guarded async effect anywhere in this codebase, use the same pattern (`useEffect(() => { ref.current = true; return () => { ref.current = false; }; }, [])`).

### Workout plans, live sessions, GPS and maps

**Plans are templates; workouts are records** — the same split as library foods vs food logs. A plan (`plans.js`, stored in the `templates` table) is `{ name, blocks }` where each block is `exercise` (sets × reps or × time, rest between sets), `circuit` (rounds × moves), `cardio` (open/time/distance goal, GPS on/off, optional `routeId`), `intervals` (repeats × work + recovery) or `rest`. `normalizePlan()` also reads the legacy `{ name, sets }` template shape. Editing a plan never touches saved workouts.

**`expandBlocks()`** flattens blocks into ordered steps with **positional keys** (`b2.r1.i0`, `b0.s3`). A session only ever *appends* blocks (the "Add exercise or run" action), so a key never changes meaning once results are stored against it — don't add reordering or deletion of blocks inside a live session without rethinking keys.

**`session.js` is a pure reducer** over a plain serialisable state (`entries` per step key, one `timer`, a GPS `track`, a `cue`). Rules worth knowing:
- Time always arrives on the action (`now`) — never call `Date.now()` in `session.js`; that's what makes the timer logic testable.
- A work timer covers only the chunk since it was last started; pausing folds it into the entry (`elapsedMs`, `trackedMeters`).
- `tick` catches up in order (a phone that slept through several short HIIT intervals completes each at the moment it really ended). `resumeSession()` after a reload deliberately does **not** catch up — it pauses a running step at `savedAt` and drops an expired rest, so a reopened app never "replays" work the user didn't do.
- GPS fixes are only recorded while a GPS cardio step's work timer runs; each start begins a new track segment, so pauses never count as distance. Filtering (accuracy, jitter, impossible jumps) is `appendFix()` in `geo.js`.
- The reducer emits `cue` events; `WorkoutSession.jsx` turns them into beeps/vibration/speech. `cues.js` only uses `localService` speech voices — never a cloud voice.

**`WorkoutSession.jsx`** is mounted at `App.jsx` level (not a view) and renders both the full-screen layer and the minimised pill through `Portal` — inside `.app` they would share its stacking context and sit under the mobile tab bar. Its z-index (50) is above the tab bar and "More" sheet, below dialogs (60). It stays mounted so timers and GPS keep running while minimised to the pill and the user browses elsewhere. It owns the reducer state and persists it to `activeSession` every few seconds and on `visibilitychange`/`pagehide`; `App.jsx` resumes it on launch. It must **not** persist on unmount — a session unmounts only when it's saved, discarded or replaced, and a late write would resurrect it (this is why there's a `closing` ref). `useLiveQuery` in `App.jsx` reads only `hasActiveSession()` (a count) so the 3-second saves don't re-render the whole app.

**Finishing** goes through `sessionToWorkout()` → `saveSessionWorkout()`: completed exercise steps become normal `sets` (timed sets carry `seconds` with `reps: 0`, and `muscleVolume` is maintained as usual), cardio steps become `workout.cardio`, and the GPS track goes to the **`tracks` table keyed by `workoutId`** — never onto the workout row, because `getWorkouts()` is loaded app-wide. The row gets only a small `routePreview` (≤60 points) for list thumbnails. `deleteWorkout()` returns the track attached as `track` so Undo restores both. "Update plan" on finish uses `planWithActuals()` (heaviest completed set per exercise; cardio goals unchanged).

**Background GPS is a web-platform limit, not a bug to chase**: browsers pause geolocation for a backgrounded or screen-locked web app. `useWakeLock` keeps the screen on and the UI tells the user to keep the app open; a gap shows as a straight line.

**Maps**: `RouteMap.jsx` is imperative Leaflet; lines/markers get class names and are coloured in `index.css` with tokens (`stroke: var(--accent)`), and dark mode inverts the tile layer with a CSS filter. Don't pass colours to Leaflet.

### Binary tables

`photos` (progress photos, schema v4) holds raw `Uint8Array` image bytes. It's deliberately **excluded from `exportData()`/`importData()`** — a JSON backup shouldn't carry megabytes of base64 — but it must still be wiped by a full reset. `db.js` tracks this with a `BINARY_TABLES` list alongside the existing `TABLES` list; `clearAllData()` iterates both. If you add another table that stores raw bytes/Blobs, add it to `BINARY_TABLES`, not `TABLES`.

`activeSession` (schema v5) is in a third list, `DEVICE_TABLES`: transient working state that isn't backed up but is wiped by a full reset. `tracks` and `routes` are ordinary JSON and are in `TABLES`.

### Schema changes

If you change the Dexie schema, increment the version number and add a new `db.version(N).stores({...})` call. Do not modify existing `version()` calls. See DEV_GUIDE.md for the migration pattern.

---

## Testing

`npm test` runs the Vitest suite once (`npm run test:watch` for watch mode). Tests use `fake-indexeddb` so `db.js` runs against a real (in-memory) Dexie/IndexedDB implementation, not mocks — the same real-database philosophy as Finesse. `src/__tests__/setup.js` installs it; each test's `beforeEach` opens the db and clears every table without tearing down the schema.

The suite exists to guard the two rules that matter most in this codebase and are easy to silently break:

- **`db.test.js`** — derived-counter correctness (`dailyTotals`/`muscleVolume` stay in sync with adds/edits/deletes), frozen historical values (editing a food/exercise template doesn't rewrite past logs), undo/restore round-trips, export/import round-trips (including that `photos` is correctly excluded), and `clearAllData` wiping `BINARY_TABLES` too.
- **`utils.test.js`** — broad coverage of the pure functions in `utils.js` (nutrition scaling, e1RM, goal progress, week-keying, formatting, `goalEta`, etc).
- **`session.test.js`** — the live-session reducer: rest timers, out-of-order ticking, timed steps completing at exactly their target, pause/resume, circuits and intervals auto-advancing (including catch-up after sleep), GPS recording only while a GPS step runs, distance goals, saving, and reload recovery not replaying work.
- **`plans.test.js`** — plan normalisation (incl. legacy `{ sets }` templates), block expansion and keys, duration estimates, `planWithActuals`.
- **`geo.test.js`** — GPS fix filtering (accuracy, jitter, jumps, re-anchoring), segments, pace, splits, elevation, formatting, GPX.
- **`labelParser.test.js`** — the nutrition-label heuristics in `labelParser.js`: UK per-100g/per-serving layouts, US per-serving-with-sodium layouts, not confusing a nested "of which sugars"/"of which saturates" line with its parent nutrient, decimal commas, and a regression case for a real OCR misread (a "100g" heading number wrongly picked up as the serving size — see "Nutrition-label scanning" above).

When adding a derived-counter mutation or a new pure function with non-trivial logic, add a test alongside the existing ones rather than only verifying by hand in the browser.

---

## Styling rules

**The design system is shared with Finesse, byte for byte. Read
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) before touching anything visual.**

These files are the *same file* in both repositories — change one and copy it to
the other in the same commit:

- `src/index.css`, everything above the `FINESSE FIT — app-specific` marker
- `src/theme/` — `palettes.js`, `custom.js`, `appearance.js`, `useAppearance.js`
- `src/components/ui.jsx`, `AppShell.jsx`, `AppearanceSettings.jsx`
- `DESIGN_SYSTEM.md` itself

The short version:

- **Never hard-code a colour, a radius or a spacing value in a component.** Use a
  token or a `color-mix()` of one. A literal opts that call site out of eleven
  palettes, two schemes, three finishes and the high-contrast setting at once,
  and nothing will tell you.
- Use the semantic classes (`.card`, `.panel`, `.btn-primary`, `.input`, `.chip`,
  `.list-row`, `.stat`, `.empty-state`…) rather than Tailwind utilities or an
  inline `display: flex`.
- A `.card` inside another `.card` or a dialog becomes a flat inset section
  automatically — don't stack shadows.
- Do not add new CSS files — `index.css` is the whole stylesheet.
- Fonts: **DM Serif Display** for page and dialog titles (`.font-display`),
  **DM Sans** for everything else, **JetBrains Mono** for numbers read in columns
  (`.metric`, `.hero-num`, `.font-mono`). All self-hosted via `@fontsource`.

### Appearance

Nine preferences, one object, stored on the profile row as `profile.appearance`
and mirrored to the single localStorage key `finesse-fit:appearance` so the boot
script in `index.html` paints before React loads:

`themeMode` · `palette` (+ `custom`) · `surface` · `density` · `corners` ·
`contrast` · `textScale` · `motion`

`App.jsx` calls `useAppearance(profile.appearance, APPEARANCE_KEY, loaded)`,
which writes the `data-*` attributes and returns the resolved theme. No view ever
reads a preference — a view that wanted to know the current palette in order to
pick a colour would be the first crack in a system whose point is that colour is
decided in one file.

Profiles saved before this existed carry a flat `themeMode`/`palette` pair;
`getProfile` reads them as the two fields they map onto and lets
`normaliseAppearance` default the other seven.

### The muscle map

Its heat ramp comes from `--heat-0…3`, derived from the palette, so it reads
correctly in every theme without a rule of its own. The alternative ramps in
`Progress.jsx` are built from tokens too — a fixed ramp looks right under exactly
one palette, and the map's whole job is comparing regions against each other.

---

## Adding a new view

1. Create `src/views/MyView.jsx` — accept data as props, emit mutations via callbacks
2. Add an entry to the `NAV` array in `App.jsx`
3. Add `useLiveQuery` calls in `App.jsx` if new data is needed
4. Add a `{view === 'myview' && <MyView ... />}` render branch in `App.jsx`

## Adding a new modal

1. Add the modal component to `src/components/Modals.jsx` as a named export
2. Add a new string value to the `modal` state in `App.jsx` (e.g. `'logSet'`)
3. Add `{modal === 'logSet' && <LogSetModal ... />}` at the bottom of `App.jsx`'s JSX
4. Open it with `setModal('logSet')` from a button or callback

Use the shared `Modal` from `components/ui.jsx` — focus trap, Escape, overlay
dismissal and a body scroll lock. Pass `size="sm" | "md" (default) | "lg"` to
match the form: `sm` for a single short field (confirm/prompt, bodyweight), `lg`
for a multi-row editor (workout sets, muscle picker).

**Actions go in `footer`, not at the end of the children.** The footer sits
outside the scrolling body, which is what keeps Save reachable on a twenty-set
workout — and therefore outside the `<form>`, so `footer` may be a function and
is handed the form's id for `type="submit" form={formId}`. `Actions` in
`Modals.jsx` is the shared footer every editing dialog uses.

A `<div className="card panel">` nested inside a dialog renders as a flat inset
section automatically, not another floating card.

---

## Common tasks

### Add a field to a food (e.g. fibre)

1. Accept it in the food form in `Modals.jsx`
2. Pass it through to `addFood`/`updateFood` in `db.js` — Dexie persists extra fields automatically
3. Include it in nutrition scaling in `utils.js` if it should be tracked per-log
4. Render it where foods/logs are shown

### Add an exercise to the seed library

Edit `src/data/exercises.js`. Each entry needs `name`, `primaryMuscles` (array), `secondaryMuscles` (array), and `equipment`. Muscle names must match the canonical muscle list used by the muscle map (see DEV_GUIDE.md).

### Change units (metric/imperial)

Unit conversion lives in `utils.js`. The stored values have a canonical unit (kg, grams); display conversion happens at render. Don't store both — convert on display.

### Add a new goal type

1. Add the type to the goal model and the goal form in `Modals.jsx`
2. Add a pure progress-calculation function in `utils.js` that takes the goal + relevant data and returns `{ current, target, status }`
3. Render its progress in `Goals.jsx` and on the Dashboard

### Add a block kind to workout plans

1. Normalise it in `normalizeBlock()` and expand it to steps in `expandBlocks()` (`plans.js`) — steps are `type: 'exercise' | 'cardio' | 'rest'`, so a new kind usually maps onto those
2. Describe it in `describeBlock()` and estimate it in `estimatePlanSeconds()`
3. Add its editor to `BlockEditor` in `PlanModal.jsx` and a label/icon to `BLOCK_LABELS`/`KIND_ICONS`
4. Add expansion + session tests (`plans.test.js`, `session.test.js`)

### Adjust the barcode resolution behaviour

All of it is in `foodApi.js`. The pipeline is: local `foods` lookup → Open Food Facts → manual-entry fallback. Keep the cache-first ordering.

### Inspect the database in browser

Open DevTools → Application → IndexedDB → FinesseFit. All tables are visible and editable there. Useful for debugging.

### Run the tests

`npm test`. See Testing above.

---

## What not to do

- **Don't add a backend.** Data stays in IndexedDB.
- **Don't add network calls outside `foodApi.js`/`routingApi.js` (and map tiles via `mapTiles.js`).** The permitted runtime traffic is barcode resolution, user-triggered food search, tiles for a visible map, and user-triggered route snapping.
- **Don't call the routing service or pre-fetch map tiles in the background.** Both public OSM services are for light, interactive use.
- **Don't store GPS points on workout rows.** Tracks go in `tracks` (keyed by `workoutId`); the row only gets a small `routePreview`.
- **Don't read `Date.now()` inside `session.js`**, and don't make `WorkoutSession` save on unmount (see "Workout plans, live sessions, GPS and maps").
- **Don't search Open Food Facts as the user types.** It's rate-limited; keep it behind an explicit action.
- **Don't add React Router.** Navigation is a single `view` state string in `App.jsx`.
- **Don't use localStorage** for primary data. Dexie/IndexedDB is the storage layer (a single tiny key like a selected-profile id is the only allowed exception, matching Finesse).
- **Don't add global state management** (Redux, Zustand, Context). `useLiveQuery` in `App.jsx` + prop drilling is sufficient and explicit.
- **Don't install a component library** (shadcn, MUI, etc.). The island design system is hand-rolled and should stay that way.
- **Don't recompute derived counters** (`dailyTotals`, `muscleVolume`) by scanning all rows. Maintain them on write.
- **Don't rewrite historical logs** when a food or exercise template changes. Logged values are frozen.
- **Don't put "are you sure?" dialogs in front of reversible deletes.** Delete immediately and offer Undo via `removeWithUndo` in `App.jsx`; delete helpers return the removed row and a `restore*` helper puts it back (re-applying derived counters where relevant). Keep confirmations for irreversible or wide-reaching actions (full reset, deleting a custom exercise in use, changing targets).
- **Don't rename `db.js`, `utils.js`, or `foodApi.js`** — they're imported widely.
- **Don't put business logic in views.** Views render and emit events. Logic goes in `utils.js` (pure) or `db.js` (DB operations) or `App.jsx` (orchestration).
- **Don't put progress-photo bytes (or any future Blob/`Uint8Array` table) in `exportData()`/`importData()`.** Add it to `BINARY_TABLES` in `db.js` instead so `clearAllData()` still wipes it.
- **Don't mock the database in tests.** `fake-indexeddb` gives a real Dexie implementation — use it, not a hand-rolled mock of `db.js`.
- **Don't fetch tesseract.js/OCR assets from a CDN.** They're self-hosted under `public/tesseract/` on purpose — a CDN default would send a label photo off-device, which breaks the whole point of the exception described above.
- **Don't save a scanned label's values straight to the database.** Always route through `FoodModal`'s `prefill` — OCR is best-effort and must always get a human check first.
- **Don't bring back goal sliders.** Daily targets come from Mifflin-St Jeor maintenance (height, weight, optional `sex`/`birthYear`, `trainingDays`), the outcome inputs `targetBodyweight` and optional `targetBodyFat`, and the ranked `priorities` list — `calculateNutritionTargets` derives fat-loss/muscle-gain *intensity* internally. `goalMix` (all four keys) is legacy: only `fatLoss`/`muscleGain` are read, and only for profiles saved before composition targets existed (see DEV_GUIDE.md's "Nutrition targets" section). Don't wire new UI to it.
- **Don't default a blank target body fat.** `targetBodyFat: null` means "not sure" and must stay null through `normalizeBodyCompositionTargets`, `saveProfile` and the AI context — it has no effect on targets.
- **Don't let the two repositories' shared files drift.** `src/theme/`,
  `src/components/ui.jsx`, `AppShell.jsx`, `AppearanceSettings.jsx`,
  `DESIGN_SYSTEM.md` and everything in `index.css` above the app-specific marker
  are the same file in Finesse. Change one, copy it across in the same commit.
- **Don't position a popover with `position: fixed` inside a card.** Under the
  Glass finish a card carries a `backdrop-filter`, which makes it the containing
  block for fixed positioning — the popover then anchors to the card, silently,
  and only under that one setting. Render it through `Portal` from `ui.jsx`.
- **Don't declare a ref "live" with only `useRef(true)`.** If an async effect guards state updates with a ref like that, set it inside the effect body too (see "Nutrition-label scanning" above) — StrictMode's dev double-invoke will otherwise latch it `false` forever on the very first real mount.

---

## Export / import format

```json
{
  "version": 4,
  "exportedAt": "<ISO string>",
  "profile": [...],
  "foods": [...],
  "foodLogs": [...],
  "dailyTotals": [...],
  "exercises": [...],
  "workouts": [...],
  "muscleVolume": [...],
  "bodyweightLogs": [...],
  "goals": [...],
  "meals": [...],
  "templates": [...],
  "routes": [...],
  "tracks": [...]
}
```

Version 2 added `meals` (saved meal templates); version 3 added `templates` (workout templates — now block-based plans); version 4 added `routes` (planned routes) and `tracks` (GPS tracks). Older backups still import — missing tables are skipped. On import, plan blocks' `exerciseId`/`routeId`, workouts' `planId`/`routeId` and tracks' `workoutId` are remapped to the fresh ids; a track whose workout isn't in the backup is dropped. `activeSession` is never exported.

`id` fields are stripped on import so Dexie assigns fresh IDs. If you add a new table to the export, update both `exportData()` and `importData()` in `db.js`, and bump `version` in the export payload (not the Dexie schema version) — unless the new table belongs in `BINARY_TABLES` instead (see above), in which case it's excluded from export on purpose. Custom seeded exercises export alongside user data; the built-in seed library does not need to be exported (it ships with the app).

Progress photos (`photos`, Dexie schema v4) are **not** in this export format at all — they're binary and stay device-local. `Settings` surfaces this to the user; don't add them to `exportData()`.
