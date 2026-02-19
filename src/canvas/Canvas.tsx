import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import type { AppUser } from '../types/user'
import type { Tool } from '../board/Toolbar'
import {
  STICKY_WIDTH,
  STICKY_HEIGHT,
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_TEXT_COLOR,
  CIRCLE_DIAMETER,
  LINE_DEFAULT_WIDTH,
  LINE_DEFAULT_HEIGHT,
  FRAME_DEFAULT_WIDTH,
  FRAME_DEFAULT_HEIGHT,
  TEXT_DEFAULT_FONT_SIZE,
  HEARTBEAT_MS,
} from '../constants'
import {
  setMyCursor,
  removeMyCursor,
  subscribeCursors,
  setupCursorOnDisconnect,
  cursorColorFromUid,
} from '../supabase/cursors'
import { addObject } from '../supabase/objects'
import type { BoardObject } from '../types/board'
import OtherCursors from './OtherCursors'
import BoardObjects from './BoardObjects'

type CanvasProps = {
  boardId: string
  user: AppUser
  activeTool: Tool
  onPresenceChange?: (names: string[]) => void
  objects: BoardObject[]
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onStartEditText?: (id: string, text: string) => void
  editingObject?: BoardObject | null
  editingText?: string
  onEditingTextChange?: (text: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onOptimisticAdd?: (obj: BoardObject) => void
  onAddFailed?: (id: string, err: unknown) => void
  onObjectMoved?: (id: string, x: number, y: number) => void
  onObjectResized?: (id: string, payload: { x: number; y: number; width: number; height: number; rotation?: number }) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  onAfterCreateObject?: () => void
  onBroadcastDragMove?: (id: string, x: number, y: number) => void
  onMultiDragMove?: (movedId: string, deltaX: number, deltaY: number) => void
  onConnectorCreated?: (fromId: string, toId: string) => void
}

export default function Canvas({
  boardId,
  user,
  activeTool,
  onPresenceChange,
  objects,
  selectedIds,
  onSelect,
  onStartEditText,
  editingObject,
  editingText = '',
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
  onOptimisticAdd,
  onAddFailed,
  onObjectMoved,
  onObjectResized,
  onDragStart,
  onDragEnd,
  onAfterCreateObject,
  onBroadcastDragMove,
  onMultiDragMove,
  onConnectorCreated,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const lastCursorRef = useRef<number>(0)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)
  const posRef = useRef(stagePos)
  const scaleRef = useRef(stageScale)
  const [otherCursors, setOtherCursors] = useState<
    Record<string, { uid: string; x: number; y: number; displayName: string | null; color: string }>
  >({})

  posRef.current = stagePos
  scaleRef.current = stageScale

  // Drag-to-select state
  const [selectionRect, setSelectionRect] = useState<{
    x: number; y: number; width: number; height: number
  } | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const isSelectingRef = useRef(false)

  // Connector tool: pending first object click
  const [pendingConnectorFrom, setPendingConnectorFrom] = useState<string | null>(null)

  const lastCursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const cursorThrottleRef = useRef(0)
  const hasReceivedFirstCursorsRef = useRef(false)
  useEffect(() => {
    hasReceivedFirstCursorsRef.current = false
    const CURSOR_THROTTLE_MS = 80
    const unsub = subscribeCursors(boardId, (cursors) => {
      const names = Object.entries(cursors).map(([uid, c]) =>
        uid === user?.uid ? 'You' : (c.displayName || 'Anonymous')
      )
      if (!Object.keys(cursors).includes(user?.uid ?? '')) {
        names.push('You')
      }
      onPresenceChange?.(names.length ? names : ['You'])
      const now = Date.now()
      const isFirst = !hasReceivedFirstCursorsRef.current
      if (isFirst || now - cursorThrottleRef.current >= CURSOR_THROTTLE_MS) {
        hasReceivedFirstCursorsRef.current = true
        cursorThrottleRef.current = now
        setOtherCursors(cursors)
      }
    })
    return unsub
  }, [boardId, user?.uid, onPresenceChange])

  useEffect(() => {
    if (!user) return
    setupCursorOnDisconnect(boardId, user.uid)
    setMyCursor(boardId, user.uid, {
      x: 0,
      y: 0,
      displayName: user.displayName ?? null,
      color: cursorColorFromUid(user.uid),
    })
    return () => {
      removeMyCursor(boardId, user.uid)
    }
  }, [boardId, user?.uid])

  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      setMyCursor(boardId, user.uid, {
        x: lastCursorPosRef.current.x,
        y: lastCursorPosRef.current.y,
        displayName: user.displayName ?? null,
        color: cursorColorFromUid(user.uid),
      })
    }, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [boardId, user?.uid, user?.displayName])

  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{
    pointer: { x: number; y: number }
    stagePos: { x: number; y: number }
  } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Update transformer nodes whenever selectedIds changes
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    if (selectedIds.length === 0) {
      tr.nodes([])
      return
    }
    const raf = requestAnimationFrame(() => {
      const nodes = selectedIds
        .map((id) => stage.findOne(`#${id}`))
        .filter((n): n is Konva.Node => n != null)
      tr.nodes(nodes)
      tr.getLayer()?.batchDraw()
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedIds, objects])

  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current
    if (!tr || !onObjectResized) return
    const nodes = tr.nodes() as Konva.Group[]
    for (const node of nodes) {
      const id = node.id()
      const obj = objects.find((o) => o.id === id)
      if (!obj) continue
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      const rotation = node.rotation()
      const x = node.x()
      const y = node.y()
      let w: number
      let h: number
      if (obj.type === 'circle') {
        const uniform = (scaleX + scaleY) / 2
        w = obj.width * uniform
        h = w
      } else {
        w = obj.width * scaleX
        h = obj.height * scaleY
      }
      node.scaleX(1)
      node.scaleY(1)
      onObjectResized(id, { x, y, width: w, height: h, rotation })
    }
  }, [objects, onObjectResized])

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || el.isContentEditable
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) {
        e.preventDefault()
        setSpacePressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) {
        e.preventDefault()
        setSpacePressed(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false)
      panStartRef.current = null
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  const sendCursor = useCallback(
    (worldX: number, worldY: number) => {
      if (!user) return
      const now = Date.now()
      if (now - lastCursorRef.current < 50) return
      lastCursorRef.current = now
      lastCursorPosRef.current = { x: worldX, y: worldY }
      setMyCursor(boardId, user.uid, {
        x: worldX,
        y: worldY,
        displayName: user.displayName ?? null,
        color: cursorColorFromUid(user.uid),
      })
    },
    [boardId, user]
  )

  const getWorldPos = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return {
      x: (pointer.x - posRef.current.x) / scaleRef.current,
      y: (pointer.y - posRef.current.y) / scaleRef.current,
    }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage || !user) return
    const world = getWorldPos(stage)
    if (!world) return
    sendCursor(world.x, world.y)

    if (isSelectingRef.current && selectionStartRef.current) {
      const start = selectionStartRef.current
      setSelectionRect({
        x: Math.min(start.x, world.x),
        y: Math.min(start.y, world.y),
        width: Math.abs(world.x - start.x),
        height: Math.abs(world.y - start.y),
      })
    }
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const scaleBy = 1.1
    const stage = e.target.getStage()
    if (!stage) return
    const pos = posRef.current
    const oldScale = scaleRef.current
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    }
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
    const clamped = Math.min(3, Math.max(0.2, newScale))
    const newPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    }
    posRef.current = newPos
    scaleRef.current = clamped
    setStageScale(clamped)
    setStagePos(newPos)
  }

  const isBackgroundTarget = (target: Konva.Node) =>
    target.getStage() === target ||
    target.getClassName() === 'Layer' ||
    (target.name && target.name() === 'canvas-background')

  const isPanMode = spacePressed || activeTool === 'pan'

  const isCreateTool =
    activeTool === 'sticky' ||
    activeTool === 'rect' ||
    activeTool === 'circle' ||
    activeTool === 'line' ||
    activeTool === 'frame' ||
    activeTool === 'text'

  const createObjectAtPointer = (stage: Konva.Stage) => {
    if (!isCreateTool) return
    const world = getWorldPos(stage)
    if (!world) return
    const id = crypto.randomUUID()
    let newObj: BoardObject

    if (activeTool === 'sticky') {
      newObj = {
        id, type: 'sticky',
        x: world.x, y: world.y,
        width: STICKY_WIDTH, height: STICKY_HEIGHT,
        text: 'New note', color: DEFAULT_STICKY_COLOR,
      }
    } else if (activeTool === 'rect') {
      newObj = {
        id, type: 'rect',
        x: world.x, y: world.y,
        width: STICKY_WIDTH, height: STICKY_HEIGHT,
        color: DEFAULT_SHAPE_COLOR,
      }
    } else if (activeTool === 'circle') {
      newObj = {
        id, type: 'circle',
        x: world.x, y: world.y,
        width: CIRCLE_DIAMETER, height: CIRCLE_DIAMETER,
        color: DEFAULT_SHAPE_COLOR,
      }
    } else if (activeTool === 'line') {
      newObj = {
        id, type: 'line',
        x: world.x, y: world.y,
        width: LINE_DEFAULT_WIDTH, height: LINE_DEFAULT_HEIGHT,
        color: DEFAULT_SHAPE_COLOR,
      }
    } else if (activeTool === 'frame') {
      newObj = {
        id, type: 'frame',
        x: world.x, y: world.y,
        width: FRAME_DEFAULT_WIDTH, height: FRAME_DEFAULT_HEIGHT,
        text: 'Frame', color: DEFAULT_FRAME_COLOR,
      }
    } else {
      // text
      newObj = {
        id, type: 'text',
        x: world.x, y: world.y,
        width: 200, height: 80,
        text: 'Text', font_size: TEXT_DEFAULT_FONT_SIZE,
        font_color: DEFAULT_TEXT_COLOR,
      }
    }

    onOptimisticAdd?.(newObj)
    onSelect([])
    onAfterCreateObject?.()
    addObject(boardId, newObj).catch((err) => {
      console.error('Failed to create object', err)
      onAddFailed?.(newObj.id, err)
    })
  }

  const handleObjectClick = useCallback(
    (id: string, shiftKey: boolean) => {
      if (activeTool === 'connector') {
        if (!pendingConnectorFrom) {
          setPendingConnectorFrom(id)
        } else if (pendingConnectorFrom !== id) {
          onConnectorCreated?.(pendingConnectorFrom, id)
          setPendingConnectorFrom(null)
          onAfterCreateObject?.()
        }
        return
      }
      if (shiftKey) {
        if (selectedIds.includes(id)) {
          onSelect(selectedIds.filter((sid) => sid !== id))
        } else {
          onSelect([...selectedIds, id])
        }
      } else {
        onSelect(selectedIds.length === 1 && selectedIds[0] === id ? [] : [id])
      }
    },
    [activeTool, pendingConnectorFrom, selectedIds, onSelect, onConnectorCreated, onAfterCreateObject]
  )

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    if (isPanMode && isBackgroundTarget(e.target)) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      setIsPanning(true)
      panStartRef.current = { pointer: { ...pointer }, stagePos: { ...stagePos } }
      return
    }

    // Drag-to-select: only when not in create/pan/connector mode
    if (!isCreateTool && !isPanMode && activeTool !== 'connector' && isBackgroundTarget(e.target)) {
      const world = getWorldPos(stage)
      if (world) {
        selectionStartRef.current = world
        isSelectingRef.current = true
        setSelectionRect({ x: world.x, y: world.y, width: 0, height: 0 })
      }
    }
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanning || !panStartRef.current) return
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const { pointer: startPointer, stagePos: startStagePos } = panStartRef.current
    const dx = pointer.x - startPointer.x
    const dy = pointer.y - startPointer.y
    const p = { x: startStagePos.x + dx, y: startStagePos.y + dy }
    posRef.current = p
    setStagePos(p)
  }

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsPanning(false)
    panStartRef.current = null

    // Finish drag-to-select
    if (isSelectingRef.current && selectionRect) {
      const stage = e.target.getStage()
      if (stage) {
        const rect = selectionRect
        const selected = objects
          .filter((obj) => obj.type !== 'connector')
          .filter((obj) => {
            const objRight = obj.x + obj.width
            const objBottom = obj.y + obj.height
            const rectRight = rect.x + rect.width
            const rectBottom = rect.y + rect.height
            return obj.x < rectRight && objRight > rect.x && obj.y < rectBottom && objBottom > rect.y
          })
        if (selected.length > 0) {
          onSelect(selected.map((o) => o.id))
        }
      }
      setSelectionRect(null)
      isSelectingRef.current = false
      selectionStartRef.current = null
    }
  }

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return
    const target = e.target
    const isBackground =
      target === stage ||
      target.getClassName() === 'Layer' ||
      (target.name && target.name() === 'canvas-background')
    if (!isBackground) return

    if (isCreateTool) {
      createObjectAtPointer(stage)
    } else if (activeTool === 'connector') {
      // Clicking background cancels pending connector
      setPendingConnectorFrom(null)
    } else {
      onSelect([])
    }
  }

  const cursorList = Object.values(otherCursors)

  const showInlineEdit = editingObject && onEditingTextChange && onSaveEdit
  const editBounds =
    showInlineEdit && editingObject
      ? {
          left: stagePos.x + editingObject.x * stageScale,
          top: stagePos.y + editingObject.y * stageScale,
          width: editingObject.width * stageScale,
          height: editingObject.height * stageScale,
        }
      : null

  const cursorStyle = isPanMode
    ? isPanning
      ? 'grabbing'
      : 'grab'
    : activeTool === 'connector'
    ? pendingConnectorFrom
      ? 'crosshair'
      : 'cell'
    : 'default'

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-100 relative">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={false}
        onMouseDown={handleStageMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e)
          handleStageMouseMove(e)
        }}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        style={{ cursor: cursorStyle }}
      >
        <Layer>
          <Rect
            name="canvas-background"
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            listening={true}
            onClick={handleStageClick}
            onTap={handleStageClick}
          />
          <BoardObjects
            boardId={boardId}
            objects={objects}
            selectedIds={selectedIds}
            onObjectClick={handleObjectClick}
            onStartEditText={onStartEditText}
            onObjectMoved={onObjectMoved}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onBroadcastDragMove={onBroadcastDragMove}
            onMultiDragMove={onMultiDragMove}
            pendingConnectorFrom={pendingConnectorFrom}
          />
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            onTransformEnd={handleTransformEnd}
          />
          {/* Drag-to-select rectangle */}
          {selectionRect && selectionRect.width > 2 && selectionRect.height > 2 && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(37, 99, 235, 0.08)"
              stroke="#2563eb"
              strokeWidth={1 / stageScale}
              listening={false}
            />
          )}
          <OtherCursors cursors={cursorList} currentUid={user?.uid ?? null} />
        </Layer>
      </Stage>

      {/* Pending connector hint */}
      {pendingConnectorFrom && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 px-4 py-2 bg-amber-500 text-white text-sm rounded-full shadow-lg pointer-events-none z-50">
          Now click the target object to connect
        </div>
      )}

      {editBounds && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Click outside to save"
            style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'transparent' }}
            onClick={() => onSaveEdit?.()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit?.()
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSaveEdit?.()
              }
            }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
          />
          <div
            style={{
              position: 'absolute',
              left: editBounds.left,
              top: editBounds.top,
              width: editBounds.width,
              height: editBounds.height,
              zIndex: 11,
              padding: Math.max(4, 8 * stageScale),
              boxSizing: 'border-box',
              background:
                editingObject?.type === 'text'
                  ? 'rgba(255,255,255,0.95)'
                  : (editingObject?.color ?? 'rgba(255,255,255,0.95)'),
              border: '2px solid #2563eb',
              borderRadius: editingObject?.type === 'circle' ? '50%' : 8,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <textarea
              value={editingText}
              onChange={(e) => onEditingTextChange?.(e.target.value)}
              onBlur={() => onSaveEdit?.()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  onCancelEdit?.()
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSaveEdit?.()
                }
              }}
              aria-label="Edit text"
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
              style={{
                width: editingObject?.type === 'circle' ? '85%' : '100%',
                height: editingObject?.type === 'circle' ? '85%' : '100%',
                resize: 'none',
                border: 'none',
                background: 'transparent',
                fontSize: Math.max(12, Math.min(20, (editingObject?.width ?? 100) * stageScale * 0.12)),
                fontFamily: 'inherit',
                lineHeight: 1.4,
                textAlign: editingObject?.type === 'circle' ? 'center' : 'left',
                borderRadius: editingObject?.type === 'circle' ? '50%' : undefined,
              }}
              autoFocus
            />
          </div>
        </>
      )}
    </div>
  )
}
