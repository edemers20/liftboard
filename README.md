# Lift Board

A phone-first training planner: weekly check-in, sport seasons, focus-driven splits, set logging with progression, and cardio/food math that adapts to the week.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # rules-engine tests
npm run build    # production build in dist/
```

## Structure

| Path | What it is |
| --- | --- |
| `src/engine.js` | The rules engine: exercise library, day templates, state and migrations, split builder, `plan()`, recovery load, progression and review, week actions. No DOM access; takes a storage adapter in `init()`. |
| `src/main.js` | Current UI: rendering, toasts, info overlays, event binding. Will be replaced by the UI overhaul. |
| `src/styles.css` | Current styles and theme tokens (light + dark). |
| `tests/engine.test.js` | Vitest suite covering migration, splits, recovery load, progression, week flow and toast diffs. |
| `public/` | Web manifest and icons for "Add to Home Screen". |

## Data

Data lives in the browser (`localStorage`) under `liftboard.v1`, `liftboard.week.v2` and `liftboard.hist.v1`. The engine reads and writes through a `{getItem, setItem}` adapter, so moving to a hosted database (e.g. Supabase via the Vercel Marketplace) means writing a new adapter, not touching the rules.

## Deploy

**GitHub Pages (default):** every push to `main` runs the tests, builds and publishes to `https://edemers20.github.io/liftboard/` via `.github/workflows/pages.yml`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

**Vercel (optional, later):** import the repo; it detects Vite. Use it when you want per-branch preview URLs or a backend.

## Next

1. UI overhaul from the Claude Design direction (components replace `src/main.js`).
2. Convert the engine to TypeScript and split it into modules (data, state, plan, progression).
3. Accounts and sync (Supabase) once testers need cross-device data.
