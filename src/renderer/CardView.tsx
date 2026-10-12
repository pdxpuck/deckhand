/**
 * CardView — pure presentational card renderer (face or back) for a theme.
 * File themes render an <img>; fragment themes render <svg viewBox><use/></svg>
 * (see theme.ts for the mechanism rationale).
 */
import type { Card } from '../engine'
import { cardLabel, isJoker } from '../engine'
import type { CardTheme } from './theme'

/** Height/width ratio of a poker card. */
export const POKER_RATIO = 1.4

export interface CardViewProps {
  card: Card
  faceUp: boolean
  theme: CardTheme
  /** Rendered width in px (height follows the poker ratio). Default 100. */
  width?: number
  className?: string
  onClick?: () => void
}

export function CardView({
  card,
  faceUp,
  theme,
  width = 100,
  className,
  onClick,
}: CardViewProps) {
  const height = Math.round(width * POKER_RATIO)
  // A joker falls back to the back art only when its theme ships no joker art.
  const showFace = faceUp && !(isJoker(card) && !theme.hasJokers)
  const url = showFace ? theme.faceUrl(card) : theme.backUrl()
  const alt = showFace ? cardLabel(card) : 'card back'
  const cursor = onClick ? 'pointer' : undefined

  if (theme.kind === 'fragment') {
    // viewBoxFor(null) = the back crop.
    const viewBox = theme.viewBoxFor?.(showFace ? card : null) ?? '0 0 100 140'
    return (
      <svg
        viewBox={viewBox}
        width={width}
        height={height}
        className={className}
        onClick={onClick}
        role="img"
        aria-label={alt}
        style={{ display: 'block', cursor }}
      >
        <use href={url} />
      </svg>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onClick={onClick}
      draggable={false}
      style={{
        display: 'block',
        cursor,
        imageRendering: theme.imageRendering,
      }}
    />
  )
}
