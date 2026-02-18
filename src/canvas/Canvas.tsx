import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Transformer } from 'react-konva'
import Konva from 'konva'
import type { AppUser } from '../types/user'
import type { Tool } from '../board/Toolbar'
import {
  MVP_BOARD_ID,
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
  user: AppUser
  activeTool: Tool
  onPresenceChange: (names: string[]) => void
  objects: BoardObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onStartEditSticky?: (id: string, text: string) => void
  onOptimisticAdd?: (obj: BoardObject) => void
  onAddFailed?: (id: string, err: unknown) => void
  onObjectMoved?: (id: string, x: number, y: number) => void
  onObjectResized?: (id: string, payload: { x: number; y: number; width: number; height: number }) => void
}

export default function Canvas({
  user,
  activeTool,
  onPresenceChange,
  objects,
  selectedId,
  onSelect,
  onStartEditSticky,
  onOptimisticAdd,
  onAddFailed,
  onObjectMoved,
  onObjectResized,
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

  useEffect(() => {
    let lastCursorUpdate = 0
    const CURSOR_THROTTLE_MS = 120
    const unsub = subscribeCursors(MVP_BOARD_ID, (cursors) => {
      const now = Date.now()
      if (now - lastCursorUpdate < CURSOR_THROTTLE_MS) return
      lastCursorUpdate = now
      setOtherCursors(cursors)
      const names = Object.entries(cursors).map(([uid, c]) =>
        uid === user?.uid ? 'You' : (c.displayName || 'Anonymous')
      )
      if (!Object.keys(cursors).includes(user?.uid ?? '')) {
        names.push('You')
      }
      onPresenceChange(names.length ? names : ['You'])
    })
    return unsub
  }, [user?.uid, onPresenceChange])

  useEffect(() => {
    if (!user) return
    setupCursorOnDisconnect(MVP_BOARD_ID, user.uid)
    return () => {
      removeMyCursor(MVP_BOARD_ID, user.uid)
    }
  }, [user?.uid])

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
      setMyCursor(MVP_BOARD_ID, user.uid, {
        x: worldX,
        y: worldY,
        displayName: user.displayName ?? null,
        color: cursorColorFromUid(user.uid),
      })
    },
    [user]
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

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!spacePressed || !isBackgroundTarget(e.target)) return
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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return
    const target = e.target
    const isBackground =
      target === stage ||
      target.getClassName() === 'Layer' ||
      (target.name && target.name() === 'canvas-background')
    if (isBackground) {
      onSelect(null)
      return
    }
  }

  const handleStageDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return
    const target = e.target
    const isBackground =
      target === stage ||
      target.getClassName() === 'Layer' ||
      (target.name && target.name() === 'canvas-background')
    if (!isBackground) return
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
    addObject(MVP_BOARD_ID, newObj).catch((err) => {
      console.error('Failed to create object', err)
      onAddFailed?.(newObj.id, err)
    })
  }

  const isPan = spacePressed
  const cursorList = Object.values(otherCursors)

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#f3f4f6' }}>
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
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDblClick={handleStageDoubleClick}
        onDblTap={handleStageDoubleClick}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        style={{ cursor: isPan ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
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
            objects={objects}
            selectedId={selectedId}
            selectedNodeRef={selectedNodeRef}
            onSelect={onSelect}
            onStartEditSticky={onStartEditSticky}
            onObjectMoved={onObjectMoved}
          />
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            onTransformEnd={handleTransformEnd}
          />
          <OtherCursors cursors={cursorList} currentUid={user?.uid ?? null} />
        </Layer>
      </Stage>
    </div>
  )
}
