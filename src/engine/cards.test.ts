import { describe, expect, it } from 'vitest'
import {
  RANKS,
  RANK_LABELS,
  STANDARD,
  SUITS,
  SUIT_RED,
  buildDeck,
  cardId,
  cardLabel,
  isJoker,
  jokerId,
  type Card,
} from './index'

describe('cards', () => {
  it('STANDARD deck has 52 unique ids', () => {
    const deck = buildDeck(STANDARD)
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((c) => c.id)).size).toBe(52)
  })

  it('STANDARD deck covers 4 suits x 13 ranks', () => {
    const deck = buildDeck(STANDARD)
    expect(deck.filter((c) => !isJoker(c))).toHaveLength(52)
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13)
    }
    for (const rank of RANKS) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4)
    }
  })

  it('cardId: plain for copy 1, #suffix for later copies', () => {
    expect(cardId('S', 1)).toBe('S1')
    expect(cardId('H', 13)).toBe('H13')
    expect(cardId('S', 1, 2)).toBe('S1#2')
    expect(jokerId(1)).toBe('J1')
    expect(jokerId(2, 3)).toBe('J2#3')
  })

  it('cardLabel: rank label + suit glyph', () => {
    const card = (suit: Card['suit'], rank: number): Card => ({
      id: cardId(suit!, rank),
      suit,
      rank,
      copy: 1,
    })
    expect(cardLabel(card('S', 1))).toBe('A♠')
    expect(cardLabel(card('H', 12))).toBe('Q♥')
    expect(cardLabel(card('D', 10))).toBe('10♦')
    expect(cardLabel(card('C', 13))).toBe('K♣')
  })

  it('jokers: label Joker, isJoker true; suit cards false', () => {
    const joker: Card = { id: jokerId(1), suit: null, rank: null, copy: 1 }
    expect(isJoker(joker)).toBe(true)
    expect(cardLabel(joker)).toBe('Joker')
    expect(isJoker({ id: cardId('C', 5), suit: 'C', rank: 5, copy: 1 })).toBe(false)
  })

  it('RANK_LABELS are indexed 1..13', () => {
    expect(RANK_LABELS[1]).toBe('A')
    expect(RANK_LABELS[10]).toBe('10')
    expect(RANK_LABELS[11]).toBe('J')
    expect(RANK_LABELS[12]).toBe('Q')
    expect(RANK_LABELS[13]).toBe('K')
  })

  it('SUIT_RED is display data only', () => {
    expect(SUIT_RED).toEqual({ S: false, H: true, D: true, C: false })
  })
})
