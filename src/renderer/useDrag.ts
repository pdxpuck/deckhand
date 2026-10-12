/**
 * useDrag — pointer-event drag foundation (P3 groundwork).
 *
 * No external dnd library (native HTML5 DnD rejected for touch jank;
 * dnd-kit deferred to P3 only if this proves insufficient). Pointer Events
 * with setPointerCapture keep the drag locked to the pressed element, so
 * moves/ups keep firing even when the pointer leaves the element — and one
 * hook instance can serve several drag sources: the capture target is the
 * element that received the pointerdown (e.currentTarget), which lets
 * consumers tag sources via data attributes.
 *
 * Drop-target checks pair this with withinBounds(point, elementRect).
 * Consumers should attach `bindings` to the draggable element; the style
 * (touch-action: none) keeps touch drags from scrolling the page.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

/** A client-space (viewport) point. */
export interface Point {
  readonly x: number
  readonly y: number
}

export interface DragCallbacks {
  onDragStart?: (point: Point, e: ReactPointerEvent<HTMLElement>) => void
  onDragMove?: (point: Point, e: ReactPointerEvent<HTMLElement>) => void
  onDragEnd?: (point: Point, e: ReactPointerEvent<HTMLElement>) => void
}

export interface DragBindings {
  style: { readonly touchAction: 'none' }
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
}

export interface DragHandle {
  /** True while a drag is in progress. */
  dragging: boolean
  /** Current pointer position while dragging; null when idle. */
  point: Point | null
  /** Ref for consumers that need the bound element itself. */
  ref: RefObject<HTMLElement | null>
  /** Spread onto the draggable element. */
  bindings: DragBindings
}

/** True when point lies inside rect (inclusive edges) — drop-target hit test. */
export function withinBounds(point: Point, rect: DOMRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  )
}

export function useDrag(callbacks: DragCallbacks = {}): DragHandle {
  const [dragging, setDragging] = useState(false)
  const [point, setPoint] = useState<Point | null>(null)
  const activeRef = useRef(false)
  // Latest-callbacks ref keeps the handlers stable across renders; updated
  // after commit so the rule "no ref access during render" holds. Event
  // handlers only ever fire post-commit, so they always see the latest.
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  })
  const ref = useRef<HTMLElement | null>(null)

  const start = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return // primary button / pen / finger only
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    activeRef.current = true
    const p = { x: e.clientX, y: e.clientY }
    setDragging(true)
    setPoint(p)
    callbacksRef.current.onDragStart?.(p, e)
  }, [])

  const move = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!activeRef.current) return
    const p = { x: e.clientX, y: e.clientY }
    setPoint(p)
    callbacksRef.current.onDragMove?.(p, e)
  }, [])

  const end = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!activeRef.current) return
    activeRef.current = false
    setDragging(false)
    setPoint(null)
    callbacksRef.current.onDragEnd?.({ x: e.clientX, y: e.clientY }, e)
  }, [])

  const bindings: DragBindings = {
    style: { touchAction: 'none' },
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  }

  return { dragging, point, ref, bindings }
}
