/**
 * Actions: the complete vocabulary of state change. Every mutation flows
 * through applyAction, so the action log alone determines game state —
 * replay is a fold, and undo is simply re-running that fold over a shorter
 * action list. UNDO IS NOT AN ENGINE FEATURE: the UI slices the action list
 * and calls replay (cheap at this scale).
 */

import { shuffle } from './deck'
import { EngineError } from './errors'
import type { Pile, PileCard, PileId, World } from './piles'
import { flipTop, putCards, takeTop } from './piles'
import type { Seed } from './rng'
import { createRng } from './rng'

export type Action =
  /** Move the top `count` cards from one pile to another, atomically. */
  | {
      readonly type: 'move'
      readonly from: PileId
      readonly to: PileId
      readonly count: number
      readonly faceUp?: boolean
      /**
       * When true, the taken cards stack onto the target in REVERSED order —
       * the physical "turn the pile over and move" operation; face states
       * travel with their cards.
       */
      readonly reverse?: boolean
    }
  /** Flip the top card of a pile. */
  | { readonly type: 'flip'; readonly pile: PileId }
  /**
   * Reshuffle a pile in place using a NEW rng seeded from this action's OWN
   * seed — the resulting order is deterministic from the recorded seed,
   * which is what makes replay bit-perfect. Face states travel with their
   * cards.
   */
  | { readonly type: 'shufflePile'; readonly pile: PileId; readonly seed: Seed }

/** Apply one action; pure. Throws EngineError on an illegal shape. */
export function applyAction(world: World, action: Action): World {
  switch (action.type) {
    case 'move': {
      const { world: stripped, taken } = takeTop(world, action.from, action.count)
      // `reverse` flips the taken run before it stacks: the target receives
      // it top-card-first, like lifting the pile off, turning it over, and
      // setting it down. Face states travel with their cards.
      const moved = action.reverse ? [...taken].reverse() : taken
      return putCards(stripped, action.to, moved, action.faceUp)
    }
    case 'flip': {
      return flipTop(world, action.pile)
    }
    case 'shufflePile': {
      const pile: Pile | undefined = world.piles[action.pile]
      if (!pile) throw new EngineError(`Unknown pile: "${action.pile}"`)
      const shuffled: readonly PileCard[] = shuffle(pile.cards, createRng(action.seed))
      return { piles: { ...world.piles, [action.pile]: { id: pile.id, cards: shuffled } } }
    }
  }
}

/** Fold a whole action list over the initial world. Undo = slice + replay. */
export function replay(initialWorld: World, actions: readonly Action[]): World {
  return actions.reduce(applyAction, initialWorld)
}
