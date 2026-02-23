import { memo, useRef, useEffect } from 'react'
import React from 'react'
import { Group, Rect, Text, Circle, Arrow, Line } from 'react-konva'
import Konva from 'konva'
import type { BoardObject } from '../types/board'
import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_CONNECTOR_COLOR,
  TEXT_DEFAULT_FONT_SIZE,
  MIN_OBJECT_SIZE,
  WATERMARK_PLACEHOLDER,
} from '../constants'
import { updateObject } from '../supabase/objects.ts'

const DRAG_UPDATE_THROTTLE_MS = 40
/** Slower throttle for nested frames to reduce lag/flash during drag */
const NESTED_FRAME_DRAG_THROTTLE_MS = 120

/** Keep canvas object effects lightweight; glass lives on static overlays, not board objects. */
const SHADOW = {
  shadowColor: 'black',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowOpacity: 0,
} as const

/**
 * Wraps a Konva Group so it is cached after paint. Invalidates cache when cacheKey changes.
 * Critical for performance: avoids redrawing shadows on every pan/zoom frame.
 */
function CachedGroup({
  cacheKey,
  children,
}: {
  cacheKey: string
  children: React.ReactElement
}) {
  const ref = useRef<Konva.Group>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.clearCache()
    node.cache()
  }, [cacheKey])
  return React.cloneElement(children, { ref })
}

/** When stored text is empty, show watermark (not stored). Returns display text and whether it is placeholder. */
function getDisplayText(raw: string | undefined): { text: string; isWatermark: boolean } {
  const t = (raw ?? '').trim()
  if (t === '') return { text: WATERMARK_PLACEHOLDER, isWatermark: true }
  return { text: raw ?? '', isWatermark: false }
}

const WATERMARK_FILL = '#9ca3af'
/** Explicit fill for real (non-watermark) text so it always renders visible. */
const DEFAULT_TEXT_FILL = '#1a1a1a'

/** Line-rect intersection: where the ray from (ax,ay) toward (bx,by) exits the rect. */
function lineRectExit(
  rect: { x: number; y: number; width: number; height: number },
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number } {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  let bestT = Infinity
  let best = { x: bx, y: by }
  const tryIntersect = (t: number, x: number, y: number) => {
    if (t > 0.01 && t < bestT && x >= left - 1 && x <= right + 1 && y >= top - 1 && y <= bottom + 1) {
      bestT = t
      best = { x, y }
    }
  }
  if (Math.abs(ux) > 1e-6) {
    tryIntersect((right - ax) / ux, right, ay + uy * ((right - ax) / ux))
    tryIntersect((left - ax) / ux, left, ay + uy * ((left - ax) / ux))
  }
  if (Math.abs(uy) > 1e-6) {
    tryIntersect((bottom - ay) / uy, ax + ux * ((bottom - ay) / uy), bottom)
    tryIntersect((top - ay) / uy, ax + ux * ((top - ay) / uy), top)
  }
  if (bestT < Infinity) return best
  return { x: cx, y: cy }
}

/** Where the ray from center toward (bx,by) exits the circle. Returns point on circle edge. */
function lineCircleExit(
  center: { x: number; y: number },
  radius: number,
  bx: number,
  by: number
): { x: number; y: number } {
  const dx = bx - center.x
  const dy = by - center.y
  const len = Math.hypot(dx, dy) || 1
  return {
    x: center.x + (dx / len) * radius,
    y: center.y + (dy / len) * radius,
  }
}

function textFontSize(obj: BoardObject): number {
  const base = Math.min(obj.width, obj.height) * 0.18
  return Math.max(10, Math.min(28, base))
}

/** Recursively collect all descendants of a frame (for drag-update). */
function getFrameDescendants(objects: BoardObject[], frameId: string): BoardObject[] {
  const result: BoardObject[] = []
  const children = objects.filter((o) => o.parent_id === frameId)
  for (const c of children) {
    result.push(c)
    if (c.type === 'frame') {
      result.push(...getFrameDescendants(objects, c.id))
    }
  }
  return result
}

/** Ids that cannot be valid parent: the frame itself + all descendants (prevents cycles). */
function getInvalidParentIds(objects: BoardObject[], frameId: string): Set<string> {
  const invalid = new Set<string>([frameId])
  getFrameDescendants(objects, frameId).forEach((d) => invalid.add(d.id))
  return invalid
}

type BoardObjectsProps = {
  boardId: string
  objects: BoardObject[]
  selectedIds: string[]
  onObjectClick: (id: string, shiftKey: boolean) => void
  /** Right-click on object: (objectId, clientX, clientY) for context menu */
  onObjectContextMenu?: (id: string, clientX: number, clientY: number) => void
  onStartEditText?: (id: string, text: string, part?: 'header' | 'body') => void
  onObjectMoved?: (id: string, x: number, y: number) => void
  onObjectParentChange?: (id: string, parentId: string | null) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  /** Called on every throttled drag-move. Should broadcast position to peers — no DB write. */
  onBroadcastDragMove?: (id: string, x: number, y: number) => void
  /** Called during multi-drag with delta from drag start position */
  onMultiDragMove?: (movedId: string, deltaX: number, deltaY: number) => void
  /** Connector tool: id of the first object clicked, waiting for second object */
  pendingConnectorFrom?: string | null
  /** Connector dragged to new position (updates from/to endpoints) */
  onConnectorMoved?: (id: string, fromX: number, fromY: number, toX: number, toY: number) => void
  /** View-only mode: no drag, no resize, no edit */
  readOnly?: boolean
}

function BoardObjects({
  boardId,
  objects,
  selectedIds,
  onObjectClick,
  onObjectContextMenu,
  onStartEditText,
  onObjectMoved,
  onObjectParentChange,
  onDragStart,
  onDragEnd,
  onBroadcastDragMove,
  onMultiDragMove,
  pendingConnectorFrom,
  onConnectorMoved,
  readOnly = false,
}: BoardObjectsProps) {
  const lastDragUpdateRef = useRef<Record<string, number>>({})
  const lastNestedDragRef = useRef<Record<string, number>>({})
  const draggable = !readOnly
  /** No text edit in view-only mode */
  const startEditText = readOnly ? undefined : onStartEditText

  const throttleDragUpdate = (objId: string, x: number, y: number, isNestedFrame = false) => {
    const now = Date.now()
    const key = objId
    const lastRef = isNestedFrame ? lastNestedDragRef : lastDragUpdateRef
    const interval = isNestedFrame ? NESTED_FRAME_DRAG_THROTTLE_MS : DRAG_UPDATE_THROTTLE_MS
    if (now - (lastRef.current[key] ?? 0) >= interval) {
      lastRef.current[key] = now
      onBroadcastDragMove?.(objId, x, y)
    }
  }

  const isMultiSelect = selectedIds.length > 1

  /** Resolve the Group's position (dragging may report a nested child). Traverse up to find target. */
  const getDragPosition = (e: Konva.KonvaEventObject<MouseEvent>, targetId: string) => {
    let node: Konva.Node | null = e.target
    while (node) {
      if (node.id() === targetId) return { x: node.x(), y: node.y() }
      node = node.getParent()
    }
    return { x: e.target.x(), y: e.target.y() }
  }

  const makeDragHandlers = (obj: BoardObject) => ({
    onDragStart: () => onDragStart?.(obj.id),
    onDragMove: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const { x: nodeX, y: nodeY } = getDragPosition(e, obj.id)
      throttleDragUpdate(obj.id, nodeX, nodeY)
      if (isMultiSelect && selectedIds.includes(obj.id)) {
        onMultiDragMove?.(obj.id, nodeX, nodeY)
      }
    },
    onDragEnd: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const { x, y } = getDragPosition(e, obj.id)
      const centerX = x + obj.width / 2
      const centerY = y + obj.height / 2
      const allFramesForContainment = objects.filter((o) => o.type === 'frame')
      const containingFrames = allFramesForContainment.filter(
        (f) =>
          centerX >= f.x &&
          centerX <= f.x + f.width &&
          centerY >= f.y &&
          centerY <= f.y + f.height
      )
      const containingFrame = containingFrames.length > 0
        ? containingFrames.reduce((a, b) => (a.width * a.height < b.width * b.height ? a : b))
        : null
      const newParentId = containingFrame?.id ?? null
      const prevParentId = obj.parent_id ?? null
      if (newParentId !== prevParentId) {
        onObjectParentChange?.(obj.id, newParentId)
      }
      onObjectMoved?.(obj.id, x, y)
      updateObject(boardId, obj.id, { x, y, parent_id: newParentId } as Parameters<typeof updateObject>[2]).catch(
        (err: unknown) => console.error('Failed to update object position', err)
      )
      onDragEnd?.()
    },
  })

  // Frames render first (behind all other objects). Only top-level frames; nested frames render inside parent.
  const frames = objects.filter((o) => o.type === 'frame' && !o.parent_id)
  const nonFrames = objects.filter((o) => o.type !== 'frame' && o.type !== 'connector' && !o.parent_id)
  const connectors = objects.filter((o) => o.type === 'connector')

  return (
    <>
      {/* Frames rendered first so they appear behind other objects */}
      {frames.map((obj) => {
        const isSelected = selectedIds.includes(obj.id)
        const isPending = pendingConnectorFrom === obj.id
        const color = obj.color ?? DEFAULT_FRAME_COLOR
        const frameChildren = objects.filter((o) => o.parent_id === obj.id)

        const handleFrameDragEnd = (e: Konva.KonvaEventObject<MouseEvent>) => {
          const { x: newX, y: newY } = getDragPosition(e, obj.id)
          const dx = newX - obj.x
          const dy = newY - obj.y

          // Check if this frame was dropped inside another frame (for nesting)
          const centerX = newX + obj.width / 2
          const centerY = newY + obj.height / 2
          const invalidParents = getInvalidParentIds(objects, obj.id)
          const otherFrames = objects.filter(
            (o) => o.type === 'frame' && !invalidParents.has(o.id)
          )
          const containingFrames = otherFrames.filter(
            (f) =>
              centerX >= f.x &&
              centerX <= f.x + f.width &&
              centerY >= f.y &&
              centerY <= f.y + f.height
          )
          const innermostFrame =
            containingFrames.length > 0
              ? containingFrames.reduce((a, b) => (a.width * a.height < b.width * b.height ? a : b))
              : null
          const effectiveParentId = innermostFrame?.id ?? null
          if (effectiveParentId !== (obj.parent_id ?? null)) {
            onObjectParentChange?.(obj.id, effectiveParentId)
          }

          onObjectMoved?.(obj.id, newX, newY)
          updateObject(boardId, obj.id, {
            x: newX,
            y: newY,
            parent_id: effectiveParentId,
          } as Parameters<typeof updateObject>[2]).catch((err: unknown) =>
            console.error('Failed to update frame position', err)
          )
          const allDescendants = getFrameDescendants(objects, obj.id)
          for (const desc of allDescendants) {
            const descX = desc.x + dx
            const descY = desc.y + dy
            onObjectMoved?.(desc.id, descX, descY)
            updateObject(boardId, desc.id, { x: descX, y: descY }).catch((err: unknown) =>
              console.error('Failed to update frame descendant position', err)
            )
          }
          onDragEnd?.()
        }

        const allDescendants = getFrameDescendants(objects, obj.id)
        const descendantsKey = allDescendants
          .map((d) => `${d.id}:${d.x}:${d.y}:${d.color ?? ''}:${d.text ?? ''}`)
          .join('|')
        const frameCacheKey = `${obj.id}-${obj.width}-${obj.height}-${obj.rotation ?? 0}-${color}-${isSelected}-${descendantsKey}`
        return (
          <CachedGroup key={obj.id} cacheKey={frameCacheKey}>
            <Group
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable={draggable}
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              onDragStart={(e) => {
                e.cancelBubble = true
                onDragStart?.(obj.id)
              }}
              onDragMove={(e) => {
                e.cancelBubble = true
                const { x, y } = getDragPosition(e, obj.id)
                throttleDragUpdate(obj.id, x, y)
                if (isMultiSelect && selectedIds.includes(obj.id)) {
                  onMultiDragMove?.(obj.id, x, y)
                }
              }}
            onDragEnd={(e) => {
              e.cancelBubble = true
              handleFrameDragEnd(e)
            }}
            onContextMenu={(e) => {
              e.evt.preventDefault()
              onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
            }}
            >
              {/* Frame body */}
              <Rect
                width={obj.width}
                height={obj.height}
                fill="rgba(99, 102, 241, 0.05)"
                stroke={isSelected ? '#2563eb' : isPending ? '#f59e0b' : color}
                strokeWidth={isSelected ? 4 : 2}
                cornerRadius={4}
                dash={isSelected ? [6, 4] : [8, 4]}
                {...SHADOW}
              />
            {/* Title bar — double-click to edit header */}
            <Group
              onDblClick={(e) => {
                e.cancelBubble = true
                startEditText?.(obj.id, obj.text ?? '', 'header')
              }}
              onDblTap={(e) => {
                e.cancelBubble = true
                startEditText?.(obj.id, obj.text ?? '', 'header')
              }}
            >
              <Rect
                width={obj.width}
                height={40}
                fill={color}
                opacity={0.2}
                cornerRadius={[4, 4, 0, 0]}
                listening={true}
              />
              <Text
                text={obj.text ?? ''}
                x={12}
                y={12}
                width={Math.max(0, obj.width - 24)}
                wrap="word"
                fontSize={20}
                fontStyle="bold"
                fill="#3730a3"
                lineHeight={1.25}
                listening={false}
              />
            </Group>
            {/* Body area — double-click to edit body text */}
            <Group
              y={40}
              onDblClick={(e) => {
                e.cancelBubble = true
                startEditText?.(obj.id, obj.body_text ?? '', 'body')
              }}
              onDblTap={(e) => {
                e.cancelBubble = true
                startEditText?.(obj.id, obj.body_text ?? '', 'body')
              }}
            >
              <Rect
                width={obj.width}
                height={Math.max(0, obj.height - 40)}
                fill="transparent"
                listening={true}
              />
              {(obj.body_text ?? '').length > 0 && (
                <Text
                  text={obj.body_text ?? ''}
                  x={12}
                  y={8}
                  width={Math.max(0, obj.width - 24)}
                  wrap="word"
                  fontSize={16}
                  fill="#4b5563"
                  lineHeight={1.4}
                  listening={false}
                />
              )}
            </Group>
            {/* Frame children: nested so they move with the frame */}
            {frameChildren.map((child) => {
              const relX = child.x - obj.x
              const relY = child.y - obj.y
              const isChildSelected = selectedIds.includes(child.id)
              const childSelectionStroke = isChildSelected ? '#2563eb' : undefined
              const onChildDragEnd = (e: Konva.KonvaEventObject<MouseEvent>) => {
                e.cancelBubble = true
                const { x: newRelX, y: newRelY } = getDragPosition(e, child.id)
                const worldX = obj.x + newRelX
                const worldY = obj.y + newRelY
                const centerX = worldX + child.width / 2
                const centerY = worldY + child.height / 2
                const stillInside =
                  centerX >= obj.x &&
                  centerX <= obj.x + obj.width &&
                  centerY >= obj.y &&
                  centerY <= obj.y + obj.height
                const newParentId = stillInside ? obj.id : null
                if (newParentId !== (child.parent_id ?? null)) {
                  onObjectParentChange?.(child.id, newParentId)
                }
                onObjectMoved?.(child.id, worldX, worldY)
                updateObject(
                  boardId,
                  child.id,
                  { x: worldX, y: worldY, parent_id: newParentId } as Parameters<typeof updateObject>[2]
                ).catch(
                  (err: unknown) => console.error('Failed to update frame child position', err)
                )
                onDragEnd?.()
              }
              if (child.type === 'frame') {
                const innerFrameChildren = objects.filter((o) => o.parent_id === child.id)
                const innerColor = child.color ?? DEFAULT_FRAME_COLOR
                const onInnerFrameDragEnd = (e: Konva.KonvaEventObject<MouseEvent>) => {
                  e.cancelBubble = true
                  const { x: relX, y: relY } = getDragPosition(e, child.id)
                  const newWorldX = obj.x + relX
                  const newWorldY = obj.y + relY
                  const dx = newWorldX - child.x
                  const dy = newWorldY - child.y

                  // Check if inner frame is still inside parent or moved to another frame
                  const centerX = newWorldX + child.width / 2
                  const centerY = newWorldY + child.height / 2
                  const stillInsideParent =
                    centerX >= obj.x &&
                    centerX <= obj.x + obj.width &&
                    centerY >= obj.y &&
                    centerY <= obj.y + obj.height
                  let newParentId: string | null
                  if (stillInsideParent) {
                    newParentId = obj.id
                  } else {
                    const invalidParents = getInvalidParentIds(objects, child.id)
                    const otherFrames = objects.filter(
                      (o) => o.type === 'frame' && o.id !== obj.id && !invalidParents.has(o.id)
                    )
                    const containingFrames = otherFrames.filter(
                      (f) =>
                        centerX >= f.x &&
                        centerX <= f.x + f.width &&
                        centerY >= f.y &&
                        centerY <= f.y + f.height
                    )
                    newParentId =
                      containingFrames.length > 0
                        ? containingFrames.reduce((a, b) =>
                            a.width * a.height < b.width * b.height ? a : b
                          ).id
                        : null
                  }
                  if (newParentId !== (child.parent_id ?? null)) {
                    onObjectParentChange?.(child.id, newParentId)
                  }

                  onObjectMoved?.(child.id, newWorldX, newWorldY)
                  updateObject(
                    boardId,
                    child.id,
                    { x: newWorldX, y: newWorldY, parent_id: newParentId } as Parameters<
                      typeof updateObject
                    >[2]
                  ).catch((err: unknown) =>
                    console.error('Failed to update inner frame position', err)
                  )
                  const innerDescendants = getFrameDescendants(objects, child.id)
                  for (const desc of innerDescendants) {
                    const descX = desc.x + dx
                    const descY = desc.y + dy
                    onObjectMoved?.(desc.id, descX, descY)
                    updateObject(boardId, desc.id, { x: descX, y: descY }).catch((err: unknown) =>
                      console.error('Failed to update inner frame descendant position', err)
                    )
                  }
                  onDragEnd?.()
                }
                return (
                  <Group
                    key={child.id}
                    id={child.id}
                    x={relX}
                    y={relY}
                    rotation={child.rotation ?? 0}
                    draggable={draggable}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, e.evt.shiftKey)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, false)
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      onDragStart?.(child.id)
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true
                      const { x: rx, y: ry } = getDragPosition(e, child.id)
                      throttleDragUpdate(child.id, obj.x + rx, obj.y + ry, true)
                    }}
                    onDragEnd={onInnerFrameDragEnd}
                  >
                    <Rect
                      width={child.width}
                      height={child.height}
                      fill="rgba(99, 102, 241, 0.05)"
                      stroke={isChildSelected ? '#2563eb' : innerColor}
                      strokeWidth={isChildSelected ? 3 : 2}
                      cornerRadius={4}
                      dash={[8, 4]}
                    />
                    <Group
                      onDblClick={(e) => {
                        e.cancelBubble = true
                        startEditText?.(child.id, child.text ?? '', 'header')
                      }}
                      onDblTap={(e) => {
                        e.cancelBubble = true
                        startEditText?.(child.id, child.text ?? '', 'header')
                      }}
                    >
                      <Rect
                        width={child.width}
                        height={40}
                        fill={innerColor}
                        opacity={0.2}
                        cornerRadius={[4, 4, 0, 0]}
                        listening={true}
                      />
                      <Text
                        text={child.text ?? ''}
                        x={12}
                        y={12}
                        width={Math.max(0, child.width - 24)}
                        wrap="word"
                        fontSize={20}
                        fontStyle="bold"
                        fill="#3730a3"
                        lineHeight={1.25}
                        listening={false}
                      />
                    </Group>
                    <Group
                      y={40}
                      onDblClick={(e) => {
                        e.cancelBubble = true
                        startEditText?.(child.id, child.body_text ?? '', 'body')
                      }}
                      onDblTap={(e) => {
                        e.cancelBubble = true
                        startEditText?.(child.id, child.body_text ?? '', 'body')
                      }}
                    >
                      <Rect
                        width={child.width}
                        height={Math.max(0, child.height - 40)}
                        fill="transparent"
                        listening={true}
                      />
                      {(child.body_text ?? '').length > 0 && (
                        <Text
                          text={child.body_text ?? ''}
                          x={12}
                          y={8}
                          width={Math.max(0, child.width - 24)}
                          wrap="word"
                          fontSize={16}
                          fill="#4b5563"
                          lineHeight={1.4}
                          listening={false}
                        />
                      )}
                    </Group>
                    {innerFrameChildren.map((grandchild) => {
                      const gRelX = grandchild.x - child.x
                      const gRelY = grandchild.y - child.y
                      const onGrandchildDragEnd = (ev: Konva.KonvaEventObject<MouseEvent>) => {
                        ev.cancelBubble = true
                        const { x: gRelX, y: gRelY } = getDragPosition(ev, grandchild.id)
                        const worldX = child.x + gRelX
                        const worldY = child.y + gRelY
                        const centerX = worldX + grandchild.width / 2
                        const centerY = worldY + grandchild.height / 2
                        const stillInside =
                          centerX >= child.x &&
                          centerX <= child.x + child.width &&
                          centerY >= child.y &&
                          centerY <= child.y + child.height
                        let newParentId: string | null
                        if (stillInside) {
                          newParentId = child.id
                        } else {
                          const invalidParents =
                            grandchild.type === 'frame'
                              ? getInvalidParentIds(objects, grandchild.id)
                              : new Set<string>()
                          const containingFrames = objects
                            .filter((o) => o.type === 'frame' && !invalidParents.has(o.id))
                            .filter(
                              (f) =>
                                centerX >= f.x &&
                                centerX <= f.x + f.width &&
                                centerY >= f.y &&
                                centerY <= f.y + f.height
                            )
                          newParentId =
                            containingFrames.length > 0
                              ? containingFrames.reduce((a, b) =>
                                  a.width * a.height < b.width * b.height ? a : b
                                ).id
                              : null
                        }
                        if (newParentId !== (grandchild.parent_id ?? null)) {
                          onObjectParentChange?.(grandchild.id, newParentId)
                        }
                        onObjectMoved?.(grandchild.id, worldX, worldY)
                        updateObject(
                          boardId,
                          grandchild.id,
                          { x: worldX, y: worldY, parent_id: newParentId } as Parameters<typeof updateObject>[2]
                        ).catch((err: unknown) =>
                          console.error('Failed to update grandchild position', err)
                        )
                        onDragEnd?.()
                      }
                      if (grandchild.type === 'frame') {
                        const grandChildren = objects.filter((o) => o.parent_id === grandchild.id)
                        const gcColor = grandchild.color ?? DEFAULT_FRAME_COLOR
                        const onGrandchildFrameDragEnd = (ev: Konva.KonvaEventObject<MouseEvent>) => {
                          ev.cancelBubble = true
                          const { x: gRelX, y: gRelY } = getDragPosition(ev, grandchild.id)
                          const nwx = child.x + gRelX
                          const nwy = child.y + gRelY
                          const ddx = nwx - grandchild.x
                          const ddy = nwy - grandchild.y

                          // Check if grandchild frame is still inside parent or moved
                          const centerX = nwx + grandchild.width / 2
                          const centerY = nwy + grandchild.height / 2
                          const stillInsideParent =
                            centerX >= child.x &&
                            centerX <= child.x + child.width &&
                            centerY >= child.y &&
                            centerY <= child.y + child.height
                          let gcNewParentId: string | null
                          if (stillInsideParent) {
                            gcNewParentId = child.id
                          } else {
                            const invalidParents = getInvalidParentIds(objects, grandchild.id)
                            const otherFrames = objects.filter(
                              (o) =>
                                o.type === 'frame' &&
                                o.id !== child.id &&
                                !invalidParents.has(o.id)
                            )
                            const containingFrames = otherFrames.filter(
                              (f) =>
                                centerX >= f.x &&
                                centerX <= f.x + f.width &&
                                centerY >= f.y &&
                                centerY <= f.y + f.height
                            )
                            gcNewParentId =
                              containingFrames.length > 0
                                ? containingFrames.reduce((a, b) =>
                                    a.width * a.height < b.width * b.height ? a : b
                                  ).id
                                : null
                          }
                          if (gcNewParentId !== (grandchild.parent_id ?? null)) {
                            onObjectParentChange?.(grandchild.id, gcNewParentId)
                          }

                          onObjectMoved?.(grandchild.id, nwx, nwy)
                          updateObject(
                            boardId,
                            grandchild.id,
                            { x: nwx, y: nwy, parent_id: gcNewParentId } as Parameters<
                              typeof updateObject
                            >[2]
                          ).catch((err: unknown) =>
                            console.error('Failed to update grandchild frame position', err)
                          )
                          getFrameDescendants(objects, grandchild.id).forEach((d) => {
                            onObjectMoved?.(d.id, d.x + ddx, d.y + ddy)
                            updateObject(boardId, d.id, { x: d.x + ddx, y: d.y + ddy }).catch(
                              (err: unknown) =>
                                console.error('Failed to update grandchild frame descendant position', err)
                            )
                          })
                          onDragEnd?.()
                        }
                        return (
                          <Group
                            key={grandchild.id}
                            id={grandchild.id}
                            x={gRelX}
                            y={gRelY}
                            draggable={draggable}
                            onClick={(e) => {
                              e.cancelBubble = true
                              onObjectClick(grandchild.id, e.evt.shiftKey)
                            }}
                            onTap={(e) => {
                              e.cancelBubble = true
                              onObjectClick(grandchild.id, false)
                            }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      onDragStart?.(grandchild.id)
                    }}
                            onDragMove={(e) => {
                              e.cancelBubble = true
                              const { x: rx, y: ry } = getDragPosition(e, grandchild.id)
                              throttleDragUpdate(grandchild.id, child.x + rx, child.y + ry, true)
                            }}
                            onDragEnd={onGrandchildFrameDragEnd}
                          >
                            <Rect
                              width={grandchild.width}
                              height={grandchild.height}
                              fill="rgba(99, 102, 241, 0.05)"
                              stroke={grandchild.color ?? DEFAULT_FRAME_COLOR}
                              strokeWidth={2}
                              cornerRadius={4}
                              dash={[8, 4]}
                            />
                            <Rect
                              width={grandchild.width}
                              height={40}
                              fill={gcColor}
                              opacity={0.2}
                              cornerRadius={[4, 4, 0, 0]}
                              listening={false}
                            />
                            <Text
                              text={grandchild.text ?? ''}
                              x={12}
                              y={12}
                              width={Math.max(0, grandchild.width - 24)}
                              wrap="word"
                              fontSize={20}
                              fontStyle="bold"
                              fill="#3730a3"
                              listening={false}
                            />
                            {(grandchild.body_text ?? '').length > 0 && (
                              <Text
                                text={grandchild.body_text ?? ''}
                                x={12}
                                y={48}
                                width={Math.max(0, grandchild.width - 24)}
                                wrap="word"
                                fontSize={16}
                                fill="#4b5563"
                                listening={false}
                              />
                            )}
                            {grandChildren.map((gg) => (
                              <Group
                                key={gg.id}
                                id={gg.id}
                                x={gg.x - grandchild.x}
                                y={gg.y - grandchild.y}
                                onClick={(e) => {
                                  e.cancelBubble = true
                                  onObjectClick(gg.id, e.evt.shiftKey)
                                }}
                                onTap={(e) => {
                                  e.cancelBubble = true
                                  onObjectClick(gg.id, false)
                                }}
                              >
                                {gg.type === 'sticky' && (() => {
                                  const { text: ggText, isWatermark: ggWm } = getDisplayText(gg.text)
                                  return (
                                    <>
                                      <Rect
                                        width={gg.width}
                                        height={gg.height}
                                        fill={gg.color ?? DEFAULT_STICKY_COLOR}
                                        cornerRadius={8}
                                      />
                                      <Text
                                        text={ggText}
                                        width={gg.width - 16}
                                        height={gg.height - 16}
                                        x={8}
                                        y={8}
                                        fontSize={textFontSize(gg)}
                                        fill={ggWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                                        fontStyle={ggWm ? 'italic' : 'normal'}
                                        listening={false}
                                        wrap="word"
                                        align="center"
                                        verticalAlign="middle"
                                      />
                                    </>
                                  )
                                })()}
                                {(gg.type === 'rect' || !gg.type) && (() => {
                                  const { text: ggText, isWatermark: ggWm } = getDisplayText(gg.text)
                                  return (
                                    <>
                                      <Rect
                                        width={gg.width}
                                        height={gg.height}
                                        fill={gg.color ?? DEFAULT_SHAPE_COLOR}
                                      />
                                      <Text
                                        text={ggText}
                                        width={gg.width - 16}
                                        height={gg.height - 16}
                                        x={8}
                                        y={8}
                                        fontSize={textFontSize(gg)}
                                        fill={ggWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                                        fontStyle={ggWm ? 'italic' : 'normal'}
                                        listening={false}
                                        wrap="word"
                                        align="center"
                                        verticalAlign="middle"
                                      />
                                    </>
                                  )
                                })()}
                              </Group>
                            ))}
                          </Group>
                        )
                      }
                      if (grandchild.type === 'sticky') {
                        const c = grandchild.color ?? DEFAULT_STICKY_COLOR
                        return (
                          <Group
                            key={grandchild.id}
                            id={grandchild.id}
                            x={gRelX}
                            y={gRelY}
                            draggable={draggable}
                            onClick={(e) => {
                              e.cancelBubble = true
                              onObjectClick(grandchild.id, e.evt.shiftKey)
                            }}
                            onTap={(e) => {
                              e.cancelBubble = true
                              onObjectClick(grandchild.id, false)
                            }}
                            onDragStart={(e) => {
                              e.cancelBubble = true
                              onDragStart?.(grandchild.id)
                            }}
                            onDragMove={(e) => {
                              e.cancelBubble = true
                              const { x: rx, y: ry } = getDragPosition(e, grandchild.id)
                              throttleDragUpdate(grandchild.id, child.x + rx, child.y + ry)
                            }}
                            onDragEnd={onGrandchildDragEnd}
                          >
                            <Rect
                              width={grandchild.width}
                              height={grandchild.height}
                              fill={c}
                              cornerRadius={8}
                            />
                            {(() => {
                              const { text: gcText, isWatermark: gcWm } = getDisplayText(grandchild.text)
                              return (
                                <Text
                                  text={gcText}
                                  width={grandchild.width - 16}
                                  height={grandchild.height - 16}
                                  x={8}
                                  y={8}
                                  fontSize={textFontSize(grandchild)}
                                  fill={gcWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                                  fontStyle={gcWm ? 'italic' : 'normal'}
                                  listening={false}
                                  wrap="word"
                                  align="center"
                                  verticalAlign="middle"
                                />
                              )
                            })()}
                          </Group>
                        )
                      }
                      const c = grandchild.color ?? DEFAULT_SHAPE_COLOR
                      return (
                        <Group
                          key={grandchild.id}
                          id={grandchild.id}
                          x={gRelX}
                          y={gRelY}
                          draggable={draggable}
                          onClick={(e) => {
                            e.cancelBubble = true
                            onObjectClick(grandchild.id, e.evt.shiftKey)
                          }}
                          onTap={(e) => {
                            e.cancelBubble = true
                            onObjectClick(grandchild.id, false)
                          }}
                          onDragStart={(e) => {
                            e.cancelBubble = true
                            onDragStart?.(grandchild.id)
                          }}
                          onDragMove={(e) => {
                            e.cancelBubble = true
                            const { x: rx, y: ry } = getDragPosition(e, grandchild.id)
                            throttleDragUpdate(grandchild.id, child.x + rx, child.y + ry)
                          }}
                          onDragEnd={onGrandchildDragEnd}
                        >
                          <Rect
                            width={grandchild.width}
                            height={grandchild.height}
                            fill={c}
                          />
                          {(() => {
                            const { text: gcText, isWatermark: gcWm } = getDisplayText(grandchild.text)
                            return (
                              <Text
                                text={gcText}
                                width={grandchild.width - 16}
                                height={grandchild.height - 16}
                                x={8}
                                y={8}
                                fontSize={textFontSize(grandchild)}
                                fill={gcWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                                fontStyle={gcWm ? 'italic' : 'normal'}
                                listening={false}
                                wrap="word"
                                align="center"
                                verticalAlign="middle"
                              />
                            )
                          })()}
                        </Group>
                      )
                    })}
                  </Group>
                )
              }
              if (child.type === 'sticky') {
                const c = child.color ?? DEFAULT_STICKY_COLOR
                return (
                  <Group
                    key={child.id}
                    id={child.id}
                    x={relX}
                    y={relY}
                    rotation={child.rotation ?? 0}
                    draggable={draggable}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, e.evt.shiftKey)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, false)
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      onDragStart?.(child.id)
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true
                      const { x: rx, y: ry } = getDragPosition(e, child.id)
                      throttleDragUpdate(child.id, obj.x + rx, obj.y + ry)
                    }}
                    onDragEnd={onChildDragEnd}
                    onDblClick={(e) => {
                      e.cancelBubble = true
                      startEditText?.(child.id, child.text ?? '')
                    }}
                    onDblTap={(e) => {
                      e.cancelBubble = true
                      startEditText?.(child.id, child.text ?? '')
                    }}
                  >
                    <Rect
                      width={child.width}
                      height={child.height}
                      fill={c}
                      cornerRadius={8}
                      stroke={childSelectionStroke ?? 'transparent'}
                      strokeWidth={childSelectionStroke ? 3 : 0}
                    />
                    {(() => {
                      const { text: chText, isWatermark: chWm } = getDisplayText(child.text)
                      return (
                        <Text
                          text={chText}
                          width={child.width - 16}
                          height={child.height - 16}
                          x={8}
                          y={8}
                          fontSize={textFontSize(child)}
                          fill={chWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                          fontStyle={chWm ? 'italic' : 'normal'}
                          listening={false}
                          wrap="word"
                          align="center"
                          verticalAlign="middle"
                        />
                      )
                    })()}
                  </Group>
                )
              }
              if (child.type === 'circle') {
                const c = child.color ?? DEFAULT_SHAPE_COLOR
                const d = Math.min(child.width, child.height)
                const r = Math.max(MIN_OBJECT_SIZE, d) / 2
                const clipPath = (): [Path2D] => {
                  const p = new Path2D()
                  p.arc(r, r, r, 0, Math.PI * 2)
                  return [p]
                }
                return (
                  <Group
                    key={child.id}
                    id={child.id}
                    x={relX}
                    y={relY}
                    rotation={child.rotation ?? 0}
                    draggable={draggable}
                    clipFunc={clipPath}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, e.evt.shiftKey)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, false)
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      onDragStart?.(child.id)
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true
                      const { x: rx, y: ry } = getDragPosition(e, child.id)
                      throttleDragUpdate(child.id, obj.x + rx, obj.y + ry)
                    }}
                    onDragEnd={onChildDragEnd}
                    onDblClick={(e) => {
                      e.cancelBubble = true
                      startEditText?.(child.id, child.text ?? '')
                    }}
                    onDblTap={(e) => {
                      e.cancelBubble = true
                      startEditText?.(child.id, child.text ?? '')
                    }}
                  >
                    <Circle
                      x={r}
                      y={r}
                      radius={r}
                      fill={c}
                      stroke={childSelectionStroke ?? '#333'}
                      strokeWidth={childSelectionStroke ? 3 : 2}
                    />
                    {(() => {
                      const { text: chText, isWatermark: chWm } = getDisplayText(child.text)
                      return (
                        <Text
                          text={chText}
                          width={d - 12}
                          height={d - 12}
                          x={6}
                          y={6}
                          fontSize={textFontSize({ ...child, width: d, height: d })}
                          fill={chWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                          fontStyle={chWm ? 'italic' : 'normal'}
                          listening={false}
                          wrap="word"
                          align="center"
                          verticalAlign="middle"
                        />
                      )
                    })()}
                  </Group>
                )
              }
              if (child.type === 'line') {
                const c = child.color ?? DEFAULT_SHAPE_COLOR
                return (
                  <Group
                    key={child.id}
                    id={child.id}
                    x={relX}
                    y={relY}
                    rotation={child.rotation ?? 0}
                    draggable={draggable}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, e.evt.shiftKey)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, false)
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      onDragStart?.(child.id)
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true
                      const { x: rx, y: ry } = getDragPosition(e, child.id)
                      throttleDragUpdate(child.id, obj.x + rx, obj.y + ry)
                    }}
                    onDragEnd={onChildDragEnd}
                  >
                    <Line
                      points={[0, 0, child.width, child.height]}
                      stroke={childSelectionStroke ?? c}
                      strokeWidth={isChildSelected ? 8 : 6}
                      hitStrokeWidth={20}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                )
              }
              if (child.type === 'text') {
                const fs = child.font_size ?? TEXT_DEFAULT_FONT_SIZE
                const fc = child.font_color ?? DEFAULT_TEXT_COLOR
                return (
                  <Group
                    key={child.id}
                    id={child.id}
                    x={relX}
                    y={relY}
                    rotation={child.rotation ?? 0}
                    draggable={draggable}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, e.evt.shiftKey)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      onObjectClick(child.id, false)
                    }}
                    onDragStart={(e) => {
                      e.cancelBubble = true
                      onDragStart?.(child.id)
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true
                      const { x: rx, y: ry } = getDragPosition(e, child.id)
                      throttleDragUpdate(child.id, obj.x + rx, obj.y + ry)
                    }}
                    onDragEnd={onChildDragEnd}
                    onDblClick={(e) => {
                      e.cancelBubble = true
                      startEditText?.(child.id, child.text ?? '')
                    }}
                    onDblTap={(e) => {
                      e.cancelBubble = true
                      startEditText?.(child.id, child.text ?? '')
                    }}
                  >
                    {isChildSelected && (
                      <Rect
                        x={-4}
                        y={-4}
                        width={child.width + 8}
                        height={child.height + 8}
                        fill="transparent"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dash={[4, 3]}
                        cornerRadius={4}
                        listening={false}
                      />
                    )}
                    {(() => {
                      const { text: chText, isWatermark: chWm } = getDisplayText(child.text)
                      return (
                        <Text
                          text={chText}
                          width={child.width}
                          height={child.height}
                          fontSize={fs}
                          fill={chWm ? WATERMARK_FILL : fc}
                          fontStyle={chWm ? 'italic' : 'normal'}
                          wrap="word"
                          align="left"
                          verticalAlign="top"
                        />
                      )
                    })()}
                  </Group>
                )
              }
              // rect
              const c = child.color ?? DEFAULT_SHAPE_COLOR
              return (
                <Group
                  key={child.id}
                  id={child.id}
                  x={relX}
                  y={relY}
                  rotation={child.rotation ?? 0}
                  draggable={draggable}
                  onClick={(e) => {
                    e.cancelBubble = true
                    onObjectClick(child.id, e.evt.shiftKey)
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true
                    onObjectClick(child.id, false)
                  }}
                  onDragStart={(e) => {
                    e.cancelBubble = true
                    onDragStart?.(child.id)
                  }}
                  onDragMove={(e) => {
                    e.cancelBubble = true
                    const { x: rx, y: ry } = getDragPosition(e, child.id)
                    throttleDragUpdate(child.id, obj.x + rx, obj.y + ry)
                  }}
                  onDragEnd={onChildDragEnd}
                  onDblClick={(e) => {
                    e.cancelBubble = true
                    startEditText?.(child.id, child.text ?? '')
                  }}
                  onDblTap={(e) => {
                    e.cancelBubble = true
                    startEditText?.(child.id, child.text ?? '')
                  }}
                >
                  <Rect
                    width={child.width}
                    height={child.height}
                    fill={c}
                    stroke={childSelectionStroke ?? '#333'}
                    strokeWidth={childSelectionStroke ? 3 : 2}
                  />
                  {(() => {
                    const { text: chText, isWatermark: chWm } = getDisplayText(child.text)
                    return (
                      <Text
                        text={chText}
                        width={child.width - 16}
                        height={child.height - 16}
                        x={8}
                        y={8}
                        fontSize={textFontSize(child)}
                        fill={chWm ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                        fontStyle={chWm ? 'italic' : 'normal'}
                        listening={false}
                        wrap="word"
                        align="center"
                        verticalAlign="middle"
                      />
                    )
                  })()}
                </Group>
              )
            })}
            </Group>
          </CachedGroup>
        )
      })}

      {/* Non-frame, non-connector objects (excluding frame children) */}
      {nonFrames.map((obj) => {
        const isSelected = selectedIds.includes(obj.id)
        const isPending = pendingConnectorFrom === obj.id
        const selectionStroke = isSelected ? '#2563eb' : isPending ? '#f59e0b' : undefined

        if (obj.type === 'sticky') {
          const color = obj.color ?? DEFAULT_STICKY_COLOR
          const cacheKey = `${obj.id}-${obj.width}-${obj.height}-${obj.rotation ?? 0}-${color}-${isSelected}`
          return (
            <CachedGroup key={obj.id} cacheKey={cacheKey}>
              <Group
                id={obj.id}
                x={obj.x}
                y={obj.y}
                rotation={obj.rotation ?? 0}
                draggable={draggable}
                onClick={(e) => {
                  e.cancelBubble = true
                  onObjectClick(obj.id, e.evt.shiftKey)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onObjectClick(obj.id, false)
                }}
                {...makeDragHandlers(obj)}
                onDblClick={(e) => {
                  e.cancelBubble = true
                  startEditText?.(obj.id, obj.text ?? '')
                }}
                onDblTap={(e) => {
                  e.cancelBubble = true
                  startEditText?.(obj.id, obj.text ?? '')
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault()
                  onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
                }}
              >
                <Rect
                  width={obj.width}
                  height={obj.height}
                  fill={color}
                  cornerRadius={8}
                  stroke={selectionStroke ?? 'transparent'}
                  strokeWidth={selectionStroke ? 4 : 0}
                  dash={selectionStroke ? [6, 4] : undefined}
                  {...SHADOW}
                />
              {(() => {
                const { text: dispText, isWatermark } = getDisplayText(obj.text)
                return (
                  <Text
                    text={dispText}
                    width={obj.width - 16}
                    height={obj.height - 16}
                    x={8}
                    y={8}
                    fontSize={textFontSize(obj)}
                    fill={isWatermark ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                    fontStyle={isWatermark ? 'italic' : 'normal'}
                    listening={false}
                    wrap="word"
                    align="center"
                    verticalAlign="middle"
                  />
                )
              })()}
              </Group>
            </CachedGroup>
          )
        }

        if (obj.type === 'circle') {
          const color = obj.color ?? DEFAULT_SHAPE_COLOR
          const rawSize = Math.min(obj.width, obj.height)
          const diameter = Number.isFinite(rawSize) && rawSize > 0 ? Math.max(MIN_OBJECT_SIZE, rawSize) : MIN_OBJECT_SIZE
          const radius = diameter / 2
          const clipPath = (): [Path2D] => {
            const p = new Path2D()
            p.arc(radius, radius, radius, 0, Math.PI * 2)
            return [p]
          }
          const cacheKey = `${obj.id}-${diameter}-${obj.rotation ?? 0}-${color}-${isSelected}`
          return (
            <CachedGroup key={obj.id} cacheKey={cacheKey}>
              <Group
                id={obj.id}
                x={obj.x}
                y={obj.y}
                rotation={obj.rotation ?? 0}
                draggable={draggable}
                clipFunc={clipPath}
                onClick={(e) => {
                  e.cancelBubble = true
                  onObjectClick(obj.id, e.evt.shiftKey)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onObjectClick(obj.id, false)
                }}
                {...makeDragHandlers(obj)}
                onDblClick={(e) => {
                  e.cancelBubble = true
                  startEditText?.(obj.id, obj.text ?? '')
                }}
                onDblTap={(e) => {
                  e.cancelBubble = true
                  startEditText?.(obj.id, obj.text ?? '')
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault()
                  onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
                }}
              >
                <Circle
                  x={radius}
                  y={radius}
                  radius={radius}
                  fill={color}
                  stroke={selectionStroke ?? '#333'}
                  strokeWidth={selectionStroke ? 4 : 2}
                  dash={selectionStroke ? [6, 4] : undefined}
                  {...SHADOW}
                />
              {(() => {
                const { text: dispText, isWatermark } = getDisplayText(obj.text)
                return (
                  <Text
                    text={dispText}
                    width={diameter - 12}
                    height={diameter - 12}
                    x={6}
                    y={6}
                    fontSize={textFontSize({ ...obj, width: diameter, height: diameter })}
                    fill={isWatermark ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                    fontStyle={isWatermark ? 'italic' : 'normal'}
                    listening={false}
                    wrap="word"
                    align="center"
                    verticalAlign="middle"
                  />
                )
              })()}
              </Group>
            </CachedGroup>
          )
        }

        if (obj.type === 'line') {
          const color = obj.color ?? DEFAULT_SHAPE_COLOR
          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable={draggable}
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              {...makeDragHandlers(obj)}
              onContextMenu={(e) => {
                e.evt.preventDefault()
                onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
              }}
            >
              <Line
                points={[0, 0, obj.width, obj.height]}
                stroke={selectionStroke ?? color}
                strokeWidth={isSelected ? 8 : 6}
                hitStrokeWidth={20}
                lineCap="round"
                lineJoin="round"
              />
            </Group>
          )
        }

        if (obj.type === 'text') {
          const fontSize = obj.font_size ?? TEXT_DEFAULT_FONT_SIZE
          const fontColor = obj.font_color ?? DEFAULT_TEXT_COLOR
          const cacheKey = `${obj.id}-${obj.width}-${obj.height}-${obj.rotation ?? 0}-${fontColor}-${isSelected}`
          return (
            <CachedGroup key={obj.id} cacheKey={cacheKey}>
              <Group
                id={obj.id}
                x={obj.x}
                y={obj.y}
                rotation={obj.rotation ?? 0}
                draggable={draggable}
                onClick={(e) => {
                  e.cancelBubble = true
                  onObjectClick(obj.id, e.evt.shiftKey)
                }}
                onTap={(e) => {
                  e.cancelBubble = true
                  onObjectClick(obj.id, false)
                }}
                {...makeDragHandlers(obj)}
                onDblClick={(e) => {
                  e.cancelBubble = true
                  startEditText?.(obj.id, obj.text ?? '')
                }}
                onDblTap={(e) => {
                  e.cancelBubble = true
                  startEditText?.(obj.id, obj.text ?? '')
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault()
                  onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
                }}
              >
                {isSelected && (
                  <Rect
                    x={-4}
                    y={-4}
                    width={obj.width + 8}
                    height={obj.height + 8}
                    fill="transparent"
                    stroke="#2563eb"
                    strokeWidth={4}
                    dash={[6, 4]}
                    cornerRadius={4}
                    listening={false}
                  />
                )}
                <Rect
                  x={0}
                  y={0}
                  width={obj.width}
                  height={obj.height}
                  fill="transparent"
                  listening={false}
                  {...SHADOW}
                />
                {(() => {
                  const { text: dispText, isWatermark } = getDisplayText(obj.text)
                  return (
                    <Text
                      text={dispText}
                      width={obj.width}
                      height={obj.height}
                      fontSize={fontSize}
                      fill={isWatermark ? WATERMARK_FILL : fontColor}
                      fontStyle={isWatermark ? 'italic' : 'normal'}
                      wrap="word"
                      align="left"
                      verticalAlign="top"
                    />
                  )
                })()}
              </Group>
            </CachedGroup>
          )
        }

        // Default: rect
        const color = obj.color ?? DEFAULT_SHAPE_COLOR
        const cacheKey = `${obj.id}-${obj.width}-${obj.height}-${obj.rotation ?? 0}-${color}-${isSelected}`
        return (
          <CachedGroup key={obj.id} cacheKey={cacheKey}>
            <Group
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable={draggable}
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              {...makeDragHandlers(obj)}
              onDblClick={(e) => {
                e.cancelBubble = true
                startEditText?.(obj.id, obj.text ?? '')
              }}
              onDblTap={(e) => {
                e.cancelBubble = true
                startEditText?.(obj.id, obj.text ?? '')
              }}
              onContextMenu={(e) => {
                e.evt.preventDefault()
                onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
              }}
            >
              <Rect
                width={obj.width}
                height={obj.height}
                fill={color}
                stroke={selectionStroke ?? '#333'}
                strokeWidth={selectionStroke ? 4 : 2}
                dash={selectionStroke ? [6, 4] : undefined}
                {...SHADOW}
              />
            {(() => {
              const { text: dispText, isWatermark } = getDisplayText(obj.text)
              return (
                <Text
                  text={dispText}
                  width={obj.width - 16}
                  height={obj.height - 16}
                  x={8}
                  y={8}
                  fontSize={textFontSize(obj)}
                  fill={isWatermark ? WATERMARK_FILL : DEFAULT_TEXT_FILL}
                  fontStyle={isWatermark ? 'italic' : 'normal'}
                  listening={false}
                  wrap="word"
                  align="center"
                  verticalAlign="middle"
                />
              )
            })()}
              </Group>
            </CachedGroup>
        )
      })}

      {/* Connectors: rendered on top, endpoints touch shape edges. Draggable when selected. */}
      {connectors.map((obj) => {
        const fromObj = objects.find((o) => o.id === obj.from_id)
        const toObj = objects.find((o) => o.id === obj.to_id)
        if (!fromObj || !toObj) return null

        const fromCenter = { x: fromObj.x + fromObj.width / 2, y: fromObj.y + fromObj.height / 2 }
        const toCenter = { x: toObj.x + toObj.width / 2, y: toObj.y + toObj.height / 2 }

        const computedFrom =
          fromObj.type === 'circle'
            ? lineCircleExit(
                fromCenter,
                Math.min(fromObj.width, fromObj.height) / 2,
                toCenter.x,
                toCenter.y
              )
            : lineRectExit(
                { x: fromObj.x, y: fromObj.y, width: fromObj.width, height: fromObj.height },
                fromCenter.x,
                fromCenter.y,
                toCenter.x,
                toCenter.y
              )
        const computedTo =
          toObj.type === 'circle'
            ? lineCircleExit(
                toCenter,
                Math.min(toObj.width, toObj.height) / 2,
                fromCenter.x,
                fromCenter.y
              )
            : lineRectExit(
                { x: toObj.x, y: toObj.y, width: toObj.width, height: toObj.height },
                toCenter.x,
                toCenter.y,
                fromCenter.x,
                fromCenter.y
              )

        const fromX = obj.from_x ?? computedFrom.x
        const fromY = obj.from_y ?? computedFrom.y
        const toX = obj.to_x ?? computedTo.x
        const toY = obj.to_y ?? computedTo.y
        const width = toX - fromX
        const height = toY - fromY
        const isSelected = selectedIds.includes(obj.id)
        const strokeColor = obj.color ?? DEFAULT_CONNECTOR_COLOR
        const isArrow = obj.style === 'arrow'
        const isDashed = obj.style === 'dashed'
        const isDotted = obj.style === 'dotted'

        const linePoints: [number, number, number, number] = [0, 0, width, height]
        const sharedLineProps = {
          points: linePoints,
          stroke: isSelected ? '#2563eb' : strokeColor,
          strokeWidth: isSelected ? 10 : 8,
          hitStrokeWidth: 40,
          lineCap: 'round' as const,
          listening: true,
          ...(isDashed && { dash: [10, 12] }),
          ...(isDotted && { dash: [0, 14] }),
        }

        return (
          <Group
            key={obj.id}
            id={obj.id}
            x={fromX}
            y={fromY}
            draggable={draggable}
            onClick={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, e.evt.shiftKey)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, false)
            }}
            onDragStart={() => onDragStart?.(obj.id)}
            onDragEnd={(e) => {
              const node = e.target
              const newFromX = node.x()
              const newFromY = node.y()
              onConnectorMoved?.(obj.id, newFromX, newFromY, newFromX + width, newFromY + height)
              onDragEnd?.()
            }}
            onContextMenu={(e) => {
              e.evt.preventDefault()
              onObjectContextMenu?.(obj.id, e.evt.clientX, e.evt.clientY)
            }}
          >
            {isArrow ? (
              <Arrow
                {...sharedLineProps}
                fill={isSelected ? '#2563eb' : strokeColor}
                pointerLength={14}
                pointerWidth={12}
                pointerAtEnding
              />
            ) : (
              <Line {...sharedLineProps} />
            )}
          </Group>
        )
      })}
    </>
  )
}

export default memo(BoardObjects)
