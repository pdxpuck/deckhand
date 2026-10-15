import { describe, expect, it } from 'vitest'
import { RANKS, STANDARD, SUITS, buildDeck, cardId, jokerId } from '../engine'
import { THEMES, getTheme, setThemeBase } from './theme'

const standardDeck = buildDeck(STANDARD)

const isViewBox = (s: string): boolean =>
  /^-?\d+(\.\d+)? -?\d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/.test(s)

describe('renderer themes', () => {
  it('registers exactly the two integrated themes with unique ids (kenney dropped at the P2 gate)', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['svgcards', 'byron'])
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
  })

  it('every theme carries a sane native art ratio (height/width)', () => {
    for (const theme of THEMES) {
      expect(Number.isFinite(theme.ratio)).toBe(true)
      expect(theme.ratio).toBeGreaterThanOrEqual(1.3)
      expect(theme.ratio).toBeLessThanOrEqual(1.6)
    }
  })

  it('every theme resolves a face URL for all 52 standard cards + a back + non-empty license/credit', () => {
    for (const theme of THEMES) {
      expect(theme.license.length).toBeGreaterThan(0)
      expect(theme.credit.length).toBeGreaterThan(0)
      expect(theme.backUrl().length).toBeGreaterThan(0)
      const faceUrls = standardDeck.map((card) => theme.faceUrl(card))
      for (const url of faceUrls) {
        expect(url.length).toBeGreaterThan(0)
      }
      // File themes give one distinct file per card; fragment themes share a sprite.
      if (theme.kind === 'file') {
        expect(new Set(faceUrls).size).toBe(52)
      }
    }
  })

  it('every theme maps every suit/rank id without gaps (total over the 52)', () => {
    for (const theme of THEMES) {
      const urls = SUITS.flatMap((suit) =>
        RANKS.map((rank) => theme.faceUrl({ id: cardId(suit, rank), suit, rank, copy: 1 })),
      )
      expect(urls.every((url) => url.length > 0)).toBe(true)
    }
  })

  it('fragment themes expose a valid viewBoxFor for every card and the back', () => {
    const fragmentThemes = THEMES.filter((t) => t.kind === 'fragment')
    expect(fragmentThemes.length).toBeGreaterThanOrEqual(1)
    for (const theme of fragmentThemes) {
      expect(theme.viewBoxFor).toBeDefined()
      for (const card of standardDeck) {
        expect(isViewBox(theme.viewBoxFor!(card))).toBe(true)
      }
      expect(isViewBox(theme.viewBoxFor!(null))).toBe(true)
    }
  })

  it('themes with joker art resolve face URLs for both joker variants', () => {
    for (const theme of THEMES) {
      if (!theme.hasJokers) continue
      for (const n of [1, 2]) {
        const joker = { id: jokerId(n), suit: null, rank: null, copy: 1 }
        expect(theme.faceUrl(joker).length).toBeGreaterThan(0)
      }
    }
  })

  it('getTheme returns registered themes and throws EngineError on unknown ids', () => {
    for (const theme of THEMES) {
      expect(getTheme(theme.id).id).toBe(theme.id)
    }
    expect(() => getTheme('does-not-exist')).toThrow('Unknown card theme')
  })

  // setThemeBase is module state, so these cases are order-coupled: the base
  // is restored to '' in the last one. Runs in definition order (sequential).
  const aceOfSpades = { id: cardId('S', 1), suit: 'S' as const, rank: 1, copy: 1 }

  it('art URLs stay root-absolute by default (setThemeBase never called)', () => {
    const byron = getTheme('byron')
    expect(byron.backUrl()).toBe('/cards/byron/back.svg')
    expect(byron.faceUrl(aceOfSpades)).toBe('/cards/byron/AS.svg')
    const svgcards = getTheme('svgcards')
    expect(svgcards.backUrl()).toBe('/cards/svgcards/svg-cards.svg#back')
    expect(svgcards.faceUrl(aceOfSpades)).toBe('/cards/svgcards/svg-cards.svg#1_spade')
  })

  it('setThemeBase prepends the base to every art URL (Pages sub-path hosting)', () => {
    setThemeBase('/shellback-solitaire/')
    const byron = getTheme('byron')
    expect(byron.backUrl()).toBe('/shellback-solitaire/cards/byron/back.svg')
    expect(byron.faceUrl(aceOfSpades)).toBe('/shellback-solitaire/cards/byron/AS.svg')
  })

  it("setThemeBase('') restores root-absolute URLs (order-coupled restore — runs last)", () => {
    setThemeBase('')
    const byron = getTheme('byron')
    expect(byron.backUrl()).toBe('/cards/byron/back.svg')
    expect(byron.faceUrl(aceOfSpades)).toBe('/cards/byron/AS.svg')
  })
})
