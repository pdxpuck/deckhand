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
 */
import type { Card, Suit } from '../engine'
import { RANK_LABELS, isJoker } from '../engine'
import { EngineError } from '../engine'

/** How CardView renders this theme's art (see module docstring). */
export type ThemeKind = 'file' | 'fragment'

export interface CardTheme {
  readonly id: string
  readonly label: string
  readonly license: string
  readonly credit: string
  readonly kind: ThemeKind
  /** Whether the pack ships joker art (J1/J2 map to two variants). */
  readonly hasJokers: boolean
  /**
   * <img> rendering hint: 'pixelated' for pixel-art packs (kenney),
   * 'auto' (smooth) for vector packs. Fragment themes are vectors.
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
/* jokers "red_joker"/"black_joker"; back group "back". The sprite     */
/* lays cards out on a grid (bottom-left anchored, cards drawn         */
/* upward), so each fragment needs its own viewBox crop:               */
/*   column x(rank) = (rank-1) * COL_PITCH                             */
/*   row y(suit) per the table below; card is CARD_W x CARD_H.         */
/* Geometry constants are derived from the unmodified svg-cards.svg    */
/* (base card path 166.575 x 235.27; row pitch 243.137; col pitch      */
/* 167.575; joker/back row anchored at y=972.55).                      */
/* ------------------------------------------------------------------ */

const SVG_CARDS_URL = '/cards/svgcards/svg-cards.svg'
const SVG_CARD_W = 166.575
const SVG_CARD_H = 235.27
const SVG_COL_PITCH = 167.575
const SVG_ROW: Record<Suit, number> = { C: 0, D: 243.137, H: 486.275, S: 729.412 }
const SVG_BOTTOM_ROW = 972.55
/** Padding ≤ the 1.0 unit of horizontal whitespace between sprite cells. */
const SVG_PAD = 0.9
const SVG_JOKER_COL = { odd: 167.575, even: 0 } // red_joker / black_joker
const SVG_BACK_X = 335.15
const SVG_FACE_NAMES: Record<number, string> = { 11: 'jack', 12: 'queen', 13: 'king' }
const SVG_SUIT_NAMES: Record<Suit, string> = {
  S: 'spade',
  H: 'heart',
  D: 'diamond',
  C: 'club',
}

function svgViewBox(cellX: number, cellY: number): string {
  const x = cellX - SVG_PAD
  const y = cellY - SVG_CARD_H - SVG_PAD
  const w = SVG_CARD_W + 2 * SVG_PAD
  const h = SVG_CARD_H + 2 * SVG_PAD
  return `${x} ${y} ${w} ${h}`
}

function svgJokerIndex(card: Card): 'odd' | 'even' {
  // Joker ids look like J1, J2, J1#2 — parse the joker number, wrap > 2.
  const n = Number.parseInt(card.id.slice(1), 10)
  return Number.isNaN(n) || n % 2 === 1 ? 'odd' : 'even'
}

const svgCardsTheme: CardTheme = {
  id: 'svgcards',
  label: 'SVG-cards (Bellot)',
  license: 'LGPL-2.1-or-later',
  credit: 'Playing cards by David Bellot (SVG-cards), LGPL-2.1+',
  kind: 'fragment',
  hasJokers: true,
  faceUrl(card: Card): string {
    if (isJoker(card)) {
      const id = svgJokerIndex(card) === 'odd' ? 'red_joker' : 'black_joker'
      return `${SVG_CARDS_URL}#${id}`
    }
    const rankName = SVG_FACE_NAMES[card.rank!] ?? String(card.rank)
    return `${SVG_CARDS_URL}#${rankName}_${SVG_SUIT_NAMES[card.suit!]}`
  },
  backUrl(): string {
    return `${SVG_CARDS_URL}#back`
  },
  viewBoxFor(card: Card | null): string {
    if (card === null) return svgViewBox(SVG_BACK_X, SVG_BOTTOM_ROW)
    if (isJoker(card)) return svgViewBox(SVG_JOKER_COL[svgJokerIndex(card)], SVG_BOTTOM_ROW)
    return svgViewBox((card.rank! - 1) * SVG_COL_PITCH, SVG_ROW[card.suit!])
  },
}

/* ------------------------------------------------------------------ */
/* byron — Byron Knoll's public-domain vector cards (per-card SVGs,    */
/* mirrored from the dead Google Code project by notpeter/Vector-      */
/* Playing-Cards). His set ships no card back, so the back is paired   */
/* with BdRGames' CC0 vector back (see public/cards/byron/LICENSE.md). */
/* Files: AS.svg, 2S.svg … 10C.svg (RANK_LABELS + suit letter).        */
/* ------------------------------------------------------------------ */

const byronTheme: CardTheme = {
  id: 'byron',
  label: 'Vector cards (Knoll)',
  license: 'Public domain (faces); back CC0 (BdRGames)',
  credit: 'Vector playing cards by Byron Knoll (public domain); back by BdRGames (CC0)',
  kind: 'file',
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

/* ------------------------------------------------------------------ */
/* kenney — Kenney "Playing Cards Pack" (CC0), 64x64 pixel-art PNGs.   */
/* Files: card_<suit>_<rank>.png with zero-padded ranks (02..09);      */
/* card_back.png; card_joker_black.png / card_joker_red.png.           */
/* ------------------------------------------------------------------ */

const KENNEY_SUIT_NAMES: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

function kenneyRankLabel(rank: number): string {
  // Kenney zero-pads only the digit ranks 2..9 (card_clubs_02.png) —
  // A/10/J/Q/K stay as-is (card_clubs_A.png).
  const label = RANK_LABELS[rank]
  return rank >= 2 && rank <= 9 ? `0${label}` : label
}

const kenneyTheme: CardTheme = {
  id: 'kenney',
  label: 'Pixel cards (Kenney)',
  license: 'CC0 1.0',
  credit: 'Playing Cards Pack by Kenney (kenney.nl), CC0',
  kind: 'file',
  hasJokers: true,
  imageRendering: 'pixelated',
  faceUrl(card: Card): string {
    if (isJoker(card)) {
      const color = svgJokerIndex(card) === 'odd' ? 'black' : 'red'
      return `/cards/kenney/card_joker_${color}.png`
    }
    return `/cards/kenney/card_${KENNEY_SUIT_NAMES[card.suit!]}_${kenneyRankLabel(card.rank!)}.png`
  },
  backUrl(): string {
    return '/cards/kenney/card_back.png'
  },
}

/** Registered themes, in display order. */
export const THEMES: readonly CardTheme[] = [svgCardsTheme, byronTheme, kenneyTheme]

/** Look up a theme by id; throws EngineError for an unknown id. */
export function getTheme(id: string): CardTheme {
  const theme = THEMES.find((t) => t.id === id)
  if (!theme) throw new EngineError(`Unknown card theme: "${id}"`)
  return theme
}
