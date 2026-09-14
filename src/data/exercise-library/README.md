# Exercise library

The app-facing catalogue lives behind `index.js`. The starter exercises remain
in `src/data/exercises.js` for backwards compatibility, while a downloaded
provider catalogue is generated into `imported/` as one file per app folder.

Import a Muscle & Strength export with:

```sh
npm run import:exercises -- ./downloads/muscle-and-strength.json
```

To create that export from the public exercise pages, first run the polite,
cached scraper:

```sh
python3 scripts/scrape_muscleandstrength.py \
  --output downloads/muscle-and-strength.json \
  --csv-output downloads/muscle-and-strength.csv
```

The scraper discovers category pages and pagination from the database, then
reads each guide's exercise profile. It keeps HTML in `.cache/muscle-and-strength`
so an interrupted run can be resumed, spaces requests by default, and stops on
403/429 responses rather than attempting to bypass site protection. Check the
site’s current terms and robots policy before a full run.

Audit an existing scrape before importing it:

```sh
npm run audit:exercises -- downloads/muscle-and-strength.json \
  --output downloads/muscle-and-strength.cleaned.json
npm run import:exercises -- downloads/muscle-and-strength.cleaned.json
```

CSV/TSV and saved HTML are also accepted. The importer recognizes common field
names (`name`, `muscleGroup`, `equipment`, `mechanics`, `experience`, `url`,
and primary/secondary muscle fields), normalizes them into the app schema, and
deduplicates by source URL or source/name.

Generated files are intentionally deterministic in shape and should not be
hand-edited. Re-run the importer when the source download changes.
