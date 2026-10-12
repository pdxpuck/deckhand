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
