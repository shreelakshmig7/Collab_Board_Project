import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
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
  FRAME_DEFAULT_WIDTH,
  FRAME_DEFAULT_HEIGHT,
  TEXT_DEFAULT_FONT_SIZE,
  HEARTBEAT_MS,
  MIN_OBJECT_SIZE,
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
import { getObjectIdsInSelectionRect, applyMarqueeToSelection } from './selectionRect'
import OtherCursors from './OtherCursors'
import BoardObjects from './BoardObjects'

type CanvasProps = {
  boardId: string
  user: AppUser
  activeTool: Tool | null
  pendingConnectorFrom?: string | null
  onPendingConnectorFromChange?: (id: string | null) => void
  onPresenceChange?: (names: string[]) => void
  objects: BoardObject[]
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onStartEditText?: (id: string, text: string, part?: 'header' | 'body') => void
  editingObject?: BoardObject | null
  editingPart?: 'header' | 'body' | null
  editingText?: string
  onEditingTextChange?: (text: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onOptimisticAdd?: (obj: BoardObject) => void
  onAddFailed?: (id: string, err: unknown) => void
  onObjectMoved?: (id: string, x: number, y: number) => void
  onObjectParentChange?: (id: string, parentId: string | null) => void
  onObjectResized?: (id: string, payload: { x: number; y: number; width: number; height: number; rotation?: number }) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  onAfterCreateObject?: () => void
  onBroadcastDragMove?: (id: string, x: number, y: number) => void
  onMultiDragMove?: (movedId: string, deltaX: number, deltaY: number) => void
  onConnectorCreated?: (fromId: string, toId: string, style?: import('../types/board').ConnectorStyle) => void
  connectorStyle?: import('../types/board').ConnectorStyle
  onConnectorResized?: (id: string, fromX: number, fromY: number, toX: number, toY: number) => void
  onConnectorMoved?: (id: string, fromX: number, fromY: number, toX: number, toY: number) => void
  onViewportChange?: (center: { x: number; y: number }) => void
  /** Drag whole selection from empty space inside selection box */
  onSelectionDragStart?: (worldPos: { x: number; y: number }) => void
  onSelectionDragMove?: (deltaX: number, deltaY: number) => void
  onSelectionDragEnd?: () => void
  /** Called when user clicks empty canvas (e.g. to deselect Select tool). */
  onEmptyCanvasClick?: () => void
  isViewOnly?: boolean
}

export default function Canvas({
  boardId,
  user,
  activeTool,
  pendingConnectorFrom: pendingConnectorFromProp = null,
  onPendingConnectorFromChange,
  onPresenceChange,
  objects,
  selectedIds,
  onSelect,
  onStartEditText,
  editingObject,
  editingPart,
  editingText = '',
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
  onOptimisticAdd,
  onAddFailed,
  onObjectMoved,
  onObjectParentChange,
  onObjectResized,
  onDragStart,
  onDragEnd,
  onAfterCreateObject,
  onBroadcastDragMove,
  onMultiDragMove,
  onConnectorCreated,
  onConnectorResized,
  onConnectorMoved,
  connectorStyle = 'arrow',
  onViewportChange,
  onSelectionDragStart,
  onSelectionDragMove,
  onSelectionDragEnd,
  onEmptyCanvasClick,
  isViewOnly = false,
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


  // Connector tool: pending first object click (controlled from parent when onPendingConnectorFromChange provided)
  const [pendingConnectorFromLocal, setPendingConnectorFromLocal] = useState<string | null>(null)
  const pendingConnectorFrom = onPendingConnectorFromChange != null ? pendingConnectorFromProp ?? null : pendingConnectorFromLocal
  const setPendingConnectorFrom = useCallback(
    (id: string | null) => {
      if (onPendingConnectorFromChange) onPendingConnectorFromChange(id)
      else setPendingConnectorFromLocal(id)
    },
    [onPendingConnectorFromChange]
  )
  // Screen position for "Select target node" tooltip (follows cursor)
  const [cursorScreenPos, setCursorScreenPos] = useState<{ x: number; y: number } | null>(null)
  // Suppress second click of double-click so only edit runs (double-click = edit; does not apply to connector)
  const lastObjectClickRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })

  // Marquee (drag-to-select) in select tool: start and current pointer in world coords
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null)
  const marqueeShiftKeyRef = useRef(false)
  const justAppliedMarqueeRef = useRef(false)
  const [isSelectionDragging, setIsSelectionDragging] = useState(false)
  const selectionDragStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const justAppliedSelectionDragRef = useRef(false)

  const lastCursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const cursorThrottleRef = useRef(0)
  const hasReceivedFirstCursorsRef = useRef(false)

  // Clear connector flow when user switches to another tool
  useEffect(() => {
    if (activeTool !== 'connector') {
      setPendingConnectorFrom(null)
      setCursorScreenPos(null)
    }
  }, [activeTool])

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

  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{
    pointer: { x: number; y: number }
    stagePos: { x: number; y: number }
  } | null>(null)
  /** Live pan position during drag; rAF updates state so Stage re-renders with correct position */
  const panCurrentRef = useRef({ x: 0, y: 0 })
  const panRafScheduledRef = useRef(false)

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

  // Notify viewport center (for creating objects at center when toolbar button is clicked)
  useEffect(() => {
    onViewportChange?.({
      x: (-posRef.current.x + size.width / 2) / scaleRef.current,
      y: (-posRef.current.y + size.height / 2) / scaleRef.current,
    })
  }, [size, stagePos, stageScale, onViewportChange])

  // Update transformer: show resize/rotate handles for single selection (including connectors).
  useEffect(() => {
    const tr = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    if (selectedIds.length === 0 || selectedIds.length > 1) {
      tr.nodes([])
      return
    }
    const raf = requestAnimationFrame(() => {
      const node = stage.findOne(`#${selectedIds[0]}`)
      tr.nodes(node ? [node] : [])
      tr.getLayer()?.batchDraw()
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedIds, objects])

  const handleTransformEnd = useCallback(() => {
    const tr = transformerRef.current
    if (!tr) return
    const nodes = tr.nodes() as Konva.Node[]
    for (const node of nodes) {
      const id = node.id()
      const obj = objects.find((o) => o.id === id)
      if (!obj) continue

      if (obj.type === 'connector') {
        const lineNode = (node as Konva.Container).getChildren()[0] as Konva.Line | undefined
        const points = lineNode?.points?.()
        if (!points || points.length < 4) continue
        const w = points[2]
        const h = points[3]
        const transform = node.getAbsoluteTransform()
        const fromAbs = transform.point({ x: 0, y: 0 })
        const toAbs = transform.point({ x: w, y: h })
        // getAbsoluteTransform can include stage scale/pan; convert to layer (world) coords
        const scale = scaleRef.current
        const pos = posRef.current
        const fromWorldX = (fromAbs.x - pos.x) / scale
        const fromWorldY = (fromAbs.y - pos.y) / scale
        const toWorldX = (toAbs.x - pos.x) / scale
        const toWorldY = (toAbs.y - pos.y) / scale
        node.scaleX(1)
        node.scaleY(1)
        node.rotation(0)
        node.position({ x: 0, y: 0 })
        onConnectorResized?.(id, fromWorldX, fromWorldY, toWorldX, toWorldY)
        continue
      }

      if (!onObjectResized) continue
      const scaleX = Math.abs(node.scaleX())
      const scaleY = Math.abs(node.scaleY())
      const rotation = node.rotation()
      // Use absolute position so nested objects (inside frames) get correct world coords
      const absTransform = node.getAbsoluteTransform()
      const topLeftAbs = absTransform.point({ x: 0, y: 0 })
      const scale = scaleRef.current
      const pos = posRef.current
      const x = (topLeftAbs.x - pos.x) / scale
      const y = (topLeftAbs.y - pos.y) / scale
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
      w = Math.max(MIN_OBJECT_SIZE, Number.isFinite(w) ? w : obj.width)
      h = Math.max(MIN_OBJECT_SIZE, Number.isFinite(h) ? h : obj.height)
      node.scaleX(1)
      node.scaleY(1)
      onObjectResized(id, { x, y, width: w, height: h, rotation })
    }
  }, [objects, onObjectResized, onConnectorResized])

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

    // Update cursor position for connector "Select target node" tooltip
    if (activeTool === 'connector' && pendingConnectorFrom) {
      setCursorScreenPos({ x: e.evt.clientX, y: e.evt.clientY })
    }
  }

  const zoomRafScheduledRef = useRef(false)
  const zoomTargetRef = useRef<{ scale: number; pos: { x: number; y: number } } | null>(null)

  const applyZoomTarget = useCallback(() => {
    const t = zoomTargetRef.current
    zoomTargetRef.current = null
    if (!t) return
    posRef.current = t.pos
    scaleRef.current = t.scale
    setStagePos(t.pos)
    setStageScale(t.scale)
  }, [])

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const scaleBy = 1.05
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
    zoomTargetRef.current = { scale: clamped, pos: newPos }
    if (!zoomRafScheduledRef.current) {
      zoomRafScheduledRef.current = true
      requestAnimationFrame(() => {
        applyZoomTarget()
        zoomRafScheduledRef.current = false
      })
    }
  }

  const isBackgroundTarget = (target: Konva.Node) =>
    target.getStage() === target ||
    target.getClassName() === 'Layer' ||
    (target.name && target.name() === 'canvas-background')

  const isCreateTool =
    activeTool === 'sticky' ||
    activeTool === 'rect' ||
    activeTool === 'circle' ||
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
        text: '', color: DEFAULT_STICKY_COLOR,
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
    } else if (activeTool === 'frame') {
      newObj = {
        id, type: 'frame',
        x: world.x, y: world.y,
        width: FRAME_DEFAULT_WIDTH, height: FRAME_DEFAULT_HEIGHT,
        text: '', color: DEFAULT_FRAME_COLOR,
      }
    } else {
      // text
      newObj = {
        id, type: 'text',
        x: world.x, y: world.y,
        width: 200, height: 80,
        text: '', font_size: TEXT_DEFAULT_FONT_SIZE,
        font_color: DEFAULT_TEXT_COLOR,
      }
    }

    // If created inside a frame, set as child
    if (newObj.type !== 'frame') {
      const cx = newObj.x + newObj.width / 2
      const cy = newObj.y + newObj.height / 2
      const containingFrame = objects.find(
        (o) =>
          o.type === 'frame' &&
          cx >= o.x &&
          cx <= o.x + o.width &&
          cy >= o.y &&
          cy <= o.y + o.height
      )
      if (containingFrame) newObj.parent_id = containingFrame.id
    }

    onOptimisticAdd?.(newObj)
    onSelect([])
    onAfterCreateObject?.()
    addObject(boardId, newObj).catch((err) => {
      console.error('Failed to create object', err)
      onAddFailed?.(newObj.id, err)
    })
  }

  const isConnectorTool = activeTool === 'connector'

  const handleObjectClick = useCallback(
    (id: string, shiftKey: boolean) => {
      if (isConnectorTool) {
        if (!pendingConnectorFrom) {
          setPendingConnectorFrom(id)
        } else if (pendingConnectorFrom !== id) {
          onConnectorCreated?.(pendingConnectorFrom, id, connectorStyle)
          setPendingConnectorFrom(null)
          setCursorScreenPos(null)
          onAfterCreateObject?.()
        }
        return
      }
      // Single click = select (any tool). Double-click = edit (handled by onDblClick in BoardObjects; not for connector).
      const obj = objects.find((o) => o.id === id)
      const isConnectorObject = obj?.type === 'connector'
      const now = Date.now()
      if (!isConnectorObject && id === lastObjectClickRef.current.id && now - lastObjectClickRef.current.t < 400) {
        lastObjectClickRef.current = { id: '', t: 0 }
        return
      }
      lastObjectClickRef.current = { id, t: now }
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
    [isConnectorTool, pendingConnectorFrom, connectorStyle, objects, selectedIds, onSelect, onConnectorCreated, onAfterCreateObject]
  )

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    if (!isBackgroundTarget(e.target)) return

    const world = getWorldPos(stage)
    if (!world) return

    // Select tool: if click is inside selection box (empty space between selected objects), drag whole selection; otherwise start marquee
    if (activeTool === 'select') {
      const insideSelectionBox =
        selectionBoxBounds &&
        world.x >= selectionBoxBounds.x &&
        world.x <= selectionBoxBounds.x + selectionBoxBounds.width &&
        world.y >= selectionBoxBounds.y &&
        world.y <= selectionBoxBounds.y + selectionBoxBounds.height
      if (
        selectedIds.length > 0 &&
        insideSelectionBox &&
        onSelectionDragStart &&
        onSelectionDragMove &&
        onSelectionDragEnd
      ) {
        selectionDragStartWorldRef.current = world
        onSelectionDragStart(world)
        setIsSelectionDragging(true)
        return
      }
      marqueeShiftKeyRef.current = e.evt.shiftKey
      setMarqueeStart(world)
      setMarqueeCurrent(world)
      return
    }

    // Click+drag on empty canvas = pan
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    setIsPanning(true)
    panStartRef.current = { pointer: { ...pointer }, stagePos: { ...stagePos } }
    panCurrentRef.current = { x: stagePos.x, y: stagePos.y }
  }

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    // Selection drag from empty space: apply delta to all selected
    if (isSelectionDragging && onSelectionDragMove) {
      const world = getWorldPos(stage)
      if (world) {
        const start = selectionDragStartWorldRef.current
        onSelectionDragMove(world.x - start.x, world.y - start.y)
      }
      return
    }

    // Marquee: update current point
    if (marqueeStart !== null) {
      const world = getWorldPos(stage)
      if (world) setMarqueeCurrent(world)
      return
    }

    if (!isPanning || !panStartRef.current) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const { pointer: startPointer, stagePos: startStagePos } = panStartRef.current
    const dx = pointer.x - startPointer.x
    const dy = pointer.y - startPointer.y
    const p = { x: startStagePos.x + dx, y: startStagePos.y + dy }
    posRef.current = p
    panCurrentRef.current = p
    if (!panRafScheduledRef.current) {
      panRafScheduledRef.current = true
      requestAnimationFrame(() => {
        setStagePos(panCurrentRef.current)
        panRafScheduledRef.current = false
      })
    }
  }

  const handleStageMouseUp = () => {
    // Finish selection drag from empty space
    if (isSelectionDragging) {
      onSelectionDragEnd?.()
      justAppliedSelectionDragRef.current = true
      setIsSelectionDragging(false)
    }

    // Finish marquee and apply selection
    if (marqueeStart !== null && marqueeCurrent !== null) {
      const x = Math.min(marqueeStart.x, marqueeCurrent.x)
      const y = Math.min(marqueeStart.y, marqueeCurrent.y)
      const width = marqueeCurrent.x - marqueeStart.x
      const height = marqueeCurrent.y - marqueeStart.y
      const rect = { x, y, width, height }
      const marqueeIds = getObjectIdsInSelectionRect(objects, rect)
      const shiftKey = marqueeShiftKeyRef.current
      const newIds = applyMarqueeToSelection(marqueeIds, selectedIds, shiftKey)
      onSelect(newIds)
      justAppliedMarqueeRef.current = true
      setMarqueeStart(null)
      setMarqueeCurrent(null)
    }

    if (isPanning) {
      setStagePos(posRef.current)
    }
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
    if (!isBackground) return

    // Avoid clearing selection when this click is the release after a marquee or selection drag
    if (justAppliedMarqueeRef.current) {
      justAppliedMarqueeRef.current = false
      onEmptyCanvasClick?.()
      return
    }
    if (justAppliedSelectionDragRef.current) {
      justAppliedSelectionDragRef.current = false
      return
    }

    // Click (without drag) on background: create object, clear selection, or cancel connector
    if (isCreateTool) {
      createObjectAtPointer(stage)
    } else if (isConnectorTool) {
      setPendingConnectorFrom(null)
      setCursorScreenPos(null)
    } else {
      onSelect([])
      onEmptyCanvasClick?.()
    }
  }

  const cursorList = Object.values(otherCursors)

  const showInlineEdit = editingObject && onEditingTextChange && onSaveEdit
  const editBounds =
    showInlineEdit && editingObject
      ? (() => {
          const isFrame = editingObject.type === 'frame'
          const headerH = 40
          if (isFrame && editingPart === 'header') {
            return {
              left: stagePos.x + editingObject.x * stageScale,
              top: stagePos.y + editingObject.y * stageScale,
              width: editingObject.width * stageScale,
              height: headerH * stageScale,
            }
          }
          if (isFrame && editingPart === 'body') {
            return {
              left: stagePos.x + editingObject.x * stageScale,
              top: stagePos.y + (editingObject.y + headerH) * stageScale,
              width: editingObject.width * stageScale,
              height: (editingObject.height - headerH) * stageScale,
            }
          }
          return {
            left: stagePos.x + editingObject.x * stageScale,
            top: stagePos.y + editingObject.y * stageScale,
            width: editingObject.width * stageScale,
            height: editingObject.height * stageScale,
          }
        })()
      : null

  const cursorStyle = isPanning
    ? 'grabbing'
    : isSelectionDragging
      ? 'grabbing'
      : marqueeStart !== null
        ? 'crosshair'
        : isConnectorTool
          ? pendingConnectorFrom
            ? 'crosshair'
            : 'cell'
          : 'grab'

  /** Bounding box in world coords for multi-select (single box around all selected) */
  const selectionBoxBounds = useMemo(() => {
    if (selectedIds.length <= 1) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of selectedIds) {
      const o = objects.find((obj) => obj.id === id)
      if (!o) continue
      const w = Math.max(0, o.width)
      const h = Math.max(0, o.height)
      minX = Math.min(minX, o.x)
      minY = Math.min(minY, o.y)
      maxX = Math.max(maxX, o.x + w)
      maxY = Math.max(maxY, o.y + h)
    }
    if (minX === Infinity) return null
    const padding = 4
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }, [objects, selectedIds])

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
            onObjectParentChange={onObjectParentChange}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onBroadcastDragMove={onBroadcastDragMove}
            onMultiDragMove={onMultiDragMove}
            pendingConnectorFrom={pendingConnectorFrom}
            onConnectorMoved={onConnectorMoved}
            readOnly={isViewOnly}
          />
          {!isViewOnly && (
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            boundBoxFunc={(oldBox, newBox) => {
              // Prevent resizing to zero. Use AND so connectors (lines with thin bbox) can resize.
              const minSize = MIN_OBJECT_SIZE
              if (newBox.width < minSize && newBox.height < minSize) {
                return oldBox
              }
              if (newBox.width < 1 || newBox.height < 1) return oldBox
              return newBox
            }}
            onTransformEnd={handleTransformEnd}
          />
          )}
          {/* Multi-select bounding box (single box around all selected objects) */}
          {selectionBoxBounds && (
            <Rect
              x={selectionBoxBounds.x}
              y={selectionBoxBounds.y}
              width={selectionBoxBounds.width}
              height={selectionBoxBounds.height}
              fill="transparent"
              stroke="#2563eb"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          )}
          {/* Drag-to-select marquee rect (select tool only) */}
          {marqueeStart !== null && marqueeCurrent !== null && (
            <Rect
              x={Math.min(marqueeStart.x, marqueeCurrent.x)}
              y={Math.min(marqueeStart.y, marqueeCurrent.y)}
              width={Math.abs(marqueeCurrent.x - marqueeStart.x)}
              height={Math.abs(marqueeCurrent.y - marqueeStart.y)}
              fill="rgba(37, 99, 235, 0.15)"
              stroke="#2563eb"
              strokeWidth={2}
              listening={false}
            />
          )}
          <OtherCursors cursors={cursorList} currentUid={user?.uid ?? null} />
        </Layer>
      </Stage>

      {/* Connector target tooltip: follows cursor after source is selected (source tooltip is in Toolbar) */}
      {pendingConnectorFrom && cursorScreenPos && (
        <div
          className="fixed px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg shadow-lg pointer-events-none z-50 whitespace-nowrap"
          style={{ left: cursorScreenPos.x + 16, top: cursorScreenPos.y + 16 }}
          role="status"
          aria-live="polite"
        >
          Select target node
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
              placeholder="Type here"
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
