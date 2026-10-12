import { describe, expect, it } from 'vitest'
import {
  STANDARD,
  buildDeck,
  createRng,
  isJoker,
  shuffle,
  type DeckSpec,
} from './index'

const sortedIds = (cards: readonly { id: string }[]): string[] =>
  cards.map((c) => c.id).sort()

describe('deck', () => {
  it('STANDARD builds 52 cards', () => {
    expect(buildDeck(STANDARD)).toHaveLength(52)
  })

  it('{decks:2, jokers:2} builds 108 unique cards, jokers present per copy', () => {
    const deck = buildDeck({ decks: 2, jokers: 2 })
    expect(deck).toHaveLength(108)
    const ids = deck.map((c) => c.id)
    expect(new Set(ids).size).toBe(108)
    expect(deck.filter(isJoker).map((c) => c.id)).toEqual(['J1', 'J2', 'J1#2', 'J2#2'])
  })

  it('shuffle preserves the exact multiset of cards (property over seeds/specs)', () => {
    const specs: DeckSpec[] = [STANDARD, { decks: 2, jokers: 2 }]
    for (const spec of specs) {
      const deck = buildDeck(spec)
      for (const seed of ['a', 'b', 7, 12345]) {
        const shuffled = shuffle(deck, createRng(seed))
        expect(sortedIds(shuffled)).toEqual(sortedIds(deck))
      }
    }
  })

  it('shuffle is deterministic for a seed and pure over its input', () => {
    const deck = buildDeck(STANDARD)
    const before = deck.map((c) => c.id)
    const a = shuffle(deck, createRng('same'))
    const b = shuffle(deck, createRng('same'))
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
    expect(deck.map((c) => c.id)).toEqual(before)
  })

  it('different seeds (almost surely) give different orders', () => {
    const deck = buildDeck(STANDARD)
    const a = shuffle(deck, createRng('seed-one'))
    const b = shuffle(deck, createRng('seed-two'))
    expect(a.map((c) => c.id)).not.toEqual(b.map((c) => c.id))
  })

  it('shuffling empty or single-card input is a no-op', () => {
    const rng = createRng('tiny')
    expect(shuffle([], rng)).toEqual([])
    expect(shuffle([buildDeck(STANDARD)[0]], rng)).toHaveLength(1)
  })
})
