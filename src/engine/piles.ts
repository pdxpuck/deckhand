/**
 * Piles and the World — the engine's state container. All operations are
 * pure: they return new state objects and never mutate their inputs.
 */

import type { Card } from './cards'
import { EngineError } from './errors'

export type PileId = string

/** A card sitting in a pile, with its current face orientation. */
export interface PileCard {
  readonly card: Card
  readonly faceUp: boolean
}

/** A named stack of cards. Index 0 is the bottom of the pile. */
export interface Pile {
  readonly id: PileId
  readonly cards: readonly PileCard[]
}

/** The full engine state: piles keyed by id. */
export interface World {
  readonly piles: Readonly<Record<PileId, Pile>>
}

function requirePile(world: World, pileId: PileId): Pile {
  const pile = world.piles[pileId]
  if (!pile) throw new EngineError(`Unknown pile: "${pileId}"`)
  return pile
}

function withPile(world: World, pile: Pile): World {
  return { piles: { ...world.piles, [pile.id]: pile } }
}

/** A world where every named pile exists and is empty. */
export function createWorld(pileIds: readonly PileId[]): World {
  const piles: Record<PileId, Pile> = {}
  for (const id of pileIds) piles[id] = { id, cards: [] }
  return { piles }
}

/**
 * Setup helper: append cards to a pile, all with the same face state.
 * Runs before the action log begins — this is NOT an Action.
 */
export function dealCards(
  world: World,
  pileId: PileId,
  cards: readonly Card[],
  faceUp: boolean,
): World {
  const pile = requirePile(world, pileId)
  const dealt = cards.map((card) => ({ card, faceUp }))
  return withPile(world, { id: pile.id, cards: [...pile.cards, ...dealt] })
}

/** The top card of a pile, or null when empty. */
export function topCard(world: World, pileId: PileId): PileCard | null {
  const pile = requirePile(world, pileId)
  return pile.cards.length > 0 ? pile.cards[pile.cards.length - 1] : null
}

/**
 * Remove the top `count` cards. `taken` preserves their pile order
 * (bottom-to-top as they were stacked). Pure.
 */
export function takeTop(
  world: World,
  pileId: PileId,
  count: number,
): { world: World; taken: PileCard[] } {
  const pile = requirePile(world, pileId)
  if (count < 1) throw new EngineError(`count must be >= 1, got ${count}`)
  if (count > pile.cards.length) {
    throw new EngineError(
      `Cannot take ${count} cards from pile "${pileId}" (holds ${pile.cards.length})`,
    )
  }
  return {
    world: withPile(world, {
      id: pile.id,
      cards: pile.cards.slice(0, pile.cards.length - count),
    }),
    taken: pile.cards.slice(pile.cards.length - count),
  }
}

/** Append cards; `faceUp` overrides each card's state when provided, else keeps as-is. */
export function putCards(
  world: World,
  pileId: PileId,
  cards: readonly PileCard[],
  faceUp?: boolean,
): World {
  const pile = requirePile(world, pileId)
  const next = cards.map((pc) => (faceUp === undefined ? pc : { card: pc.card, faceUp }))
  return withPile(world, { id: pile.id, cards: [...pile.cards, ...next] })
}

/** Flip the top card of a pile (top card only). */
export function flipTop(world: World, pileId: PileId): World {
  const pile = requirePile(world, pileId)
  if (pile.cards.length === 0) throw new EngineError(`Cannot flip empty pile "${pileId}"`)
  const top = pile.cards[pile.cards.length - 1]
  const cards = [...pile.cards]
  cards[cards.length - 1] = { card: top.card, faceUp: !top.faceUp }
  return withPile(world, { id: pile.id, cards })
}
