import { describe, expect, it } from 'vitest'
import { ENGINE_PLACEHOLDER } from './index'

// Smoke test: proves the vitest pipeline only; P1 replaces it.
describe('engine placeholder', () => {
  it('ENGINE_PLACEHOLDER is true', () => {
    expect(ENGINE_PLACEHOLDER).toBe(true)
  })
})
