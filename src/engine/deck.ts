/**
 * Deck construction and seeded shuffling.
 */

import type { Card } from './cards'
import { RANKS, SUITS, cardId, jokerId } from './cards'
import type { Rng } from './rng'

/** How many standard 52-card decks, and how many jokers per deck copy. */
export interface DeckSpec {
  decks: number
  jokers: number
}

/** One standard 52-card deck, no jokers. */
export const STANDARD: DeckSpec = { decks: 1, jokers: 0 }

/**
 * Build the full card list for a spec: all 52 suit/rank cards per deck copy,
 * then jokers numbered 1..spec.jokers per copy (jokers get a copy index too,
 * so every physical card id is unique across the whole build).
 */
export function buildDeck(spec: DeckSpec): Card[] {
  const cards: Card[] = []
  for (let copy = 1; copy <= spec.decks; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: cardId(suit, rank, copy), suit, rank, copy })
      }
    }
    for (let n = 1; n <= spec.jokers; n++) {
      cards.push({ id: jokerId(n, copy), suit: null, rank: null, copy })
    }
  }
  return cards
}

/**
 * Fisher–Yates shuffle driven entirely by the injected Rng. Pure: returns a
 * new array, the input is untouched, and the order is deterministic given
 * the input order + rng state. Generic so the action layer can reuse it for
 * pile shuffles (face states travel with whatever items are passed).
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
