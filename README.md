# Finesse Fit — Workout & Nutrition Tracker

A PWA-ready fitness tracker with barcode-driven food logging, nutrition-label OCR, per-muscle progress tracking, workout logging, and goal management. Local-first — all data lives in your browser's IndexedDB. No backend, no account, no network required (except the first time you scan an unknown barcode, tap "Search Open Food Facts", or scan a nutrition label — that last one only fetches its own on-device OCR engine, once, and never sends your photo anywhere).

## Getting started

### Run locally (dev)
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Build for production
```bash
npm run build
```
Deploy the `dist/` folder to any static host (Netlify, Vercel, your Plesk server).

### Install as PWA on iPhone
1. Open the deployed URL in Safari
2. Tap the Share button → "Add to Home Screen"
3. It will appear as a full-screen app icon

Camera access is required for barcode scanning — grant it when prompted.

## Features
- **Dashboard** — today's calories and macros against target, today's meals, this week's training, goal progress at a glance, and a one-tap "AI context" export that turns all of that into a paste-ready summary for an AI chat
- **Log Food** — scan a barcode to log food in seconds; resolves via local cache → Open Food Facts → manual entry. Recent foods and search for fast re-logging. Or photograph the pack's nutrition table and have the macros read for you to check and save
- **Foods** — your local food library: scanned, searched, or hand-created; editable per-serving macros
- **Workouts** — log sessions down to the individual set (exercise, reps, weight, RPE), with rapid multi-row entry
- **Progress** — per-muscle volume over time, a colour-coded muscle map, lift strength curves, bodyweight trend, and a private on-device progress-photo gallery
- **Goals** — strength, bodyweight, weekly-volume, or nutrition-adherence goals, each with a live progress status (bodyweight goals also show an estimated time-to-target)
- **Settings** — appearance (twelve palettes plus a custom one, dark/light, three
  surface finishes, density, corners, text size, contrast and motion), units,
  daily targets, persistent-storage/quota, backup export/import, app version and
  update check, full reset

The look is shared with the [Finesse](https://github.com/TheCharlesChristy/finesse-app)
finance app — same design system, same components, same appearance settings. See
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Barcode scanning
- Uses the native **BarcodeDetector** API where available (Android Chrome), falling back to **@zxing/browser** (iOS Safari)
- On a scan: looks up the barcode locally first → queries Open Food Facts on a miss → caches the result so re-scans never touch the network
- If a product is unknown or you're offline, manual entry is always available

## Nutrition-label scanning
Photograph the nutrition table on a pack and it's read on-device (no upload, ever) into a draft food — check the numbers against the pack and save. Best with a clear "per 100g" column; a US-style "per serving" label works too. Any value it can't read confidently is just left blank rather than guessed.

## Per-muscle tracking
Each exercise in the library declares **primary** and **secondary** muscles. When you log a workout, working volume is attributed to those muscles (primary weighted more heavily than secondary) and rolled up into weekly per-muscle totals. That's what powers the muscle map and volume charts.

## Data sync
Export a `.json` backup from Settings — it opens your device's native share sheet (AirDrop, Messages, Files, email) where supported, or downloads the file. Import and choose "Replace" to sync. Choose "Merge" to combine datasets (may create duplicates). Progress photos are stored on-device only and are not included in the backup file.

## Staying up to date
Installed as a home-screen app, Finesse Fit can sit on a cached build for a while. It checks for a new one hourly, and Settings → About has a "Check for update" button plus the running version/commit/build time.

## Tests
```bash
npm test
```
Runs the Vitest suite (pure-function logic + database/derived-counter invariants) against an in-memory IndexedDB.

## Tech stack
React 19 · Vite · Dexie.js (IndexedDB) · dexie-react-hooks · Tailwind CSS 4 · Recharts · lucide-react · date-fns · @zxing/browser · tesseract.js · Vitest
