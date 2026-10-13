/**
 * Card themes (D4 — consume existing art packs, never invent art).
 *
 * A theme maps engine Cards to static image URLs under /cards/<themeId>/.
 * Two rendering mechanisms exist (see CardView):
 *
 * - 'file'     — every card is its own image file; CardView renders <img>.
 * - 'fragment' — the theme ships ONE sprite SVG containing a <g id="..."> per
 *                card; CardView renders <svg viewBox=...><use href="file.svg#id"/>.
 *                External same-origin fragment references work in modern
 *                Chrome/Firefox/Edge (the classic SVG-sprite technique);
 *                <img> cannot do fragments, hence the <use> wrapper.
 *                Fragment themes therefore also carry viewBoxFor(card | null),
 *                the viewBox crop that isolates one card inside the sprite.
 *
 * Every theme also carries `ratio` — the height/width of its art — so CardView
 * renders at the native aspect (the P2 gate showed stretching when a global
 * poker ratio was forced onto art with a different intrinsic shape).
 */
import type { Card, Suit } from '../engine/index.js'
import { RANK_LABELS, isJoker } from '../engine/index.js'
import { EngineError } from '../engine/index.js'
import { SVG_CARDS_GEOMETRY, SVG_CARDS_RATIO } from './svgcards-geometry'

/** How CardView renders this theme's art (see module docstring). */
export type ThemeKind = 'file' | 'fragment'

export interface CardTheme {
  readonly id: string
  readonly label: string
  readonly license: string
  readonly credit: string
  readonly kind: ThemeKind
  /** Height/width of the art itself; CardView sizes cards by this. */
  readonly ratio: number
  /** Whether the pack ships joker art (J1/J2 map to two variants). */
  readonly hasJokers: boolean
  /**
   * <img> rendering hint: 'pixelated' for pixel-art packs, 'auto' (smooth)
   * for vector packs. Fragment themes are vectors.
   */
  readonly imageRendering?: 'pixelated' | 'auto'
  /** Face art URL for a card (jokers included when hasJokers). */
  faceUrl(card: Card): string
  /** Card-back art URL (constant per theme). */
  backUrl(): string
  /**
   * Fragment themes only: viewBox isolating this card inside the sprite;
   * `null` selects the card back. Optional so file themes can omit it.
   */
  viewBoxFor?(card: Card | null): string
}

/* ------------------------------------------------------------------ */
/* svgcards — David Bellot's SVG-cards 2.0.1 (LGPL-2.1+), single-file  */
/* sprite. Card groups: "1_spade".."10_spade", "jack_spade", etc.;     */
/* jokers "red_joker"/"black_joker"; back group "back". Per-card       */
/* viewBox crops are MEASURED from the sprite by                       */
/* scripts/derive-svgcards-geometry.mjs (the original hand-derived     */
/* grid math cut the bottom edge off every card — the card body hangs  */
/* 6.87 units below its row anchor, which the pitch math missed).      */
/* ------------------------------------------------------------------ */

const SVG_CARDS_URL = '/cards/svgcards/svg-cards.svg'
const SVG_FACE_NAMES: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king' }
const SVG_SUIT_NAMES: Record<Suit, string> = {
  S: 'spade',
  H: 'heart',
  D: 'diamond',
  C: 'club',
}

function svgJokerIndex(card: Card): 'odd' | 'even' {
  // Joker ids look like J1, J2, J1#2 — parse the joker number, wrap > 2.
  const n = Number.parseInt(card.id.slice(1), 10)
  return Number.isNaN(n) || n % 2 === 1 ? 'odd' : 'even'
}

function svgGroupId(card: Card | null): string {
  if (card === null) return 'back'
  if (isJoker(card)) return svgJokerIndex(card) === 'odd' ? 'red_joker' : 'black_joker'
  const rankName = SVG_FACE_NAMES[card.rank!] ?? String(card.rank)
  return `${rankName}_${SVG_SUIT_NAMES[card.suit!]}`
}

const svgCardsTheme: CardTheme = {
  id: 'svgcards',
  label: 'SVG-cards (Bellot)',
  license: 'LGPL-2.1-or-later',
  credit: 'Playing cards by David Bellot (SVG-cards), LGPL-2.1+',
  kind: 'fragment',
  ratio: SVG_CARDS_RATIO,
  hasJokers: true,
  faceUrl(card: Card): string {
    return `${SVG_CARDS_URL}#${svgGroupId(card)}`
  },
  backUrl(): string {
    return `${SVG_CARDS_URL}#back`
  },
  viewBoxFor(card: Card | null): string {
    const group = svgGroupId(card)
    const box = SVG_CARDS_GEOMETRY[group]
    if (!box) throw new EngineError(`No svgcards geometry for card group "${group}"`)
    return `${box.x} ${box.y} ${box.w} ${box.h}`
  },
}

/* ------------------------------------------------------------------ */
/* byron — Byron Knoll's public-domain vector cards (per-card SVGs,    */
/* mirrored from the dead Google Code project by notpeter/Vector-      */
/* Playing-Cards). His set ships no card back, so the back is paired   */
/* with BdRGames' CC0 vector back (see public/cards/byron/LICENSE.md). */
/* Files: AS.svg, 2S.svg … 10C.svg (RANK_LABELS + suit letter).        */
/* ------------------------------------------------------------------ */

/**
 * Intrinsic aspect of Knoll's card SVGs, from the AS.svg root
 * viewBox "0 0 167.0869141 242.6669922" — identical across all 55 files
 * except back.svg (250x350 = 1.4), which letterboxes imperceptibly inside
 * the taller box (<img> preserves aspect; it never stretches).
 */
const BYRON_RATIO = 242.6669922 / 167.0869141

const byronTheme: CardTheme = {
  id: 'byron',
  label: 'Vector cards (Knoll)',
  license: 'Public domain (faces); back CC0 (BdRGames)',
  credit: 'Vector playing cards by Byron Knoll (public domain); back by BdRGames (CC0)',
  kind: 'file',
  ratio: BYRON_RATIO,
  hasJokers: true,
  faceUrl(card: Card): string {
    if (isJoker(card)) {
      return `/cards/byron/Joker${svgJokerIndex(card) === 'odd' ? 1 : 2}.svg`
    }
    return `/cards/byron/${RANK_LABELS[card.rank!]}${card.suit!}.svg`
  },
  backUrl(): string {
    return '/cards/byron/back.svg'
  },
}

/** Registered themes, in display order. (kenney pixel pack dropped at the P2
 * gate — user verdict; assets removed from public/cards/kenney.) */
export const THEMES: readonly CardTheme[] = [svgCardsTheme, byronTheme]

/** User-picked default theme (P2 gate verdict, 2026-10-12): byron wins. */
export const DEFAULT_THEME_ID = 'byron'

/** Look up a theme by id; throws EngineError for an unknown id. */
export function getTheme(id: string): CardTheme {
  const theme = THEMES.find((t) => t.id === id)
  if (!theme) throw new EngineError(`Unknown card theme: "${id}"`)
  return theme
}
