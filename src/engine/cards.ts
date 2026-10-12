/**
 * Generic card data model. Ranks and suits are opaque data (D7): the engine
 * attaches no values, ordering, or scoring to them — that lives entirely in
 * game modules.
 */

/** The four standard suits, as opaque identifiers. */
export type Suit = 'S' | 'H' | 'D' | 'C'

/** Globally unique identifier for one physical card within a deck build. */
export type CardId = string

/**
 * One physical card. `suit`/`rank` are null ONLY for jokers.
 * `rank` is the generic index 1..13 (A=1 … K=13) — no game values.
 */
export interface Card {
  readonly id: CardId
  readonly suit: Suit | null
  readonly rank: number | null
  /** 1-based deck-copy index (1 for a single-deck build). */
  readonly copy: number
}

/** All four suits, in a stable order. */
export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']

/** Generic rank indices 1..13 (A=1 … K=13). */
export const RANKS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/** Display labels indexed by rank (index 0 is unused padding). */
export const RANK_LABELS: readonly string[] = [
  '', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]

/** Suit glyphs, display only. Kept module-private: labels are not API surface. */
const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }

/** Red/black as display data only — carries no game meaning. */
export const SUIT_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false }

/** Id for a suit/rank card: `S1` for copy 1, `S1#2` for a later deck copy. */
export function cardId(suit: Suit, rank: number, copy = 1): CardId {
  const base = `${suit}${rank}`
  return copy === 1 ? base : `${base}#${copy}`
}

/** Id for a joker: `J<n>` for copy 1, `J<n>#<copy>` for a later deck copy. */
export function jokerId(n: number, copy = 1): CardId {
  return copy === 1 ? `J${n}` : `J${n}#${copy}`
}

/** True for jokers (suit and rank are both null). */
export function isJoker(card: Card): boolean {
  return card.suit === null && card.rank === null
}

/** Human-readable label: `A♠`, `10♦`, or `Joker`. */
export function cardLabel(card: Card): string {
  if (isJoker(card)) return 'Joker'
  // Non-jokers always carry both suit and rank (see the Card invariant).
  return `${RANK_LABELS[card.rank!]}${SUIT_SYMBOLS[card.suit!]}`
}
