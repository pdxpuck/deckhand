import { describe, expect, it } from 'vitest'
import {
  STANDARD,
  EngineError,
  applyAction,
  buildDeck,
  createWorld,
  dealCards,
  putCards,
  replay,
  type Action,
  type Card,
  type PileCard,
  type World,
} from './index'

const deck: Card[] = buildDeck(STANDARD)
const up = (card: Card): PileCard => ({ card, faceUp: true })
const down = (card: Card): PileCard => ({ card, faceUp: false })

/** stock: 10 face-down, tableau: 6 face-down, discard: empty. */
function threePileWorld(): World {
  const base = createWorld(['stock', 'tableau', 'discard'])
  const withStock = dealCards(base, 'stock', deck.slice(0, 10), false)
  return dealCards(withStock, 'tableau', deck.slice(10, 16), false)
}

describe('actions: move', () => {
  it('relocates the top N atomically, order preserved, states kept', () => {
    const initial = threePileWorld()
    const next = applyAction(initial, { type: 'move', from: 'stock', to: 'tableau', count: 3 })
    expect(next.piles['stock'].cards).toHaveLength(7)
    expect(next.piles['tableau'].cards).toHaveLength(9)
    expect(next.piles['tableau'].cards.slice(6).map((pc) => pc.card.id)).toEqual(
      initial.piles['stock'].cards.slice(7).map((pc) => pc.card.id),
    )
    expect(next.piles['tableau'].cards.slice(6).map((pc) => pc.faceUp)).toEqual([
      false,
      false,
      false,
    ])
    expect(initial.piles['stock'].cards).toHaveLength(10) // input untouched
  })

  it('applies the faceUp override when provided', () => {
    const initial = threePileWorld()
    const next = applyAction(initial, {
      type: 'move',
      from: 'stock',
      to: 'tableau',
      count: 1,
      faceUp: true,
    })
    const moved = next.piles['tableau'].cards[next.piles['tableau'].cards.length - 1]
    expect(moved.faceUp).toBe(true)
    expect(moved.card.id).toBe(initial.piles['stock'].cards[9].card.id)
  })
})

describe('actions: flip', () => {
  it('flips the top card only', () => {
    const initial = threePileWorld()
    const next = applyAction(initial, { type: 'flip', pile: 'tableau' })
    expect(next.piles['tableau'].cards[5].faceUp).toBe(true)
    expect(next.piles['tableau'].cards[0].faceUp).toBe(false)
  })
})

describe('actions: shufflePile', () => {
  it('same seed → same resulting pile order (whole world equal)', () => {
    const initial = threePileWorld()
    const a = applyAction(initial, { type: 'shufflePile', pile: 'stock', seed: 'replay-seed' })
    const b = applyAction(initial, { type: 'shufflePile', pile: 'stock', seed: 'replay-seed' })
    expect(a).toEqual(b)
  })

  it('different seed → different order; other piles untouched', () => {
    const initial = threePileWorld()
    const a = applyAction(initial, { type: 'shufflePile', pile: 'stock', seed: 'one' })
    const b = applyAction(initial, { type: 'shufflePile', pile: 'stock', seed: 'two' })
    expect(a.piles['stock'].cards.map((pc) => pc.card.id)).not.toEqual(
      b.piles['stock'].cards.map((pc) => pc.card.id),
    )
    expect(a.piles['tableau']).toEqual(initial.piles['tableau'])
  })

  it('preserves the card multiset; faceUp states travel with their cards', () => {
    let initial = createWorld(['p'])
    initial = putCards(initial, 'p', [
      up(deck[0]),
      down(deck[1]),
      up(deck[2]),
      down(deck[3]),
      up(deck[4]),
      down(deck[5]),
    ])
    const next = applyAction(initial, { type: 'shufflePile', pile: 'p', seed: 'mix' })
    expect(next.piles['p'].cards.map((pc) => pc.card.id).sort()).toEqual(
      [deck[0], deck[1], deck[2], deck[3], deck[4], deck[5]].map((c) => c.id).sort(),
    )
    // dealt pattern: odd ranks face-up, even ranks face-down
    for (const pc of next.piles['p'].cards) {
      expect(pc.faceUp).toBe((pc.card.rank ?? 0) % 2 === 1)
    }
  })
})

describe('actions: EngineError cases', () => {
  it('throws on move from empty, count>size, unknown piles, flip empty, shuffle unknown', () => {
    const initial = threePileWorld() // discard is empty
    expect(() =>
      applyAction(initial, { type: 'move', from: 'discard', to: 'stock', count: 1 }),
    ).toThrow(EngineError)
    expect(() =>
      applyAction(initial, { type: 'move', from: 'stock', to: 'tableau', count: 11 }),
    ).toThrow(EngineError)
    expect(() =>
      applyAction(initial, { type: 'move', from: 'nowhere', to: 'stock', count: 1 }),
    ).toThrow(EngineError)
    expect(() =>
      applyAction(initial, { type: 'move', from: 'stock', to: 'nowhere', count: 1 }),
    ).toThrow(EngineError)
    expect(() => applyAction(initial, { type: 'flip', pile: 'discard' })).toThrow(EngineError)
    expect(() =>
      applyAction(initial, { type: 'shufflePile', pile: 'nowhere', seed: 'x' }),
    ).toThrow(EngineError)
    expect(initial.piles['stock'].cards).toHaveLength(10) // throws left input intact
  })
})

describe('replay', () => {
  /** 17 scripted actions over the 3-pile world (10/6/0 deal). */
  const script: Action[] = [
    { type: 'move', from: 'stock', to: 'tableau', count: 1 },
    { type: 'move', from: 'stock', to: 'tableau', count: 1 },
    { type: 'move', from: 'stock', to: 'tableau', count: 1 },
    { type: 'flip', pile: 'tableau' },
    { type: 'move', from: 'tableau', to: 'discard', count: 3 },
    { type: 'flip', pile: 'stock' },
    { type: 'move', from: 'discard', to: 'tableau', count: 2, faceUp: true },
    { type: 'move', from: 'tableau', to: 'stock', count: 1 },
    { type: 'flip', pile: 'stock' },
    { type: 'shufflePile', pile: 'stock', seed: 'mid-stream' },
    { type: 'move', from: 'stock', to: 'tableau', count: 2 },
    { type: 'flip', pile: 'tableau' },
    { type: 'move', from: 'tableau', to: 'discard', count: 4 },
    { type: 'flip', pile: 'tableau' },
    { type: 'move', from: 'discard', to: 'tableau', count: 5, faceUp: false },
    { type: 'shufflePile', pile: 'tableau', seed: 'again' },
    { type: 'move', from: 'tableau', to: 'stock', count: 3 },
  ]

  it('runs the scripted 15+ action stream without throwing', () => {
    expect(script.length).toBeGreaterThanOrEqual(15)
    expect(() => replay(threePileWorld(), script)).not.toThrow()
  })

  it('replay deep-equals sequential application', () => {
    const initial = threePileWorld()
    let sequential = initial
    for (const action of script) sequential = applyAction(sequential, action)
    expect(replay(initial, script)).toEqual(sequential)
  })

  it('undo by slicing: dropping the last action reproduces the prior state', () => {
    const initial = threePileWorld()
    let beforeLast = initial
    for (const action of script.slice(0, -1)) beforeLast = applyAction(beforeLast, action)
    expect(replay(initial, script.slice(0, -1))).toEqual(beforeLast)
  })

  it('an empty action list returns the initial world', () => {
    const initial = threePileWorld()
    expect(replay(initial, [])).toEqual(initial)
  })
})
