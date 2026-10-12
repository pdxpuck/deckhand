# Deckhand — Scoping Notes

Card-deck FRAMEWORK (engine + renderer + game-contract types) — no game rules live
here (D7). Web-first TypeScript library. Game collections are separate projects
consuming this framework.

- **Added:** 2026-10-12
- **Origin:** user revisit of card-deck work. Prior projects `cardframework/` and
  `blackjack_game/` (both Flutter, 2025–early 2026) were deleted from disk and are
  explicitly NOT resurrected — fresh start. Four orphaned Flutter files in a stray
  `lib\` folder at the dev repo root were deleted during the promotion session
  (never tracked in git, so no deletion appears in commit history).

## Vision

A library that does the card basics — deck construction, shuffle, deal, hands, piles —
plus a graphics layer managing card faces/backs and themes, with individual games
implemented as thin consumers. Ultimate shape: a collection of solitaire variants plus
other card games in logical collections, where adding a new game requires writing a
rules module, not surgery on the core.

## Decisions

- **D1 — Platform: web-first, wrap later.** TypeScript + React + Vite. Plays in any
  desktop browser now. Target platforms are Windows desktop + Android only. Native
  shells deferred to P5: Capacitor (Android) vs Tauri (Windows) — candidates, decided
  at that phase. Single codebase; no native tax until the web version feels right.
- **D2 — Game #1: Klondike** (basic implementation).
- **D3 — Game #2: Canfield.** Chosen deliberately as a contract stressor: reserve pile
  (13 cards consumed one at a time), dynamic foundation base rank (set by first card
  played to foundation), wrap-around foundations (A plays on K), unlimited stock/waste
  recycling. Exercises pile types and rule semantics Klondike does not.
- **D4 — Art: consume existing packs, never invent.** Theme = art pack + colors; both
  faces AND backs swappable. Candidate packs (verify license + user visual pick at the
  P2 render gate):
  - Kenney playing cards (CC0): https://kenney.nl/assets/playing-cards
  - Byron Knoll vector playing cards (public domain): https://byronknoll.blogspot.com/2011/03/vector-playing-cards.html
  - David Bellot SVG cards (classic open set): https://svg-cards.sourceforge.io/
  - OpenGameArt sweep: https://opengameart.org/
- **D5 — Name: Deckhand.** Nautical family fit (buoy21, shipbells, Shellback Studio);
  triple pun: deck (of cards) + hand (of cards) + the sailor who works the deck.
- **D6 — Cleanup approved.** Orphaned files deleted; dead tracker entries archived
  (same commit as this promotion).
- **D7 — Framework only, no games.** Deckhand contains ZERO game implementations:
  engine, renderer, and the game-contract types only. Games live in separate
  collection projects — each collection = one project containing its game modules
  + app shell (the first, a solitaire collection with Klondike + Canfield, will be
  promoted as its own project when game implementation starts). Deckhand keeps a
  dev-only renderer demo harness (card/theme display sandbox — test tooling, not a
  game). Both stay in the dev monorepo with a local dependency during contract
  proving; extraction later per O6.

## Lesson from the corpse

The deleted cardframework's `Rank` enum hardcoded blackjack values (`jack('J', 10)`,
`queen('Q', 10)`) — game-specific rules leaking into the generic layer. The Deckhand
engine must stay rules-agnostic: ranks/suits are generic data; card values, ordering,
and scoring live entirely inside game modules.

## Architecture

```
deckhand (framework — NO games)
├── engine          (pure logic, no UI, seeded RNG, action log)
│   ├── deck construction (standard 52, multi-deck, jokers, custom sets)
│   ├── shuffle (seeded → deterministic, testable, replayable)
│   ├── deal / draw / hands / piles / stock-waste recycle
│   └── action log → undo & replay nearly free
├── renderer        (the "manage the graphics" layer)
│   ├── card component (face + back), theme system, art-pack loading
│   ├── table/layout primitives, drag-drop foundation, animations
│   └── dev-only demo harness (visual-gate tooling, not a game)
└── game-contract   (types + runtime interfaces — implemented BY collections)

collection projects (separate projects — consume deckhand, NOT part of this scope)
└── first: solitaire collection — klondike + canfield modules + collection app shell
```

## Game module contract (sketch — the load-bearing design)

A solitaire game module = data + small interface, so game #3+ is "write one rules
file + one layout hint set":

1. **deck spec** — how many decks, jokers, shuffles
2. **pile topology** — zones with types: tableau / foundation / cell / stock / waste /
   reserve; counts, initial deal pattern
3. **move validator** — legality of moving card set X from pile A to pile B
4. **auto-move policy** — what flies to foundations automatically (game-specific)
5. **win/loss detector** — end-state rules
6. **layout hints** — renderer geometry/zones for the game's table

Klondike + Canfield exist partly to PROVE this contract (palisade→carwars pattern:
two consumers reveal the real interface).

The contract TYPES live in deckhand; the implementations live in collection projects
(D7). During P3/P4 the contract will churn — both projects share the monorepo with a
local dependency to keep that cheap.

## Phases

Deckhand scope = P0–P2 only. Game phases live in the collection projects (D7).

| Phase | Delivers | Gate | Home |
|---|---|---|---|
| P0 | Scaffold: Vite + React + TS, vitest, folder structure | build + tests green | deckhand |
| P1 | Engine: generic deck, seeded shuffle, deal/draw, piles, action log → undo/replay | full test suite | deckhand |
| P2 | Renderer: card component, art pack, theme switcher, drag-drop foundation + demo harness | user visual gate on themes | deckhand |
| P3 | Klondike playable end-to-end (first contract consumer) | user plays it | solitaire collection project |
| P4 | Canfield + collection home screen (contract validation) | user plays it | solitaire collection project |
| P5 | Native wraps (Android/Windows) | deferred until web feels right | collection projects (a library doesn't ship as an app) |

## Open questions

- **O1** — Art pack pick + any per-pack handling quirks (SVG vs PNG, sizing) — resolve at P2 render gate.
- **O2** — Scoring/stats scope: v1 keeps the engine pure; score/stat tracking is a game-module concern, decide per game.
- **O3** — Game persistence: localStorage vs IndexedDB — decide at P3 (needs at least mid-game save for solitaire).
- **O4** — Wrap choice Capacitor vs Tauri (or both) — decide at P5.
- **O5** — Deal numbering / daily-deal (Klondike tradition) — candidate feature, not v1; collection-project concern (D7).
- **O6** — Standalone repo extraction — ✅ RESOLVED 2026-10-12: extracted to https://github.com/pdxpuck/deckhand via git subtree split (4 commits carried, hashes rewritten). Collection projects will consume deckhand via a local path dependency during P3/P4 contract churn.

### P2 art-pack findings (2026-10-12)

- **svg-cards (David Bellot):** project alive — SVG-cards 2.0.1 downloaded from
  SourceForge (https://sourceforge.net/projects/svg-cards/); **LGPL-2.1-or-later**;
  ships as a single-file SVG (~931 KB, 97 groups) intended for fragment refs
  (`<use href="svg-cards.svg#1_spade">`). Integrated as the `fragment` kind: ids
  `<1-10|jack|queen|king>_<spade|heart|diamond|club>`, plus `red_joker`,
  `black_joker`, and a `back` group — all verified present; per-card viewBox crops
  derived from the sprite grid (row pitch 243.137, col pitch 167.575, card
  166.575 × 235.27, bottom row anchored y=972.55) and checked against the file.
- **Byron Knoll (vector cards):** **public domain**; Google Code original is dead —
  files retrieved unmodified from the mirror https://github.com/notpeter/Vector-Playing-Cards.
  Back art: **not found in his set** (it ships faces only) — paired with a CC0 back
  ("Playing cards back vector svg" by BdRGames, opengameart.org) both on disk and at
  render time.
- **Kenney (pixel cards):** the old `kenney.nl/assets/playing-cards` slug is 404 —
  downloaded "Playing Cards Pack" v1.0 from the live
  https://kenney.nl/assets/playing-cards-pack; **CC0 1.0** (pack ships its own
  License.txt). Kept the 52 face PNGs + `card_back.png` + two joker PNGs from the
  pack's `PNG/Cards (large)` folder; unused `card_empty.png` not kept.
- **Integrated themes (all three cover 52 + back + jokers; none dropped):**
  - `svgcards` — LGPL-2.1-or-later — fragments (1 sprite SVG) — 52 faces + 2 jokers + back in one file
  - `byron` — public domain (faces) + CC0 (back, BdRGames) — files — 55 SVGs (52 faces, Joker1/2, back)
  - `kenney` — CC0 1.0 — files — 55 PNGs (52 faces, joker black/red, back)
- Full per-pack provenance lives in `public/cards/<theme>/LICENSE.md`.

## Relations to other ideas/projects

- Absorbs three IDEAS.md entries as facets of this project: Card Theme System,
  Casino UI Component Library, Card Animation Framework.
- Sibling to the Board Game Port Framework idea (no board topology) — keep
  engine/renderer interfaces extraction-friendly in case the umbrella ever forms.
