/**
 * Dev-only demo harness (D7): card/theme display sandbox for the P2 renderer
 * visual gate. Test tooling, not a game.
 *
 * Everything is driven by one seeded shuffle, so the same seed always yields
 * the same layout — visibly proving the engine contract. Pile moves flow
 * through the engine action log (applyAction + replay), never direct
 * mutation.
 */
import { useMemo, useRef, useState } from 'react'
import {
  STANDARD,
  applyAction,
  buildDeck,
  createRng,
  createWorld,
  dealCards,
  isJoker,
  replay,
  shuffle,
  topCard,
} from '../engine'
import type { Action, Card, PileId, World } from '../engine'
import { CardView } from '../renderer/CardView'
import { StackView } from '../renderer/StackView'
import { THEMES, getTheme } from '../renderer/theme'
import { useDrag, withinBounds } from '../renderer/useDrag'

const PILE_IDS: readonly PileId[] = ['stock', 'tableau', 'foundation']

const SIZE_OPTIONS = [
  { id: 'sm', label: 'sm', width: 60 },
  { id: 'md', label: 'md', width: 100 },
  { id: 'lg', label: 'lg', width: 140 },
] as const

/** Initial deal from one seeded shuffle; runs before the action log begins. */
function buildInitialWorld(seed: string): World {
  const deck = shuffle(buildDeck(STANDARD), createRng(seed))
  let world = createWorld(PILE_IDS)
  world = dealCards(world, 'stock', deck.slice(0, 10), false)
  world = dealCards(world, 'tableau', deck.slice(10, 15), false)
  world = dealCards(world, 'tableau', deck.slice(15, 17), true)
  world = dealCards(world, 'foundation', deck.slice(17, 19), true)
  return world
}

function DemoHarness() {
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [seed, setSeed] = useState('deckhand')
  const [seedDraft, setSeedDraft] = useState('deckhand')
  const [sizeId, setSizeId] = useState<(typeof SIZE_OPTIONS)[number]['id']>('md')
  const [initialWorld, setInitialWorld] = useState<World>(() => buildInitialWorld('deckhand'))
  const [actions, setActions] = useState<readonly Action[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hoveredPile, setHoveredPile] = useState<PileId | null>(null)

  const theme = getTheme(themeId)
  const width = SIZE_OPTIONS.find((s) => s.id === sizeId)!.width
  const height = Math.round(width * theme.ratio)

  // The whole loop runs through the action log: state = replay(initial, actions).
  const world = useMemo(() => replay(initialWorld, actions), [initialWorld, actions])

  const fullDeck = useMemo(() => shuffle(buildDeck(STANDARD), createRng(seed)), [seed])
  const jokers = useMemo(
    () => shuffle(buildDeck({ decks: 1, jokers: 2 }), createRng(`${seed}:jokers`)).filter(isJoker),
    [seed],
  )

  const pileRefs = useRef<Partial<Record<PileId, HTMLDivElement | null>>>({})
  // Ref = handler-side source of truth (event handlers may read refs);
  // state = render-side copy for the floating dragged card.
  const dragSourceRef = useRef<{ pile: PileId; card: Card } | null>(null)
  const [dragSource, setDragSource] = useState<{ pile: PileId; card: Card } | null>(null)

  const drag = useDrag({
    onDragStart: (_point, e) => {
      const pileId = e.currentTarget.dataset.pile as PileId | undefined
      if (!pileId) return
      const top = topCard(world, pileId)
      if (!top) return
      const source = { pile: pileId, card: top.card }
      dragSourceRef.current = source
      setDragSource(source)
      setError(null)
    },
    onDragMove: (point) => {
      const source = dragSourceRef.current
      const hit = PILE_IDS.find(
        (id) =>
          id !== source?.pile &&
          pileRefs.current[id] &&
          withinBounds(point, pileRefs.current[id]!.getBoundingClientRect()),
      )
      setHoveredPile(hit ?? null)
    },
    onDragEnd: (point) => {
      const source = dragSourceRef.current
      dragSourceRef.current = null
      setDragSource(null)
      setHoveredPile(null)
      if (!source) return
      const target = PILE_IDS.find(
        (id) =>
          id !== source.pile &&
          pileRefs.current[id] &&
          withinBounds(point, pileRefs.current[id]!.getBoundingClientRect()),
      )
      if (!target) return
      const action: Action = { type: 'move', from: source.pile, to: target, count: 1 }
      try {
        applyAction(world, action) // validate before recording
        setActions((prev) => [...prev, action])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
  })

  // Split so the pile div can merge the drag style with its own sizing.
  const { style: dragStyle, ...dragHandlers } = drag.bindings

  const newDeal = () => {
    setSeed(seedDraft)
    setInitialWorld(buildInitialWorld(seedDraft))
    setActions([])
    setError(null)
  }

  return (
    <div className="demo">
      {/* ------------------------------------------------ controls */}
      <div className="demo-toolbar">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="demo-btn"
            data-active={t.id === themeId}
            onClick={() => setThemeId(t.id)}
          >
            {t.label}
          </button>
        ))}
        <input
          className="demo-input"
          type="text"
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          placeholder="seed"
          aria-label="Deal seed"
        />
        <button type="button" className="demo-btn" onClick={newDeal}>
          New deal
        </button>
        {SIZE_OPTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="demo-btn"
            data-active={s.id === sizeId}
            onClick={() => setSizeId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="demo-status">
        Actions: <strong>{actions.length}</strong> · seed{' '}
        <code>{seed}</code> — same seed, same deal
      </p>
      <p className="demo-error" role="alert">
        {error ?? ''}
      </p>

      {/* --------------------------------------- section 1: 52 grid */}
      <section className="demo-section">
        <h2>All 52 cards, face up</h2>
        <div className="demo-grid">
          {fullDeck.map((card) => (
            <CardView key={card.id} card={card} faceUp theme={theme} width={width} />
          ))}
        </div>
      </section>

      {/* --------------------------- section 2: backs + flipped trio */}
      <section className="demo-section">
        <h2>Card backs &amp; flipped cards</h2>
        <div className="demo-row">
          <StackView
            pileCards={fullDeck.slice(20, 28).map((card) => ({ card, faceUp: false }))}
            theme={theme}
            width={width}
          />
          {fullDeck.slice(28, 31).map((card) => (
            <CardView key={card.id} card={card} faceUp theme={theme} width={width} />
          ))}
        </div>
      </section>

      {/* ------------------------------- section 3: engine piles + drag */}
      <section className="demo-section">
        <h2>Engine piles — drag a top card onto another pile</h2>
        <p className="demo-note">
          Moves go through the engine action log (applyAction → replay). Drop a card
          anywhere inside a target pile.
        </p>
        <div className="demo-row">
          {PILE_IDS.map((pileId) => {
            const pile = world.piles[pileId]
            return (
              <div key={pileId}>
                <div
                  ref={(el) => {
                    pileRefs.current[pileId] = el
                  }}
                  data-pile={pileId}
                  className="demo-pile"
                  data-hover={drag.dragging && hoveredPile === pileId}
                  {...dragHandlers}
                  style={{ ...dragStyle, minHeight: height, minWidth: width }}
                >
                  <StackView pileCards={pile.cards} theme={theme} width={width} />
                </div>
                <p className="demo-note">{`${pileId} (${pile.cards.length})`}</p>
              </div>
            )
          })}
        </div>
        {drag.dragging && drag.point && dragSource && (
          <div
            style={{
              position: 'fixed',
              left: drag.point.x - width / 2,
              top: drag.point.y - height * 0.75,
              pointerEvents: 'none',
              zIndex: 1000,
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35))',
            }}
          >
            <CardView card={dragSource.card} faceUp theme={theme} width={width} />
          </div>
        )}
      </section>

      {/* ------------------------------------------------- jokers */}
      {theme.hasJokers && (
        <section className="demo-section">
          <h2>Jokers</h2>
          <div className="demo-row">
            {jokers.map((card) => (
              <CardView key={card.id} card={card} faceUp theme={theme} width={width} />
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------- footer */}
      <p className="demo-note" style={{ marginTop: 32 }}>
        Theme <strong>{theme.label}</strong> ({theme.id}) — {theme.kind} rendering ·{' '}
        {theme.license} · {theme.credit}
      </p>
    </div>
  )
}

export default DemoHarness
