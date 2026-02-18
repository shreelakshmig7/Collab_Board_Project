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
  CIRCLE_DIAMETER,
  LINE_DEFAULT_WIDTH,
  LINE_DEFAULT_HEIGHT,
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
  selectedId: string | null
  onSelect: (id: string | null) => void
  onStartEditText?: (id: string, text: string) => void
  editingObject?: BoardObject | null
  editingText?: string
  onEditingTextChange?: (text: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onOptimisticAdd?: (obj: BoardObject) => void
  onAddFailed?: (id: string, err: unknown) => void
  onObjectMoved?: (id: string, x: number, y: number) => void
  onObjectResized?: (id: string, payload: { x: number; y: number; width: number; height: number }) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  onAfterCreateObject?: () => void
}

export default function Canvas({
  boardId,
  user,
  activeTool,
  onPresenceChange,
  objects,
  selectedId,
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
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const selectedNodeRef = useRef<Konva.Group | null>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const lastCursorRef = useRef<number>(0)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)
  const posRef = useRef(stagePos)
  const scaleRef = useRef(stageScale)
  const [otherCursors, setOtherCursors] = useState<Record<string, { uid: string; x: number; y: number; displayName: string | null; color: string }>>({})

  posRef.current = stagePos
  scaleRef.current = stageScale

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

  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ pointer: { x: number; y: number }; stagePos: { x: number; y: number } } | null>(null)

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

  useEffect(() => {
    if (!selectedId) {
      transformerRef.current?.nodes([])
      selectedNodeRef.current = null
      return
    }
    const raf = requestAnimationFrame(() => {
      const node = selectedNodeRef.current
      const tr = transformerRef.current
      if (node && tr) {
        tr.nodes([node])
        tr.getLayer()?.batchDraw()
      } else {
        tr?.nodes([])
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedId, objects])

  const handleTransformEnd = useCallback(() => {
    const node = selectedNodeRef.current
    if (!node || !selectedId || !onObjectResized) return
    const obj = objects.find((o) => o.id === selectedId)
    if (!obj) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
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
    onObjectResized(selectedId, { x, y, width: w, height: h })
  }, [selectedId, objects, onObjectResized])

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
      setMyCursor(boardId, user.uid, {
        x: worldX,
        y: worldY,
        displayName: user.displayName ?? null,
        color: cursorColorFromUid(user.uid),
      })
    },
    [boardId, user]
  )

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage || !user) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const worldX = (pointer.x - stagePos.x) / stageScale
    const worldY = (pointer.y - stagePos.y) / stageScale
    sendCursor(worldX, worldY)
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

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanMode || !isBackgroundTarget(e.target)) return
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    setIsPanning(true)
    panStartRef.current = { pointer: { ...pointer }, stagePos: { ...stagePos } }
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

  const handleStageMouseUp = () => {
    setIsPanning(false)
    panStartRef.current = null
  }

  const createObjectAtPointer = (stage: Konva.Stage) => {
    const isCreateTool =
      activeTool === 'sticky' || activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line'
    if (!isCreateTool) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const worldX = (pointer.x - stagePos.x) / stageScale
    const worldY = (pointer.y - stagePos.y) / stageScale
    const id = crypto.randomUUID()
    let newObj: BoardObject
    if (activeTool === 'sticky') {
      newObj = {
        id,
        type: 'sticky',
        x: worldX,
        y: worldY,
        width: STICKY_WIDTH,
        height: STICKY_HEIGHT,
        text: 'New note',
        color: DEFAULT_STICKY_COLOR,
      }
    } else if (activeTool === 'rect') {
      newObj = {
        id,
        type: 'rect',
        x: worldX,
        y: worldY,
        width: STICKY_WIDTH,
        height: STICKY_HEIGHT,
        color: DEFAULT_SHAPE_COLOR,
      }
    } else if (activeTool === 'circle') {
      newObj = {
        id,
        type: 'circle',
        x: worldX,
        y: worldY,
        width: CIRCLE_DIAMETER,
        height: CIRCLE_DIAMETER,
        color: DEFAULT_SHAPE_COLOR,
      }
    } else {
      newObj = {
        id,
        type: 'line',
        x: worldX,
        y: worldY,
        width: LINE_DEFAULT_WIDTH,
        height: LINE_DEFAULT_HEIGHT,
        color: DEFAULT_SHAPE_COLOR,
      }
    }
    onOptimisticAdd?.(newObj)
    onSelect(null)
    onAfterCreateObject?.()
    addObject(boardId, newObj).catch((err) => {
      console.error('Failed to create object', err)
      onAddFailed?.(newObj.id, err)
    })
  }

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return
    const target = e.target
    const isBackground =
      target === stage ||
      target.getClassName() === 'Layer' ||
      (target.name && target.name() === 'canvas-background')
    if (isBackground) {
      const isCreateTool =
        activeTool === 'sticky' || activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line'
      if (isCreateTool) {
        createObjectAtPointer(stage)
      } else {
        onSelect(null)
      }
      return
    }
  }

  const handleStageDoubleClick = () => {
    // Creation is single-click only; double-click does nothing for creation
  }

  const cursorList = Object.values(otherCursors)

  const showInlineEdit = editingObject && onEditingTextChange && onSaveEdit
  const editBounds = showInlineEdit && editingObject
    ? {
        left: stagePos.x + editingObject.x * stageScale,
        top: stagePos.y + editingObject.y * stageScale,
        width: editingObject.width * stageScale,
        height: editingObject.height * stageScale,
      }
    : null

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
        style={{ cursor: isPanMode ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
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
            onDblClick={handleStageDoubleClick}
            onDblTap={handleStageDoubleClick}
          />
          <BoardObjects
            boardId={boardId}
            objects={objects}
            selectedId={selectedId}
            selectedNodeRef={selectedNodeRef}
            onSelect={onSelect}
            onStartEditText={onStartEditText}
            onObjectMoved={onObjectMoved}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            onTransformEnd={handleTransformEnd}
          />
          <OtherCursors cursors={cursorList} currentUid={user?.uid ?? null} />
        </Layer>
      </Stage>
      {editBounds && (
        <>
          <div
            role="presentation"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              background: 'transparent',
            }}
            onClick={() => onSaveEdit?.()}
            onKeyDown={(e) => e.key === 'Escape' && onCancelEdit?.()}
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
              background: editingObject?.color ?? 'rgba(255,255,255,0.95)',
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
              style={{
                width: editingObject?.type === 'circle' ? '85%' : '100%',
                height: editingObject?.type === 'circle' ? '85%' : '100%',
                resize: 'none',
                border: 'none',
                outline: 'none',
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
