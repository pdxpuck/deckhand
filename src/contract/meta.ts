/**
 * Game metadata — presentation-facing labels describing a game module to
 * humans (collection home screens, menus). These labels are presentation
 * concerns, not contract: nothing in the engine or renderer reads them.
 */

/** Which solitaire lineage the game belongs to. */
export type SolitaireFamily =
  | 'klondike'
  | 'canfield'
  | 'spider'
  | 'golf'
  | 'pyramid'
  | 'freecell'
  | 'yukon'
  | 'other'

/** Coarse bucket for how often careful play wins. */
export type Winnability = 'very-low' | 'low' | 'moderate' | 'high' | 'very-high'

/** Lifecycle state: playable / in progress / not started. */
export type GameStatus = 'available' | 'development' | 'planned'

export interface GameMeta {
  readonly id: string
  readonly title: string
  readonly family: SolitaireFamily
  readonly winnability: Winnability
  readonly status: GameStatus
  readonly summary: string
}
