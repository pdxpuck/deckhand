/**
 * StackView — minimal overlapping pile render (demo scaffolding for P2).
 * Formal table/layout primitives arrive with game layout hints in P3.
 */
import type { PileCard } from '../engine'
import { CardView, POKER_RATIO } from './CardView'
import type { CardTheme } from './theme'

export interface StackViewProps {
  pileCards: readonly PileCard[]
  theme: CardTheme
  /** Card width in px; height follows the poker ratio. */
  width: number
  /** Vertical offset per card in px. Default 0.25 * card height. */
  overlap?: number
}

export function StackView({ pileCards, theme, width, overlap }: StackViewProps) {
  const height = Math.round(width * POKER_RATIO)
  const step = overlap ?? Math.round(height * 0.25)
  const stackHeight =
    pileCards.length > 0 ? height + step * (pileCards.length - 1) : height
  return (
    <div style={{ position: 'relative', width, height: stackHeight }}>
      {pileCards.map((pileCard, i) => (
        <div
          key={pileCard.card.id}
          style={{ position: 'absolute', top: i * step, left: 0, zIndex: i }}
        >
          <CardView card={pileCard.card} faceUp={pileCard.faceUp} theme={theme} width={width} />
        </div>
      ))}
    </div>
  )
}
