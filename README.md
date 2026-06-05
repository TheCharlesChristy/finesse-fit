# Finesse Fit — Workout & Nutrition Tracker

A PWA-ready fitness tracker with barcode-driven food logging, per-muscle progress tracking, workout logging, and goal management. Local-first — all data lives in your browser's IndexedDB. No backend, no account, no network required (except the first time you scan an unknown barcode).

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
- **Dashboard** — today's calories and macros against target, today's meals, this week's training, goal progress at a glance
- **Log Food** — scan a barcode to log food in seconds; resolves via local cache → Open Food Facts → manual entry. Recent foods and search for fast re-logging
- **Foods** — your local food library: scanned, searched, or hand-created; editable per-serving macros
- **Workouts** — log sessions down to the individual set (exercise, reps, weight, RPE), with rapid multi-row entry
- **Progress** — per-muscle volume over time, a colour-coded muscle map, lift strength curves, and bodyweight trend
- **Goals** — strength, bodyweight, weekly-volume, or nutrition-adherence goals, each with a live progress status
- **Settings** — units, daily targets, theme, export/import, full reset

## Barcode scanning
- Uses the native **BarcodeDetector** API where available (Android Chrome), falling back to **@zxing/browser** (iOS Safari)
- On a scan: looks up the barcode locally first → queries Open Food Facts on a miss → caches the result so re-scans never touch the network
- If a product is unknown or you're offline, manual entry is always available

## Per-muscle tracking
Each exercise in the library declares **primary** and **secondary** muscles. When you log a workout, working volume is attributed to those muscles (primary weighted more heavily than secondary) and rolled up into weekly per-muscle totals. That's what powers the muscle map and volume charts.

## Data sync
Export a `.json` backup from Settings and email/AirDrop it to your other device. Import and choose "Replace" to sync. Choose "Merge" to combine datasets (may create duplicates).

## Tech stack
React 19 · Vite · Dexie.js (IndexedDB) · dexie-react-hooks · Tailwind CSS 4 · Recharts · lucide-react · date-fns · @zxing/browser
