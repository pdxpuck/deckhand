#!/usr/bin/env node
/**
 * derive-svgcards-geometry.mjs — extract TRUE per-card bounding boxes from the
 * svgcards sprite (public/cards/svgcards/svg-cards.svg, SVG-cards 2.0.1 by
 * David Bellot, LGPL-2.1+) and emit src/renderer/svgcards-geometry.ts.
 *
 * Replaces the hand-derived grid math (row/col pitch constants) that produced
 * stretched + bottom-cropped cards at the P2 visual gate. Instead of assuming
 * a grid, this script MEASURES the sprite:
 *
 *   1. Parse the SVG into a lightweight element tree (regex tokenizer — no deps).
 *   2. For each card group <g id="..."> (52 ranks x 4 suits + 2 jokers + back),
 *      walk child geometry, resolving <use xlink:href="#..."> references and
 *      composing transform attributes (matrix/translate/scale/rotate/skew).
 *   3. Bounds per element: exact extrema for lines/cubics/quadratics (derivative
 *      roots), dense sampling for arcs (center parameterization) and ellipses;
 *      <text> gets a rough anchor+font-size box (labels sit well inside the
 *      card body, so they never win the min/max in practice).
 *   4. Pad each bbox uniformly (SVG_CARDS_PAD) for stroke width + anti-aliasing.
 *   5. Self-validate before writing: across the 52 face cards, w and h spread
 *      must be < 2% and the height/width aspect within [1.30, 1.50]. On failure
 *      the script exits non-zero and writes NOTHING.
 *
 * Usage: node scripts/derive-svgcards-geometry.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SPRITE_PATH = path.join(REPO_ROOT, 'public', 'cards', 'svgcards', 'svg-cards.svg')
const OUT_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'svgcards-geometry.ts')

/** Uniform padding (sprite units) around each card's true bbox. Covers the
 *  base card stroke (2.5 wide -> 1.25 outside the path) plus AA headroom. */
const PAD = 2.0

const RANK_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king']
const SUIT_NAMES = ['club', 'diamond', 'heart', 'spade']
const FACE_IDS = SUIT_NAMES.flatMap((s) => RANK_NAMES.map((r) => `${r}_${s}`))
const EXTRA_IDS = ['red_joker', 'black_joker', 'back']
const ALL_IDS = [...FACE_IDS, ...EXTRA_IDS]

/* ------------------------------------------------------------------ */
/* Minimal XML tree (regex tokenizer; svg-cards.svg is machine-written */
/* and well-formed, attribute values never contain '>' edge cases)     */
/* ------------------------------------------------------------------ */

function parseTree(xml) {
  xml = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>[]*(?:\[[^\]]*\])?>/g, '')
  // NOTE: '/' is excluded from unquoted attribute chars so the trailing '/' of
  // self-closing tags is captured by the last group — otherwise <use .../>
  // would be treated as an open tag and the tree would silently mis-nest.
  const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'/])*)(\/?)>/g
  const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  const doc = { name: '#document', attrs: {}, children: [] }
  const stack = [doc]
  let m
  while ((m = tagRe.exec(xml)) !== null) {
    if (m[1] === '/') {
      if (stack.length > 1) stack.pop()
      continue
    }
    const attrs = {}
    let a
    attrRe.lastIndex = 0
    while ((a = attrRe.exec(m[3])) !== null) attrs[a[1]] = a[2] ?? a[3]
    const el = { name: m[2], attrs, children: [] }
    stack[stack.length - 1].children.push(el)
    if (m[4] !== '/') stack.push(el)
  }
  return doc
}

function indexById(el, map = new Map()) {
  if (el.attrs && el.attrs.id && !map.has(el.attrs.id)) map.set(el.attrs.id, el)
  for (const c of el.children ?? []) indexById(c, map)
  return map
}

/* ------------------------------------------------------------------ */
/* Affine transforms (SVG matrix order [a,b,c,d,e,f])                  */
/* ------------------------------------------------------------------ */

const IDENTITY = [1, 0, 0, 1, 0, 0]

/** Compose: result(point) = m(n(point)) — n is applied first. */
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function parseTransform(s) {
  if (!s || !s.trim()) return IDENTITY
  let m = IDENTITY
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  let t
  while ((t = re.exec(s)) !== null) {
    const args = t[2].split(/[\s,]+/).filter(Boolean).map(Number)
    let n
    switch (t[1]) {
      case 'matrix':
        n = args
        break
      case 'translate':
        n = [1, 0, 0, 1, args[0] || 0, args[1] || 0]
        break
      case 'scale':
        n = [args[0], 0, 0, args[1] ?? args[0], 0, 0]
        break
      case 'rotate': {
        const r = (args[0] * Math.PI) / 180
        const cos = Math.cos(r)
        const sin = Math.sin(r)
        if (args.length >= 3) {
          const cx = args[1]
          const cy = args[2]
          n = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]
        } else {
          n = [cos, sin, -sin, cos, 0, 0]
        }
        break
      }
      case 'skewX':
        n = [1, 0, Math.tan((args[0] * Math.PI) / 180), 1, 0, 0]
        break
      case 'skewY':
        n = [1, Math.tan((args[0] * Math.PI) / 180), 0, 1, 0, 0]
        break
      default:
        continue
    }
    m = mul(m, n)
  }
  return m
}

/* ------------------------------------------------------------------ */
/* Path data walker (flag-aware arc parsing) -> extreme points         */
/* ------------------------------------------------------------------ */

function pathCursor(d) {
  let i = 0
  const ws = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++
  }
  return {
    peek() {
      ws()
      return i < d.length ? d[i] : null
    },
    cmd() {
      ws()
      return d[i++]
    },
    number() {
      ws()
      const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i))
      if (!m) {
        throw new Error(
          `bad number in path data at offset ${i}: ...${d.slice(Math.max(0, i - 40), i + 20)}...`,
        )
      }
      i += m[0].length
      return parseFloat(m[0])
    },
    flag() {
      ws()
      const c = d[i]
      if (c !== '0' && c !== '1') throw new Error(`bad arc flag at offset ${i}`)
      i++
      return c === '1'
    },
  }
}

/** Center parameterization of an arc (SVG spec F.6.5); returns sample points
 *  from (x1,y1) to (x2,y2) inclusive. Dense enough that the transformed
 *  samples bound the true arc to << PAD. */
function arcPoints(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2, samples = 64) {
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  if (rx === 0 || ry === 0) return [[x2, y2]] // degenerate arc = line
  const phi = (phiDeg * Math.PI) / 180
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)
  const dx2 = (x1 - x2) / 2
  const dy2 = (y1 - y2) / 2
  const x1p = cosP * dx2 + sinP * dy2
  const y1p = -sinP * dx2 + cosP * dy2
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }
  const sign = largeArc !== sweep ? 1 : -1
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  if (!(den > 1e-12)) {
    // Degenerate: start point numerically at the arc center — the center
    // parameterization blows up (co ~ 1/sqrt(den)). Treat as a straight line.
    return [[x2, y2]]
  }
  const co = sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
  const ux = (x1p - cxp) / rx
  const uy = (y1p - cyp) / ry
  const vx = (-x1p - cxp) / rx
  const vy = (-y1p - cyp) / ry
  const angle = (a, b) => {
    const dot = a[0] * b[0] + a[1] * b[1]
    const len = Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1])
    let ang = Math.acos(Math.min(1, Math.max(-1, dot / (len || 1e-12))))
    if (a[0] * b[1] - a[1] * b[0] < 0) ang = -ang
    return ang
  }
  const theta1 = angle([1, 0], [ux, uy])
  let dTheta = angle([ux, uy], [vx, vy])
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI
  const pts = []
  for (let k = 0; k <= samples; k++) {
    const t = k / samples
    const th = theta1 + dTheta * t
    pts.push([
      cx + rx * Math.cos(th) * cosP - ry * Math.sin(th) * sinP,
      cy + rx * Math.cos(th) * sinP + ry * Math.sin(th) * cosP,
    ])
  }
  return pts
}

/** Extrema of a cubic Bézier (one axis) after control points are already in
 *  target space — exact: solve the quadratic derivative for roots in (0,1). */
function cubicExtrema(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 3 * p0 - 6 * p1 + 3 * p2
  const c = -3 * p0 + 3 * p1
  const out = [p0, p3]
  const evalAt = (t) => ((a * t + b) * t + c) * t + p0
  const push = (t) => {
    if (t > 0 && t < 1) out.push(evalAt(t))
  }
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) push(-c / (2 * b))
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const sq = Math.sqrt(disc)
      push((-b + sq) / (2 * a))
      push((-b - sq) / (2 * a))
    }
  }
  return out
}

/** Extrema of a quadratic Bézier (one axis) in target space. */
function quadExtrema(p0, p1, p2) {
  const out = [p0, p2]
  const den = p0 - 2 * p1 + p2
  if (Math.abs(den) > 1e-12) {
    const t = (p0 - p1) / den
    if (t > 0 && t < 1) out.push((1 - t) * (1 - t) * p0 + 2 * t * (1 - t) * p1 + t * t * p2)
  }
  return out
}

class BBox {
  constructor() {
    this.minX = Infinity
    this.minY = Infinity
    this.maxX = -Infinity
    this.maxY = -Infinity
  }
  add(x, y) {
    if (x < this.minX) this.minX = x
    if (y < this.minY) this.minY = y
    if (x > this.maxX) this.maxX = x
    if (y > this.maxY) this.maxY = y
  }
  get empty() {
    return this.minX === Infinity
  }
}

function addPathBounds(bbox, d, m) {
  const c = pathCursor(d)
  let cmd = null
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let prevCubic2 = null
  let prevQuad1 = null
  let prevWasCubic = false
  let prevWasQuad = false

  const lineTo = (x, y) => {
    const p = apply(m, x, y)
    bbox.add(p[0], p[1])
    cx = x
    cy = y
  }
  const cubicTo = (x1, y1, x2, y2, x, y) => {
    const [X0, Y0] = apply(m, cx, cy)
    const [X1, Y1] = apply(m, x1, y1)
    const [X2, Y2] = apply(m, x2, y2)
    const [X3, Y3] = apply(m, x, y)
    for (const v of cubicExtrema(X0, X1, X2, X3)) bbox.add(v, Y0)
    for (const v of cubicExtrema(Y0, Y1, Y2, Y3)) bbox.add(X0, v)
    cx = x
    cy = y
    prevCubic2 = [x2, y2]
    prevWasCubic = true
    prevWasQuad = false
  }
  const quadTo = (x1, y1, x, y) => {
    const [X0, Y0] = apply(m, cx, cy)
    const [X1, Y1] = apply(m, x1, y1)
    const [X2, Y2] = apply(m, x, y)
    for (const v of quadExtrema(X0, X1, X2)) bbox.add(v, Y0)
    for (const v of quadExtrema(Y0, Y1, Y2)) bbox.add(X0, v)
    cx = x
    cy = y
    prevQuad1 = [x1, y1]
    prevWasQuad = true
    prevWasCubic = false
  }
  const arcTo = (rx, ry, phi, fa, fs, x, y) => {
    const pts = arcPoints(cx, cy, rx, ry, phi, fa, fs, x, y)
    for (const [px, py] of pts) {
      const p = apply(m, px, py)
      bbox.add(p[0], p[1])
    }
    cx = x
    cy = y
    prevWasCubic = false
    prevWasQuad = false
  }

  const nextNumber = () => c.number()
  // Run `fn` over repeated coordinate groups (implicit command repetition).
  // `relative` adds the CURRENT point to every coordinate pair — only safe
  // for commands whose args are all coordinates (l/h/v/c/q...); arcs pass
  // relative=false (flags/rotation sit between the coordinates, and their
  // endpoint translation is handled in the arcTo callback).
  const pairs = (fn, relative, count) => {
    do {
      const args = []
      for (let k = 0; k < count; k++) args.push(nextNumber())
      if (relative) {
        for (let k = 0; k + 1 < count; k += 2) {
          args[k] += cx
          args[k + 1] += cy
        }
      }
      fn(...args)
    } while (c.peek() !== null && !/[A-Za-z]/.test(c.peek()))
  }

  while (c.peek() !== null) {
    if (/[A-Za-z]/.test(c.peek())) {
      cmd = c.cmd()
      // S/T reflection depends on the PREVIOUS command only (SVG spec): S/s
      // inherit from C/c/S/s, T/t from Q/q/T/t; any other command breaks the
      // chain. cubicTo/quadTo re-arm their flag below; here we clear the flag
      // this command does NOT inherit.
      if (cmd !== 'S' && cmd !== 's') prevWasCubic = false
      if (cmd !== 'T' && cmd !== 't') prevWasQuad = false
    } else if (cmd === null) {
      throw new Error('path data starts with a coordinate')
    } else if (cmd === 'M') {
      cmd = 'L' // implicit lineto after moveto
    } else if (cmd === 'm') {
      cmd = 'l'
    }
    switch (cmd) {
      case 'M':
      case 'm': {
        let x = c.number()
        let y = c.number()
        if (cmd === 'm') {
          x += cx
          y += cy
        }
        cx = x
        cy = y
        sx = x
        sy = y
        break
      }
      case 'L':
        pairs((x, y) => lineTo(x, y), false, 2)
        break
      case 'l':
        pairs((x, y) => lineTo(x, y), true, 2)
        break
      case 'H':
        pairs((x) => lineTo(x, cy), false, 1)
        break
      case 'h':
        do {
          lineTo(cx + c.number(), cy)
        } while (c.peek() !== null && !/[A-Za-z]/.test(c.peek()))
        break
      case 'V':
        pairs((y) => lineTo(cx, y), false, 1)
        break
      case 'v':
        do {
          lineTo(cx, cy + c.number())
        } while (c.peek() !== null && !/[A-Za-z]/.test(c.peek()))
        break
      case 'C':
        pairs((x1, y1, x2, y2, x, y) => cubicTo(x1, y1, x2, y2, x, y), false, 6)
        break
      case 'c':
        // pairs() translates every coordinate pair by the current point.
        pairs((x1, y1, x2, y2, x, y) => cubicTo(x1, y1, x2, y2, x, y), true, 6)
        break
      case 'S':
      case 's': {
        const rel = cmd === 's'
        do {
          let x2 = c.number()
          let y2 = c.number()
          let x = c.number()
          let y = c.number()
          if (rel) {
            x2 += cx
            y2 += cy
            x += cx
            y += cy
          }
          const reflected =
            prevWasCubic && prevCubic2 ? [2 * cx - prevCubic2[0], 2 * cy - prevCubic2[1]] : [cx, cy]
          cubicTo(reflected[0], reflected[1], x2, y2, x, y)
        } while (c.peek() !== null && !/[A-Za-z]/.test(c.peek()))
        break
      }
      case 'Q':
        pairs((x1, y1, x, y) => quadTo(x1, y1, x, y), false, 4)
        break
      case 'q':
        pairs((x1, y1, x, y) => quadTo(x1, y1, x, y), true, 4)
        break
      case 'T':
      case 't': {
        const rel = cmd === 't'
        do {
          let x = c.number()
          let y = c.number()
          if (rel) {
            x += cx
            y += cy
          }
          const x1 = prevWasQuad && prevQuad1 ? 2 * cx - prevQuad1[0] : cx
          const y1 = prevWasQuad && prevQuad1 ? 2 * cy - prevQuad1[1] : cy
          quadTo(x1, y1, x, y)
        } while (c.peek() !== null && !/[A-Za-z]/.test(c.peek()))
        break
      }
      case 'A':
        pairs((rx, ry, phi, fa, fs, x, y) => arcTo(rx, ry, phi, fa === 1, fs === 1, x, y), false, 7)
        break
      case 'a':
        pairs(
          (rx, ry, phi, fa, fs, x, y) => arcTo(rx, ry, phi, fa === 1, fs === 1, cx + x, cy + y),
          false,
          7,
        )
        break
      case 'Z':
      case 'z':
        lineTo(sx, sy)
        break
      default:
        throw new Error(`unsupported path command: ${cmd}`)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Element walk                                                        */
/* ------------------------------------------------------------------ */

const SKIP_ELEMENTS = new Set(['title', 'desc', 'metadata', 'defs', 'style', 'script'])

function elementBounds(el, m, idIndex, visiting, bbox, warn) {
  switch (el.name) {
    case 'g': {
      const m2 = mul(m, parseTransform(el.attrs.transform))
      for (const child of el.children) {
        if (SKIP_ELEMENTS.has(child.name)) continue
        elementBounds(child, m2, idIndex, visiting, bbox, warn)
      }
      break
    }
    case 'use': {
      const href = el.attrs['xlink:href'] ?? el.attrs.href
      if (!href || !href.startsWith('#')) break
      const id = href.slice(1)
      const target = idIndex.get(id)
      if (!target) {
        warn(`unresolved <use> reference: #${id}`)
        break
      }
      if (visiting.has(id)) break // circular reference guard
      let mu = mul(m, parseTransform(el.attrs.transform))
      const ux = Number(el.attrs.x ?? 0) || 0
      const uy = Number(el.attrs.y ?? 0) || 0
      if (ux !== 0 || uy !== 0) mu = mul(mu, [1, 0, 0, 1, ux, uy])
      visiting.add(id)
      elementBounds(target, mu, idIndex, visiting, bbox, warn)
      visiting.delete(id)
      break
    }
    case 'path': {
      if (el.attrs.d) addPathBounds(bbox, el.attrs.d, m)
      break
    }
    case 'rect': {
      const x = Number(el.attrs.x ?? 0)
      const y = Number(el.attrs.y ?? 0)
      const w = Number(el.attrs.width ?? 0)
      const h = Number(el.attrs.height ?? 0)
      for (const [px, py] of [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ]) {
        const p = apply(m, px, py)
        bbox.add(p[0], p[1])
      }
      break
    }
    case 'circle':
    case 'ellipse': {
      const cx0 = Number(el.attrs.cx ?? 0)
      const cy0 = Number(el.attrs.cy ?? 0)
      const rx = Number(el.attrs.r ?? el.attrs.rx ?? 0)
      const ry = Number(el.attrs.r ?? el.attrs.ry ?? 0)
      for (let k = 0; k < 64; k++) {
        const t = (k / 64) * 2 * Math.PI
        const p = apply(m, cx0 + rx * Math.cos(t), cy0 + ry * Math.sin(t))
        bbox.add(p[0], p[1])
      }
      break
    }
    case 'line': {
      for (const [px, py] of [
        [Number(el.attrs.x1 ?? 0), Number(el.attrs.y1 ?? 0)],
        [Number(el.attrs.x2 ?? 0), Number(el.attrs.y2 ?? 0)],
      ]) {
        const p = apply(m, px, py)
        bbox.add(p[0], p[1])
      }
      break
    }
    case 'polyline':
    case 'polygon': {
      const nums = (el.attrs.points ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
      for (let k = 0; k + 1 < nums.length; k += 2) {
        const p = apply(m, nums[k], nums[k + 1])
        bbox.add(p[0], p[1])
      }
      break
    }
    case 'text': {
      // Rough box: anchor (x,y) = baseline start, glyph extent from typical
      // font metrics (cap ≈ 0.76em above baseline, descender ≈ 0.24em below,
      // advance ≈ 0.6em/glyph). Card labels sit well inside the card body, so
      // this never wins the min/max — it just keeps the walk total. (No real
      // glyph metrics without a rendering engine.)
      const x = Number((el.attrs.x ?? '0').split(/[\s,]+/)[0])
      const y = Number((el.attrs.y ?? '0').split(/[\s,]+/)[0])
      const fs = Number(el.attrs['font-size'] ?? 12) || 12
      const len = (el.children.filter((n) => typeof n === 'string').join('') || '0').length
      for (const [px, py] of [
        [x, y - 0.76 * fs],
        [x + 0.6 * fs * len, y + 0.24 * fs],
      ]) {
        const p = apply(m, px, py)
        bbox.add(p[0], p[1])
      }
      break
    }
    default:
      break
  }
}

function groupBounds(groupEl, idIndex, warn) {
  const bbox = new BBox()
  elementBounds(groupEl, IDENTITY, idIndex, new Set(), bbox, warn)
  return bbox
}

/* ------------------------------------------------------------------ */
/* Statistics + validation                                             */
/* ------------------------------------------------------------------ */

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(4) : String(v)
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

function main() {
  const xml = readFileSync(SPRITE_PATH, 'utf8')
  const doc = parseTree(xml)
  const svgRoot = doc.children.find((c) => c.name === 'svg')
  if (!svgRoot) throw new Error('no <svg> root found')
  const idIndex = indexById(svgRoot)
  const warnings = []
  const warn = (msg) => {
    if (!warnings.includes(msg)) warnings.push(msg)
  }

  /** group id -> true (unpadded) bbox in root coords. */
  const trueBoxes = {}
  for (const id of ALL_IDS) {
    const el = idIndex.get(id)
    if (!el || el.name !== 'g') throw new Error(`sprite is missing card group "${id}"`)
    const bbox = groupBounds(el, idIndex, warn)
    if (bbox.empty || bbox.maxX - bbox.minX <= 0 || bbox.maxY - bbox.minY <= 0) {
      throw new Error(`group "${id}" has an empty/degenerate bbox — aborting, refusing to emit garbage`)
    }
    trueBoxes[id] = bbox
  }

  // The shared card-body path (needed to cell-crop the bottom-row groups).
  const baseEl = idIndex.get('base')
  if (!baseEl || baseEl.name !== 'g') throw new Error('sprite is missing the "base" group')
  const baseBbox = groupBounds(baseEl, idIndex, warn)
  if (baseBbox.empty) throw new Error('"base" group has an empty bbox')
  trueBoxes.base = baseBbox

  // --- validation over the 52 faces (dictated gates) ---
  const ws = FACE_IDS.map((id) => trueBoxes[id].maxX - trueBoxes[id].minX + 2 * PAD)
  const hs = FACE_IDS.map((id) => trueBoxes[id].maxY - trueBoxes[id].minY + 2 * PAD)
  const aspects = ws.map((w, i) => hs[i] / w)
  const medW = median(ws)
  const medH = median(hs)
  const spreadW = (Math.max(...ws) - Math.min(...ws)) / medW
  const spreadH = (Math.max(...hs) - Math.min(...hs)) / medH
  const medAspect = median(aspects)

  console.log('--- svgcards geometry extraction ---')
  console.log(`sprite: ${path.relative(REPO_ROOT, SPRITE_PATH)} (pad ${PAD})`)
  console.log(`face bbox w:  min ${fmt(Math.min(...ws))}  max ${fmt(Math.max(...ws))}  median ${fmt(medW)}  spread ${(spreadW * 100).toFixed(3)}%`)
  console.log(`face bbox h:  min ${fmt(Math.min(...hs))}  max ${fmt(Math.max(...hs))}  median ${fmt(medH)}  spread ${(spreadH * 100).toFixed(3)}%`)
  console.log(`face aspect (h/w): median ${fmt(medAspect)}  range [${fmt(Math.min(...aspects))}, ${fmt(Math.max(...aspects))}]`)

  const problems = []
  if (!(spreadW < 0.02)) problems.push(`face w spread ${(spreadW * 100).toFixed(2)}% >= 2%`)
  if (!(spreadH < 0.02)) problems.push(`face h spread ${(spreadH * 100).toFixed(2)}% >= 2%`)
  if (!(medAspect >= 1.3 && medAspect <= 1.5)) problems.push(`face aspect ${fmt(medAspect)} outside [1.30, 1.50]`)
  if (problems.length) {
    console.error(`VALIDATION FAILED:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }

  // --- jokers + back: crop to the base-card cell, not the group's true bbox ---
  //
  // The bottom-row groups (red_joker, black_joker, back) each reference the
  // full shared joker/back figure, whose art overflows its own card cell to
  // the right. The sprite relies on DRAW ORDER: the NEXT card's opaque white
  // base paints over that overflow. A fragment render (<use href="#red_joker">)
  // draws alone, so the overflow would stick out. Cropping the viewBox to the
  // group's own base-card cell reproduces the full-sprite compositing: art
  // beyond the cell is simply not shown. (Verified: the sprite has zero
  // clipPath/mask elements, and the measured figure boxes exceed their cells.)
  const baseBox = trueBoxes.base // card body path, local coords
  const padBox = (x, y, w, h) => ({ x: x - PAD, y: y - PAD, w: w + 2 * PAD, h: h + 2 * PAD })
  const geometry = {}
  for (const id of FACE_IDS) {
    const b = trueBoxes[id]
    geometry[id] = padBox(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY)
  }
  for (const id of EXTRA_IDS) {
    const group = idIndex.get(id)
    const baseUse = group.children.find(
      (c) => c.name === 'use' && (c.attrs['xlink:href'] ?? c.attrs.href) === '#base',
    )
    if (!baseUse) throw new Error(`group "${id}" has no direct <use href="#base"> anchor`)
    const ax = Number(baseUse.attrs.x ?? 0) || 0
    const ay = Number(baseUse.attrs.y ?? 0) || 0
    geometry[id] = padBox(ax + baseBox.minX, ay + baseBox.minY, baseBox.maxX - baseBox.minX, baseBox.maxY - baseBox.minY)
    const tb = trueBoxes[id]
    console.log(
      `${id}: cell-crop emitted (anchor ${ax},${ay}); true group bbox ` +
        `x[${fmt(tb.minX)},${fmt(tb.maxX)}] y[${fmt(tb.minY)},${fmt(tb.maxY)}] overflows cell (sprite draw-order art)`,
    )
  }
  if (warnings.length) console.log(`warnings:\n  ${warnings.join('\n  ')}`)

  // --- emit (rounded to 4 decimals) ---
  const r4 = (v) => Math.round(v * 10000) / 10000
  const entries = ALL_IDS.map((id) => {
    const g = geometry[id]
    return `  '${id}': { x: ${r4(g.x)}, y: ${r4(g.y)}, w: ${r4(g.w)}, h: ${r4(g.h)} },`
  }).join('\n')

  const out = `/**
 * GENERATED by scripts/derive-svgcards-geometry.mjs — do not edit by hand.
 * Source: public/cards/svgcards/svg-cards.svg (SVG-cards 2.0.1, David Bellot,
 * LGPL-2.1-or-later). Per-card-group bounding boxes, measured from the sprite
 * (transform-aware walk: <use> resolution, Bézier extrema, arc sampling) and
 * padded uniformly by ${PAD} sprite units for stroke width and anti-aliasing
 * headroom. Coordinates are in the sprite's root space; consumed by the
 * svgcards theme's viewBoxFor in src/renderer/theme.ts.
 *
 * The 52 face boxes are each group's TRUE measured bbox (all identical to
 * within rounding — the shared card-body path). The red_joker / black_joker /
 * back boxes are the base-card CELL crop: those groups' shared figure art
 * overflows its cell and relies on the next card's base painting over it in a
 * full-sprite render (the sprite ships no clip paths), so a fragment render
 * must crop to the cell to look right.
 */

/** Padded bounding box of one card group inside the sprite. */
export interface SvgCardsBox {
  x: number
  y: number
  w: number
  h: number
}

export const SVG_CARDS_GEOMETRY: Record<string, SvgCardsBox> = {
${entries}
}

/**
 * Median height/width across the 52 face cards (CardTheme.ratio convention:
 * height/width, so cards render at the art's native aspect — no stretching).
 * Validation at generation time: w/h spread < 2%, aspect within [1.30, 1.50].
 */
export const SVG_CARDS_RATIO = ${r4(medAspect)}
`

  writeFileSync(OUT_PATH, out)
  console.log(`wrote ${path.relative(REPO_ROOT, OUT_PATH)}`)
  console.log(`validation: PASSED (spread w ${(spreadW * 100).toFixed(3)}% / h ${(spreadH * 100).toFixed(3)}%, aspect ${fmt(medAspect)})`)
}

main()
