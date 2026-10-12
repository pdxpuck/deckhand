import { describe, expect, it } from 'vitest'
import {
  STANDARD,
  EngineError,
  buildDeck,
  createWorld,
  dealCards,
  flipTop,
  putCards,
  takeTop,
  topCard,
  type Card,
  type PileCard,
  type World,
} from './index'

const deck: Card[] = buildDeck(STANDARD)
const up = (card: Card): PileCard => ({ card, faceUp: true })
const down = (card: Card): PileCard => ({ card, faceUp: false })

/** 'a' holds deck[0..2] face-up, 'b' holds deck[3] face-down. */
function worldWithAces(): World {
  const base = createWorld(['a', 'b'])
  return dealCards(dealCards(base, 'a', deck.slice(0, 3), true), 'b', [deck[3]], false)
}

describe('piles', () => {
  it('createWorld starts all piles empty; topCard is null', () => {
    const world = createWorld(['stock', 'waste'])
    expect(Object.keys(world.piles).sort()).toEqual(['stock', 'waste'])
    expect(world.piles['stock'].cards).toEqual([])
    expect(topCard(world, 'waste')).toBeNull()
  })

  it('dealCards appends with the given face state; topCard sees the last card', () => {
    let world = createWorld(['p'])
    world = dealCards(world, 'p', deck.slice(0, 2), false)
    world = dealCards(world, 'p', [deck[2]], true)
    expect(world.piles['p'].cards.map((pc) => pc.faceUp)).toEqual([false, false, true])
    expect(topCard(world, 'p')?.card.id).toBe(deck[2].id)
  })

  it('takeTop removes the top N, returned bottom-to-top as stacked', () => {
    const world = worldWithAces()
    const { world: next, taken } = takeTop(world, 'a', 2)
    expect(taken.map((pc) => pc.card.id)).toEqual([deck[1].id, deck[2].id])
    expect(next.piles['a'].cards.map((pc) => pc.card.id)).toEqual([deck[0].id])
    expect(world.piles['a'].cards).toHaveLength(3) // input untouched
  })

  it('takeTop of the whole pile empties it', () => {
    const world = worldWithAces()
    const { world: next, taken } = takeTop(world, 'a', 3)
    expect(taken).toHaveLength(3)
    expect(next.piles['a'].cards).toEqual([])
  })

  it('putCards keeps face states by default and overrides when told', () => {
    const world = worldWithAces()
    const { world: stripped, taken } = takeTop(world, 'a', 2) // both face-up
    const kept = putCards(stripped, 'b', taken)
    expect(kept.piles['b'].cards.map((pc) => pc.faceUp)).toEqual([false, true, true])
    const overridden = putCards(stripped, 'b', taken, false)
    expect(overridden.piles['b'].cards.map((pc) => pc.faceUp)).toEqual([false, false, false])
    const forcedUp = putCards(stripped, 'b', [down(deck[4])], true)
    const cards = forcedUp.piles['b'].cards
    expect(cards[cards.length - 1].faceUp).toBe(true)
  })

  it('flipTop flips only the top card', () => {
    let world = createWorld(['p'])
    world = putCards(world, 'p', [up(deck[0]), down(deck[1]), down(deck[2])])
    world = flipTop(world, 'p')
    expect(world.piles['p'].cards.map((pc) => pc.faceUp)).toEqual([true, false, true])
    expect(world.piles['p'].cards.map((pc) => pc.card.id)).toEqual([
      deck[0].id,
      deck[1].id,
      deck[2].id,
    ])
  })

  it('throws EngineError on unknown pile, count<1, count>size, flip-empty', () => {
    const world = worldWithAces()
    expect(() => topCard(world, 'nope')).toThrow(EngineError)
    expect(() => dealCards(world, 'nope', [deck[0]], true)).toThrow(EngineError)
    expect(() => takeTop(world, 'nope', 1)).toThrow(EngineError)
    expect(() => putCards(world, 'nope', [up(deck[0])])).toThrow(EngineError)
    expect(() => takeTop(world, 'a', 0)).toThrow(EngineError)
    expect(() => takeTop(world, 'a', 4)).toThrow(EngineError)
    expect(() => flipTop(world, createWorld(['empty']).piles['empty'].id)).toThrow(EngineError)
  })
})
