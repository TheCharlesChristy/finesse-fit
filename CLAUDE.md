# CLAUDE.md — Finesse Fit

This file gives AI assistants the context needed to work effectively on this codebase. Read it before making any changes.

---

## What this project is

A personal fitness PWA (Progressive Web App) for a single user. It tracks workouts, food intake, and nutrition against fitness goals. It runs almost entirely in the browser — no backend, no authentication, no account. Data lives in IndexedDB via Dexie.js. The app is deployed as a static site and installed on a phone via the browser's "Add to Home Screen".

It is the fitness sibling of the **Finesse** personal-finance app and shares its architecture exactly. If you know Finesse, you know how this is built.

**Do not add a backend, database server, or authentication system.** The local-first architecture is intentional.

**The network exceptions — both to Open Food Facts, both in `foodApi.js`:**

1. **Barcode resolution** — only on a local cache miss; the result is then stored locally forever.
2. **Name search** — only when the user explicitly taps "Search Open Food Facts" (or presses Enter in the search box); never while typing. Results are held in memory for the session; the product the user picks is saved to `foods` and is offline from then on.

Only the barcode or search words are sent. Routine use (re-scans, library search, all logging and viewing) is fully offline. Do not add any other runtime network calls.

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
- **Vitest 3** + **fake-indexeddb** for tests (`npm test`) — see Testing below

---

## Project structure

```
src/
├── main.jsx               # React entry point — imports pwa.js for its registerSW side effect
├── App.jsx                # Root: navigation, modal state, all useLiveQuery calls, orchestration
├── db.js                  # Dexie schema + every database helper function
├── utils.js               # Pure functions only — nutrition math, volume math, formatting, dates
├── foodApi.js             # Open Food Facts barcode resolution + name search (the ONLY network module)
├── ocr.js                 # Tesseract OCR engine lifecycle, self-hosted, lazy-loaded — see below
├── labelParser.js         # Pure: turns OCR'd label text into candidate per-100g macros
├── storage.js             # Persistent-storage permission + quota estimate (navigator.storage)
├── share.js               # Web Share API wrapper with a download-link fallback
├── pwa.js                 # Service-worker registration, update detection, updateApp()
├── photos.js              # Progress-photo compression (full + thumbnail JPEG bytes)
├── buildInfo.js           # APP_VERSION/APP_COMMIT/APP_BUILT_AT from vite.config.js define
├── index.css              # All styling: CSS variables, island card classes, component styles
├── data/
│   ├── exercises.js       # Seeded exercise library (name → primary/secondary muscles, equipment)
│   └── bodyFatReferences.js # Body-fat reference percentages + descriptions (men/women)
├── views/                 # One file per page/tab
│   ├── Dashboard.jsx
│   ├── LogFood.jsx
│   ├── Foods.jsx
│   ├── Workouts.jsx
│   ├── Progress.jsx       # Includes the Progress photos card
│   ├── Goals.jsx          # Includes the bodyweight-goal ETA line
│   └── Settings.jsx       # Includes Storage (persistence/quota) and About (version/update) cards
├── components/
│   ├── Modals.jsx         # All modal dialogs
│   ├── ui.jsx             # Modal, Field, IconButton, CardTitle
│   ├── useDialog.jsx      # Promise-based confirm/alert/prompt hook
│   ├── useScrollLock.js   # Ref-counted body scroll lock used by Modal (nested-modal safe)
│   ├── useBlobUrl.js      # object-URL lifecycle hook for raw bytes/Blob (photos, receipts-style)
│   ├── DateInput.jsx      # Accessible date picker
│   ├── ProgressPhotos.jsx # Photo strip + lightbox for the Progress view
│   ├── ScanLabelModal.jsx # Photo → OCR → parsed macros, hands off to FoodModal's `prefill`
│   ├── RestTimer.jsx      # Rest countdown bar shown in the workout editor
│   ├── WeekReview.jsx     # Weekly summary stat grid (Today + Progress)
│   ├── BodyFatReference.jsx # Text-only men/women body-fat reference rows for the Profile modal
│   ├── PriorityRanking.jsx  # Drag/keyboard ranked list of training priorities
│   ├── PaletteSelect.jsx  # Accessible palette dropdown with live swatches
│   ├── useRestTimer.js    # Timestamp-based rest timer hook (vibrate + beep on finish)
│   └── BarcodeScanner.jsx # Camera capture + decode, returns a barcode string
└── __tests__/              # Vitest suite — see Testing below
    ├── setup.js
    ├── utils.test.js
    └── db.test.js
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

### The network module

`foodApi.js` is the only file allowed to make a network request. It exposes barcode resolution (`resolveBarcode`, cache-aware), name search (`searchFoods`, explicit-only, session-cached, returns unsaved candidates) and `saveSearchResult` (dedupes by barcode). Nothing else touches the network.

Search uses the legacy `world.openfoodfacts.org/cgi/search.pl` endpoint because it's the one served with CORS headers (`search.openfoodfacts.org` isn't). It sheds load with fast 503s that lack CORS headers — the browser logs those as CORS errors — so `searchFoods` retries up to 3 times with backoff, then throws a `FoodSearchError('busy')` the UI shows with a Retry button. Open Food Facts limits search to ~10 requests/minute, which is why it must stay user-triggered.

### Nutrition-label scanning

`ScanLabelModal.jsx` → `ocr.js` → `labelParser.js` → `FoodModal`'s `prefill` prop. A photo goes in, `ocr.js` (Tesseract, self-hosted under `public/tesseract/`, lazy-loaded via `import('tesseract.js')`) turns it into raw text, and `labelParser.js` (pure, `src/labelParser.js`) turns that text into candidate per-100g macros with best-effort regex heuristics — it is never treated as ground truth. The result only ever seeds `FoodModal`'s draft; the user reviews and corrects every field before saving, exactly like the barcode-not-found manual-entry fallback. Don't wire a scanned result straight into `addFood`/`updateFood` — always go through the food form.

The parser's heuristics (worth knowing before touching either file):
- UK/EU labels give a "per 100g" column and a "per serving" column, in that order — when the text contains a "per 100g" heading anywhere, the *first* number on a matched nutrient's line is taken as the 100g value.
- US labels give only a "per serving" column, often with sodium in mg instead of salt in g. When no "per 100g" heading is found but a serving size is detected, the per-serving reading is scaled up to per-100g (`× 100 / servingGrams`). Sodium is converted to salt via `salt(g) = sodium(mg) ÷ 1000 × 2.5`.
- A nutrient with no confident match is **left out of the returned `per100`**, not zeroed — so the review form shows it blank, not a false 0.
- OCR noise is real and expected (a misread "g" unit is a common way a value gets silently skipped rather than misread) — this is exactly why the result always goes through human review, not a bug to chase into the parser.

`ScanLabelModal` uses a `live` ref to guard state updates after unmount during the async OCR call — it must be **set to `true` inside the effect body**, not only at `useRef(true)` declaration, because React StrictMode's dev-only mount→cleanup→remount cycle runs the cleanup once immediately, and a ref only initialised at declaration never gets set back to `true` afterwards; every guarded state update (including the final `onScanned` call) then silently no-ops forever. This is a real bug class, not a hypothetical — it shipped once in this file. If you add another cleanup-guarded async effect anywhere in this codebase, use the same pattern (`useEffect(() => { ref.current = true; return () => { ref.current = false; }; }, [])`).

### Binary tables

`photos` (progress photos, schema v4) holds raw `Uint8Array` image bytes. It's deliberately **excluded from `exportData()`/`importData()`** — a JSON backup shouldn't carry megabytes of base64 — but it must still be wiped by a full reset. `db.js` tracks this with a `BINARY_TABLES` list alongside the existing `TABLES` list; `clearAllData()` iterates both. If you add another table that stores raw bytes/Blobs, add it to `BINARY_TABLES`, not `TABLES`.

### Schema changes

If you change the Dexie schema, increment the version number and add a new `db.version(N).stores({...})` call. Do not modify existing `version()` calls. See DEV_GUIDE.md for the migration pattern.

---

## Testing

`npm test` runs the Vitest suite once (`npm run test:watch` for watch mode). Tests use `fake-indexeddb` so `db.js` runs against a real (in-memory) Dexie/IndexedDB implementation, not mocks — the same real-database philosophy as Finesse. `src/__tests__/setup.js` installs it; each test's `beforeEach` opens the db and clears every table without tearing down the schema.

The suite exists to guard the two rules that matter most in this codebase and are easy to silently break:

- **`db.test.js`** — derived-counter correctness (`dailyTotals`/`muscleVolume` stay in sync with adds/edits/deletes), frozen historical values (editing a food/exercise template doesn't rewrite past logs), undo/restore round-trips, export/import round-trips (including that `photos` is correctly excluded), and `clearAllData` wiping `BINARY_TABLES` too.
- **`utils.test.js`** — broad coverage of the pure functions in `utils.js` (nutrition scaling, e1RM, goal progress, week-keying, formatting, `goalEta`, etc).
- **`labelParser.test.js`** — the nutrition-label heuristics in `labelParser.js`: UK per-100g/per-serving layouts, US per-serving-with-sodium layouts, not confusing a nested "of which sugars"/"of which saturates" line with its parent nutrient, decimal commas, and a regression case for a real OCR misread (a "100g" heading number wrongly picked up as the serving size — see "Nutrition-label scanning" above).

When adding a derived-counter mutation or a new pure function with non-trivial logic, add a test alongside the existing ones rather than only verifying by hand in the browser.

---

## Styling rules

The design system is **floating islands**: flat, solid cards with soft shadows floating over a plain page background, with **user-selectable colour palettes** and dark/light modes. No blur, gradients, glows or sheen — keep it clean. All design tokens are CSS custom properties in `index.css`.

- Use the semantic classes (`.card`, `.card-raised`, `.btn-primary`, `.input`, `.chip`, `.list-row`, etc.) rather than Tailwind utilities for component styles
- A `.card` inside another `.card` or a modal renders as a flat inset section automatically — don't stack shadows
- Inline styles are acceptable and used throughout — this is intentional for a single-developer project
- Do not add new CSS files — put styles in `index.css`
- **Never hard-code a colour in a component or rule.** Use tokens (below) or `color-mix()` on them, so every palette and both modes keep working
- Fonts: **DM Serif Display** for page/modal titles (`.font-display`), **DM Sans** for everything else (self-hosted via `@fontsource`)

### Token layers (`index.css`)

1. **Structure** — `--radius-xs … --radius-xl`, `--gap`, `--tabbar-height`
2. **Palette** (`[data-palette="<id>"]` and `[data-palette="<id>"][data-theme="light"]`) — only: `--bg`, `--accent`, `--accent-2`, `--accent-3`, `--accent-4`, `--on-accent` (text on accent fills)
3. **Mode** (`:root`/`[data-theme="dark"]`, `[data-theme="light"]`) — `--surface` (islands), `--surface-2` (inset rows/sections), `--surface-hover`, `--surface-raised` (menus, modals, toasts), `--line`/`--line-strong`, `--text-*`, `--good`/`--warn`/`--danger`, `--shadow`/`--shadow-lg`, `--track`, `--scrim`. Dark-mode surfaces are mixed from the palette's `--bg`, so each palette's tint carries through.

Derived tokens (`--accent-soft`, `--accent-line`, `--accent-hover`, `--heat-0…3` for the muscle map) are computed on `:root`.

Accent roles: `--accent` primary actions/active/positive · `--accent-2` secondary data · `--accent-3` tertiary data · `--accent-4` highlight (PRs, reference lines). Status colours stay semantic and don't change per palette.

### Palettes

`App.jsx` sets `data-theme` and `data-palette` on `<html>` from the profile (`profile.themeMode`, `profile.palette`), and mirrors them to the single localStorage key `finesse-fit:appearance` so the boot script in `index.html` paints the right palette before React loads.

To add a palette: add both token blocks in `index.css` (dark and light — check `--on-accent` contrast on `--accent`), then add `{ id, name, description }` to `src/data/palettes.js`. The Settings dropdown (`components/PaletteSelect.jsx`) renders swatches by scoping `data-palette`/`data-theme` onto each swatch, so no colours are duplicated in JS.

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

Use the shared `Modal` component from `components/ui.jsx` — it handles focus trapping, Escape, and overlay dismissal. Pass `size="sm" | "md" (default) | "lg"` (or `large` as a shorthand for `lg`) to match the form's content: `sm` for a single short field (confirm/prompt dialogs, bodyweight), `lg` for a multi-row editor (workout sets, exercise muscle picker). A `<div className="card panel">` nested inside a modal automatically renders as a flat inset section, not another floating card.

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

### Adjust the barcode resolution behaviour

All of it is in `foodApi.js`. The pipeline is: local `foods` lookup → Open Food Facts → manual-entry fallback. Keep the cache-first ordering.

### Inspect the database in browser

Open DevTools → Application → IndexedDB → FinesseFit. All tables are visible and editable there. Useful for debugging.

### Run the tests

`npm test`. See Testing above.

---

## What not to do

- **Don't add a backend.** Data stays in IndexedDB.
- **Don't add network calls outside `foodApi.js`.** The only permitted runtime fetches are barcode resolution and user-triggered name search.
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
- **Don't declare a ref "live" with only `useRef(true)`.** If an async effect guards state updates with a ref like that, set it inside the effect body too (see "Nutrition-label scanning" above) — StrictMode's dev double-invoke will otherwise latch it `false` forever on the very first real mount.

---

## Export / import format

```json
{
  "version": 3,
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
  "templates": [...]
}
```

Version 2 added `meals` (saved meal templates); version 3 added `templates` (workout templates). Older backups still import — missing tables are skipped.

`id` fields are stripped on import so Dexie assigns fresh IDs. If you add a new table to the export, update both `exportData()` and `importData()` in `db.js`, and bump `version` in the export payload (not the Dexie schema version) — unless the new table belongs in `BINARY_TABLES` instead (see above), in which case it's excluded from export on purpose. Custom seeded exercises export alongside user data; the built-in seed library does not need to be exported (it ships with the app).

Progress photos (`photos`, Dexie schema v4) are **not** in this export format at all — they're binary and stay device-local. `Settings` surfaces this to the user; don't add them to `exportData()`.
