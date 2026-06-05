# CLAUDE.md — Finesse Fit

This file gives AI assistants the context needed to work effectively on this codebase. Read it before making any changes.

---

## What this project is

A personal fitness PWA (Progressive Web App) for a single user. It tracks workouts, food intake, and nutrition against fitness goals. It runs almost entirely in the browser — no backend, no authentication, no account. Data lives in IndexedDB via Dexie.js. The app is deployed as a static site and installed on a phone via the browser's "Add to Home Screen".

It is the fitness sibling of the **Finesse** personal-finance app and shares its architecture exactly. If you know Finesse, you know how this is built.

**Do not add a backend, database server, or authentication system.** The local-first architecture is intentional.

**The one network exception:** resolving a scanned barcode into food data calls the Open Food Facts API — but only on a cache miss, and the result is then stored locally forever. Routine use (re-scans, search, all logging and viewing) is fully offline. Do not add any other runtime network calls.

---

## Tech stack

- **React 19** with Vite
- **Dexie 4** + **dexie-react-hooks** for IndexedDB
- **Tailwind CSS 4** (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed)
- **Recharts 3** for charts
- **lucide-react** for icons
- **date-fns 4** for date arithmetic
- **@zxing/browser** for barcode scanning fallback (BarcodeDetector is preferred when available)

---

## Project structure

```
src/
├── App.jsx               # Root: navigation, modal state, all useLiveQuery calls, orchestration
├── db.js                 # Dexie schema + every database helper function
├── utils.js              # Pure functions only — nutrition math, volume math, formatting, dates
├── foodApi.js            # Open Food Facts resolution + barcode scanning glue (the ONLY network module)
├── index.css             # All styling: CSS variables, glass classes, component styles
├── data/
│   └── exercises.js      # Seeded exercise library (name → primary/secondary muscles, equipment)
├── views/                # One file per page/tab
│   ├── Dashboard.jsx
│   ├── LogFood.jsx
│   ├── Foods.jsx
│   ├── Workouts.jsx
│   ├── Progress.jsx
│   ├── Goals.jsx
│   └── Settings.jsx
└── components/
    ├── Modals.jsx        # All modal dialogs
    ├── ui.jsx            # Modal, Field, IconButton, CardTitle
    ├── useDialog.jsx     # Promise-based confirm/alert/prompt hook
    ├── ItemSelect.jsx    # Searchable select (foods / exercises / meals) — generalised CategorySelect
    ├── DateInput.jsx     # Accessible date picker
    └── BarcodeScanner.jsx# Camera capture + decode, returns a barcode string
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

`foodApi.js` is the only file allowed to make a network request. It exposes barcode resolution (cache-aware) and nothing else touches the network. If you need data from a barcode, go through here.

### Schema changes

If you change the Dexie schema, increment the version number and add a new `db.version(N).stores({...})` call. Do not modify existing `version()` calls. See DEV_GUIDE.md for the migration pattern.

---

## Styling rules

The design system is **liquid glass** — dark deep-blue background, frosted panels, radial gradient mesh. All design tokens are CSS custom properties in `index.css`. This is carried over verbatim from Finesse.

- Use the semantic glass classes (`.glass`, `.btn-primary`, `.glass-input`, etc.) rather than Tailwind utilities for component styles
- Inline styles are acceptable and used throughout — this is intentional for a single-developer project
- Do not add new CSS files — put styles in `index.css`
- Do not change the colour palette or font stack without a good reason; the aesthetic is deliberate
- Fonts: **DM Serif Display** for headings (`.font-display`), **DM Sans** for body

Key CSS variables:
```css
--good: #4fffb0     /* green / mint — on-target, hit */
--warn: #fbbf70     /* amber — approaching / behind */
--danger: #ff6b8a   /* red — over / missed */
--accent-mint, --accent-blue, --accent-purple, --accent-warm
--text-primary, --text-secondary, --text-muted
```

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

Modals use `.modal-overlay` and `.modal-box` CSS classes and close on overlay click. Use the shared `Modal` component from `components/ui.jsx` — it handles focus trapping, Escape, and overlay dismissal.

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

---

## What not to do

- **Don't add a backend.** Data stays in IndexedDB.
- **Don't add network calls outside `foodApi.js`.** The only permitted runtime fetch is barcode resolution.
- **Don't add React Router.** Navigation is a single `view` state string in `App.jsx`.
- **Don't use localStorage** for primary data. Dexie/IndexedDB is the storage layer (a single tiny key like a selected-profile id is the only allowed exception, matching Finesse).
- **Don't add global state management** (Redux, Zustand, Context). `useLiveQuery` in `App.jsx` + prop drilling is sufficient and explicit.
- **Don't install a component library** (shadcn, MUI, etc.). The glass design system is hand-rolled and should stay that way.
- **Don't recompute derived counters** (`dailyTotals`, `muscleVolume`) by scanning all rows. Maintain them on write.
- **Don't rewrite historical logs** when a food or exercise template changes. Logged values are frozen.
- **Don't rename `db.js`, `utils.js`, or `foodApi.js`** — they're imported widely.
- **Don't put business logic in views.** Views render and emit events. Logic goes in `utils.js` (pure) or `db.js` (DB operations) or `App.jsx` (orchestration).

---

## Export / import format

```json
{
  "version": 1,
  "exportedAt": "<ISO string>",
  "profile": [...],
  "foods": [...],
  "foodLogs": [...],
  "dailyTotals": [...],
  "exercises": [...],
  "workouts": [...],
  "muscleVolume": [...],
  "bodyweightLogs": [...],
  "goals": [...]
}
```

`id` fields are stripped on import so Dexie assigns fresh IDs. If you add a new table to the export, update both `exportData()` and `importData()` in `db.js`, and bump `version` in the export payload (not the Dexie schema version). Custom seeded exercises export alongside user data; the built-in seed library does not need to be exported (it ships with the app).
