# Deckhand — Scoping Notes

Card-deck library + solitaire collection. Web-first TypeScript app; games are plug-in
modules over a shared headless engine and themed renderer.

- **Added:** 2026-10-12
- **Origin:** user revisit of card-deck work. Prior projects `cardframework/` and
  `blackjack_game/` (both Flutter, 2025–early 2026) were deleted from disk and are
  explicitly NOT resurrected — fresh start. Four orphaned Flutter files in a stray
  `lib\` folder at the dev repo root were deleted in the promotion commit.

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

## Lesson from the corpse

The deleted cardframework's `Rank` enum hardcoded blackjack values (`jack('J', 10)`,
`queen('Q', 10)`) — game-specific rules leaking into the generic layer. The Deckhand
engine must stay rules-agnostic: ranks/suits are generic data; card values, ordering,
and scoring live entirely inside game modules.

## Architecture

```
deckhand
├── engine        (pure logic, no UI, seeded RNG, action log)
│   ├── deck construction (standard 52, multi-deck, jokers, custom sets)
│   ├── shuffle (seeded → deterministic, testable, replayable)
│   ├── deal / draw / hands / piles / stock-waste recycle
│   └── action log → undo & replay nearly free
├── renderer      (the "manage the graphics" layer)
│   ├── card component (face + back), theme system, art-pack loading
│   ├── table/layout primitives, drag-drop foundation, animations
└── games         (thin modules implementing the game contract)
    ├── klondike
    └── canfield
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

## Phases

| Phase | Delivers | Gate |
|---|---|---|
| P0 | Scaffold: Vite + React + TS, vitest, folder structure | build + tests green |
| P1 | Engine: generic deck, seeded shuffle, deal/draw, piles, action log → undo/replay | full test suite |
| P2 | Renderer: card component, art pack, theme switcher, drag-drop foundation | user visual gate on themes |
| P3 | Klondike playable end-to-end | user plays it |
| P4 | Canfield + collection home screen (contract validation) | user plays it |
| P5 | Native wraps (Android/Windows) | deferred until web feels right |

## Open questions

- **O1** — Art pack pick + any per-pack handling quirks (SVG vs PNG, sizing) — resolve at P2 render gate.
- **O2** — Scoring/stats scope: v1 keeps the engine pure; score/stat tracking is a game-module concern, decide per game.
- **O3** — Game persistence: localStorage vs IndexedDB — decide at P3 (needs at least mid-game save for solitaire).
- **O4** — Wrap choice Capacitor vs Tauri (or both) — decide at P5.
- **O5** — Deal numbering / daily-deal (Klondike tradition) — candidate feature, not v1.
- **O6** — Standalone repo extraction (carwars pattern) — defer; monorepo dir `deckhand/` for now.

## Relations to other ideas/projects

- Absorbs three IDEAS.md entries as facets of this project: Card Theme System,
  Casino UI Component Library, Card Animation Framework.
- Sibling to the Board Game Port Framework idea (no board topology) — keep
  engine/renderer interfaces extraction-friendly in case the umbrella ever forms.
