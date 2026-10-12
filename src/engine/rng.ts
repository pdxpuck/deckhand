/**
 * Deterministic, restorable pseudo-randomness for the engine.
 *
 * Algorithm: cyrb128 string hash → four 32-bit seed words → sfc32 generator
 * (Small Fast Counting, Chris Doty-Humphrey). sfc32 is fast, has a 128-bit
 * state, and holds up well under statistical test suites; both routines are
 * the well-known public-domain implementations popularized by bryc's gist.
 * Number seeds are stringified before hashing so that `42` and `'42'`
 * produce identical streams.
 *
 * All engine randomness is injected through the Rng interface — the engine
 * itself never draws from platform entropy, which is what makes seeds +
 * action logs fully replayable.
 */

/** Anything hashable to a stream: a number or a string. */
export type Seed = number | string

/** Opaque 128-bit generator state (four 32-bit words). */
export interface RngState {
  readonly s0: number
  readonly s1: number
  readonly s2: number
  readonly s3: number
}

/** Injected randomness source. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). Throws if maxExclusive < 1. */
  int(maxExclusive: number): number
  /** Capture the exact state without advancing the stream. */
  snapshot(): RngState
}

/** cyrb128: string → four well-mixed 32-bit words (public domain, by bryc). */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/** Build an Rng whose remaining stream is exactly the given state. */
export function restoreRng(state: RngState): Rng {
  let a = state.s0 >>> 0
  let b = state.s1 >>> 0
  let c = state.s2 >>> 0
  let d = state.s3 >>> 0

  const next = (): number => {
    const t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    const out = (t + d) | 0
    c = (c ^ out) | 0
    return (out >>> 0) / 4294967296
  }

  return {
    next,
    int(maxExclusive: number): number {
      if (maxExclusive < 1) {
        throw new RangeError(`maxExclusive must be >= 1, got ${maxExclusive}`)
      }
      return Math.floor(next() * maxExclusive)
    },
    snapshot: () => ({ s0: a, s1: b, s2: c, s3: d }),
  }
}

/** Create an Rng from a seed (string or number; hashed via cyrb128). */
export function createRng(seed: Seed): Rng {
  const [s0, s1, s2, s3] = cyrb128(String(seed))
  return restoreRng({ s0, s1, s2, s3 })
}
