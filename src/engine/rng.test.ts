import { describe, expect, it } from 'vitest'
import { createRng, restoreRng, type Rng } from './index'

function drawSeq(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.next())
}

describe('rng', () => {
  it('same seed produces an identical 1000-draw sequence', () => {
    expect(drawSeq(createRng('deckhand'), 1000)).toEqual(drawSeq(createRng('deckhand'), 1000))
  })

  it('number seed 42 and string seed "42" are identical', () => {
    expect(drawSeq(createRng(42), 1000)).toEqual(drawSeq(createRng('42'), 1000))
  })

  it('different seeds produce different sequences', () => {
    const a = drawSeq(createRng('alpha'), 100)
    const b = drawSeq(createRng('beta'), 100)
    expect(a).not.toEqual(b)
  })

  it('next() stays within [0, 1)', () => {
    for (const v of drawSeq(createRng('bounds'), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int() respects bounds; maxExclusive=1 always yields 0', () => {
    const one = createRng('ones')
    for (let i = 0; i < 1000; i++) expect(one.int(1)).toBe(0)
    for (const max of [2, 3, 7, 52]) {
      const rng = createRng(`ints-${max}`)
      for (let i = 0; i < 1000; i++) {
        const v = rng.int(max)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(max)
        expect(Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('int() throws for maxExclusive < 1', () => {
    expect(() => createRng('guard').int(0)).toThrow(RangeError)
    expect(() => createRng('guard').int(-3)).toThrow(RangeError)
  })

  it('snapshot → restore reproduces the identical continuation', () => {
    const rng = createRng('replay')
    for (let i = 0; i < 17; i++) rng.next()
    const snap = rng.snapshot()
    const expected = drawSeq(rng, 50)
    expect(drawSeq(restoreRng(snap), 50)).toEqual(expected)
  })

  it('snapshot does not advance the source stream', () => {
    const rng = createRng('no-advance')
    const snap = rng.snapshot()
    const expected = drawSeq(rng, 25)
    expect(drawSeq(restoreRng(snap), 25)).toEqual(expected)
  })

  it('restoreRng(snapshot()) mid-stream matches the uninterrupted stream', () => {
    const rng = createRng('identity')
    drawSeq(rng, 5)
    const snap = rng.snapshot()
    const expected = drawSeq(rng, 20)
    expect(drawSeq(restoreRng(snap), 20)).toEqual(expected)
  })
})
