/**
 * The game-module interface — the contract a game implements so a collection
 * shell can deal, enumerate moves, render the table, and detect a win without
 * knowing any rules (D7). The engine stays rules-agnostic; every rule decision
 * (legality, auto-play policy, win condition) lives in the game module.
 *
 * EXPECTED TO CHURN during Klondike (first real consumer) — kept minimal,
 * nothing speculative.
 */

import type { Action, DeckSpec, PileId, Seed, World } from '../engine/index.js'
import type { GameMeta } from './meta'

/** The zone a pile occupies in the game's table. */
export type PileRole = 'stock' | 'waste' | 'tableau' | 'foundation' | 'cell' | 'reserve'

/** One pile the game uses, with its role. */
export interface PileSpec {
  readonly id: PileId
  readonly role: PileRole
}

export interface LayoutHint {
  readonly pileId: PileId
  /** Grid placement for the table renderer (row 0 = top). */
  readonly row: number
  readonly col: number
  /** How overlapping cards fan within the pile. */
  readonly fan: 'down' | 'right' | 'none'
}

export interface GameDefinition {
  readonly meta: GameMeta
  readonly deckSpec: DeckSpec
  /** Pile topology: every pile the game uses, with its role. */
  readonly piles: readonly PileSpec[]
  /**
   * Deterministic initial layout: full world, action log EMPTY (setup is
   * pre-log; the seed drives the shuffle). Because setup is pre-log, a SAVE
   * is just {seed, actions} and undo is slice+replay.
   */
  deal(seed: Seed): World
  /**
   * EVERY legal player move in the current position, as engine actions (a
   * player move may compose 1-2 actions, e.g. move + exposed-card flip).
   * Enumeration drives click-click UX and hints.
   */
  legalMoves(world: World): readonly Action[]
  /** True when the game is won. */
  isWon(world: World): boolean
  /**
   * The safe auto-play batch: foundation moves that are provably never needed
   * later, applied after each player move. Empty when none. Games without
   * auto-play return []. This is the GAME's policy (Klondike implements the
   * classic safety rule) — the engine stays rules-agnostic.
   */
  safeAutoMoves(world: World): readonly Action[]
  /** Renderer placement for every pile. */
  readonly layout: readonly LayoutHint[]
}
