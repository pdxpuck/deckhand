/**
 * CardView — pure presentational card renderer (face or back) for a theme.
 * File themes render an <img> over an opaque white backing; fragment themes
 * render <svg viewBox><use/></svg> (see theme.ts for the mechanism rationale).
 */
import type { Card } from '../engine'
import { cardLabel, isJoker } from '../engine'
import type { CardTheme } from './theme'

/** Fallback height/width ratio of a classic poker card. Themes carry their
 * own native `ratio`; use this only when no theme is available. */
export const POKER_RATIO = 1.4

export interface CardViewProps {
  card: Card
  faceUp: boolean
  theme: CardTheme
  /** Rendered width in px (height follows the theme's native ratio). Default 100. */
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
  const height = Math.round(width * theme.ratio)
  // A joker falls back to the back art only when its theme ships no joker art.
  const showFace = faceUp && !(isJoker(card) && !theme.hasJokers)
  const url = showFace ? theme.faceUrl(card) : theme.backUrl()
  const alt = showFace ? cardLabel(card) : 'card back'
  const cursor = onClick ? 'pointer' : undefined

  if (theme.kind === 'fragment') {
    // viewBoxFor(null) = the back crop. The viewBox aspect matches the
    // width/height box, so the art fills the element — no stretching, no crop.
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

  // Opaque backing layer: file-theme art ships transparent regions (notably
  // the byron back's hatch pattern), so cards beneath would show through in
  // stacks. The white card sits behind the art for backs AND faces (harmless
  // for faces, which are already opaque).
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        width,
        height,
        background: '#ffffff',
        borderRadius: Math.round(width * 0.06),
        overflow: 'hidden',
        cursor,
      }}
    >
      <img
        src={url}
        alt={alt}
        width={width}
        height={height}
        draggable={false}
        style={{ display: 'block', imageRendering: theme.imageRendering }}
      />
    </div>
  )
}
