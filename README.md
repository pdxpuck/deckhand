# Deckhand

Card-deck framework — engine + renderer + game-contract types; framework only,
no games (D7).

See [SCOPING_NOTES.md](./SCOPING_NOTES.md) for vision, decisions, and the phase
plan.

## Scripts

| Script            | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Vite dev server                         |
| `npm run build`   | Type-check (`tsc -b`) + production build |
| `npm run preview` | Preview the production build            |
| `npm test`        | Run the vitest suite once               |
| `npm run lint`    | ESLint over the project                 |

## Version convention

minor = phase + 1 (P0 → 0.1.x, P1 → 0.2.x, P2 → 0.3.x); patch = commit within
phase; game phases live in separate collection projects (D7).

## Library build

`npm run build:lib` builds a consumer-facing ESM library into `dist/`: 4
entries (`index`, `engine`, `renderer`, `contract`) plus `.d.ts` types.
Consumers import subpaths, e.g. `import { createRng } from 'deckhand/engine'`.
The card art assets under `/cards/` are NOT part of the package — consumers
ship their own `/cards/` directory. Note: the app build and lib build share
`dist/` and each empties it — run the one you need last.
Cross-module imports use explicit `/index.js` paths so emitted d.ts resolves under bundler/nodenext (v0.3.4).
The `contract` entry exports the game-contract types game modules implement (`GameMeta`, `GameDefinition`, …).
