/** Board page: main whiteboard view with toolbar, canvas, object selection, and AI assistant panel. */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppUser } from '../types/user'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import type { Tool } from './Toolbar'
import Canvas from '../canvas/Canvas'
import { subscribeObjects, updateObject, deleteObject, deleteAllObjects, addObject } from '../supabase/objects.ts'
import { removeAllCursorsForUser } from '../supabase/cursors'
import { subscribeDragMoves, sendDragMove } from '../supabase/dragBroadcast'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { signOut } from '../supabase/auth'
import { getBoard } from '../supabase/boards'
import type { Board } from '../supabase/boards'
import { getMyRole, listBoardMembers } from '../supabase/boardMembers'
import { removePresence } from '../supabase/presence'
import ShareModal from './ShareModal'
import type { BoardObject, ConnectorStyle } from '../types/board'
import { runAICommand } from '../ai/claudeAgent'
import {
  DEFAULT_CONNECTOR_COLOR,
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_TEXT_COLOR,
  STICKY_WIDTH,
  STICKY_HEIGHT,
  CIRCLE_DIAMETER,
  FRAME_DEFAULT_WIDTH,
  FRAME_DEFAULT_HEIGHT,
  TEXT_DEFAULT_FONT_SIZE,
} from '../constants'
import { validateAIPrompt, sanitizeAIPrompt, validateObjectText, sanitizeObjectText } from '../utils/inputValidation'
import { doesRectOverlapAny, findEmptyPositionInViewport, findEmptyPositionOutsideCluster } from '../canvas/placementUtils'

const AI_CONNECTION_ERROR_MSG = 'Connection error — please try again.'

/** Normalize AI chat content to a display string. Never returns "[object Object]". */
function normalizeAiMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content === '[object Object]' || content.includes('[object Object]')
      ? AI_CONNECTION_ERROR_MSG
      : content
  }
  if (content !== null && typeof content === 'object' && 'message' in content) {
    return normalizeAiMessageContent((content as { message: unknown }).message)
  }
  const s = String(content)
  return s === '[object Object]' || s.includes('[object Object]') ? AI_CONNECTION_ERROR_MSG : s
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
    </svg>
  )
}

const UNDO_LIMIT = 50

type UndoAction =
  | { type: 'CREATE'; objects: BoardObject[] }
  | { type: 'DELETE'; objects: BoardObject[] }
  | { type: 'MOVE'; moves: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] }
  | { type: 'RESIZE'; id: string; prev: { x: number; y: number; width: number; height: number; rotation?: number }; next: { x: number; y: number; width: number; height: number; rotation?: number } }
  | { type: 'TEXT'; id: string; part: 'header' | 'body' | null; prevText: string; newText: string }
  | { type: 'COLOR'; prevColors: Record<string, string>; newColors: Record<string, string> }
  | { type: 'Z_INDEX'; prevZIndices: Record<string, number>; newZIndices: Record<string, number> }

type BoardPageProps = { user: AppUser; boardId: string; boardName: string; presenceNames: string[] }

export default function BoardPage({ user, boardId, boardName, presenceNames }: BoardPageProps) {
  const navigate = useNavigate()
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [connectorStyle, setConnectorStyle] = useState<ConnectorStyle>('arrow')
  const [pendingConnectorFrom, setPendingConnectorFrom] = useState<string | null>(null)
  const [objects, setObjects] = useState<BoardObject[]>([])
  const sortedObjects = useMemo(
    () => [...objects].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)),
    [objects]
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingPart, setEditingPart] = useState<'header' | 'body' | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiPromptValidationError, setAiPromptValidationError] = useState<string | null>(null)
  const [aiChatMessages, setAiChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; isError?: boolean }[]
  >([])
  const [aiLoading, setAiLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [myRole, setMyRole] = useState<'owner' | 'editor' | 'viewer' | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [hasOtherMembers, setHasOtherMembers] = useState(false)

  // Clipboard for copy/paste
  const clipboardRef = useRef<BoardObject[]>([])
  // Drag start positions for multi-drag
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  // Viewport center (from Canvas) for creating objects when toolbar button is clicked
  const viewportCenterRef = useRef({ x: 250, y: 200 })
  const viewportBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const [panToWorldPosition, setPanToWorldPosition] = useState<{ x: number; y: number } | null>(null)
  const aiChatScrollRef = useRef<HTMLDivElement>(null)

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const undoStackRef = useRef<UndoAction[]>([])
  const redoStackRef = useRef<UndoAction[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  /** Drag-start positions captured for move undo */
  const moveStartRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  /** Latest positions updated synchronously during drag (avoids stale closure) */
  const finalPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  /** Always-current snapshot of objects for reading in callbacks without stale closures */
  const objectsRef = useRef<BoardObject[]>([])
  useEffect(() => { objectsRef.current = objects }, [objects])

  /** Push an undoable action. Clears redo stack. Caps stack at UNDO_LIMIT. */
  const pushUndo = useCallback((action: UndoAction) => {
    undoStackRef.current.push(action)
    if (undoStackRef.current.length > UNDO_LIMIT) undoStackRef.current.shift()
    redoStackRef.current = []
    setUndoCount(undoStackRef.current.length)
    setRedoCount(0)
  }, [])

  /** Remove the most-recent CREATE entry for `id` (called when create fails). */
  const popFailedCreate = useCallback((id: string) => {
    for (let i = undoStackRef.current.length - 1; i >= 0; i--) {
      const a = undoStackRef.current[i]
      if (a.type === 'CREATE' && a.objects.some((o) => o.id === id)) {
        undoStackRef.current.splice(i, 1)
        setUndoCount(undoStackRef.current.length)
        break
      }
    }
  }, [])

  const handleUndo = useCallback(() => {
    const action = undoStackRef.current.pop()
    if (!action) return
    redoStackRef.current.push(action)
    setUndoCount(undoStackRef.current.length)
    setRedoCount(redoStackRef.current.length)
    switch (action.type) {
      case 'CREATE': {
        const ids = new Set(action.objects.map((o) => o.id))
        setObjects((prev) => prev.filter((o) => !ids.has(o.id)))
        for (const obj of action.objects)
          deleteObject(boardId, obj.id).catch((e) => console.error('Undo CREATE', e))
        break
      }
      case 'DELETE': {
        for (const obj of action.objects) {
          setObjects((prev) => [...prev, obj])
          addObject(boardId, obj).catch((e) => console.error('Undo DELETE', e))
        }
        break
      }
      case 'MOVE': {
        for (const m of action.moves) {
          setObjects((prev) => prev.map((o) => (o.id === m.id ? { ...o, x: m.prevX, y: m.prevY } : o)))
          updateObject(boardId, m.id, { x: m.prevX, y: m.prevY }).catch((e) => console.error('Undo MOVE', e))
        }
        break
      }
      case 'RESIZE': {
        setObjects((prev) => prev.map((o) => (o.id === action.id ? { ...o, ...action.prev } : o)))
        updateObject(boardId, action.id, action.prev).catch((e) => console.error('Undo RESIZE', e))
        break
      }
      case 'TEXT': {
        const update = action.part === 'body' ? { body_text: action.prevText } : { text: action.prevText }
        setObjects((prev) => prev.map((o) => (o.id === action.id ? { ...o, ...update } : o)))
        updateObject(boardId, action.id, update).catch((e) => console.error('Undo TEXT', e))
        break
      }
      case 'COLOR': {
        for (const [id, color] of Object.entries(action.prevColors)) {
          setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, color } : o)))
          updateObject(boardId, id, { color }).catch((e) => console.error('Undo COLOR', e))
        }
        break
      }
      case 'Z_INDEX': {
        for (const [id, z_index] of Object.entries(action.prevZIndices)) {
          setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, z_index } : o)))
          updateObject(boardId, id, { z_index }).catch((e) => console.error('Undo Z_INDEX', e))
        }
        break
      }
    }
  }, [boardId])

  const handleRedo = useCallback(() => {
    const action = redoStackRef.current.pop()
    if (!action) return
    undoStackRef.current.push(action)
    setUndoCount(undoStackRef.current.length)
    setRedoCount(redoStackRef.current.length)
    switch (action.type) {
      case 'CREATE': {
        for (const obj of action.objects) {
          setObjects((prev) => [...prev, obj])
          addObject(boardId, obj).catch((e) => console.error('Redo CREATE', e))
        }
        break
      }
      case 'DELETE': {
        const ids = new Set(action.objects.map((o) => o.id))
        setObjects((prev) => prev.filter((o) => !ids.has(o.id)))
        for (const obj of action.objects)
          deleteObject(boardId, obj.id).catch((e) => console.error('Redo DELETE', e))
        break
      }
      case 'MOVE': {
        for (const m of action.moves) {
          setObjects((prev) => prev.map((o) => (o.id === m.id ? { ...o, x: m.newX, y: m.newY } : o)))
          updateObject(boardId, m.id, { x: m.newX, y: m.newY }).catch((e) => console.error('Redo MOVE', e))
        }
        break
      }
      case 'RESIZE': {
        setObjects((prev) => prev.map((o) => (o.id === action.id ? { ...o, ...action.next } : o)))
        updateObject(boardId, action.id, action.next).catch((e) => console.error('Redo RESIZE', e))
        break
      }
      case 'TEXT': {
        const update = action.part === 'body' ? { body_text: action.newText } : { text: action.newText }
        setObjects((prev) => prev.map((o) => (o.id === action.id ? { ...o, ...update } : o)))
        updateObject(boardId, action.id, update).catch((e) => console.error('Redo TEXT', e))
        break
      }
      case 'COLOR': {
        for (const [id, color] of Object.entries(action.newColors)) {
          setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, color } : o)))
          updateObject(boardId, id, { color }).catch((e) => console.error('Redo COLOR', e))
        }
        break
      }
      case 'Z_INDEX': {
        for (const [id, z_index] of Object.entries(action.newZIndices)) {
          setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, z_index } : o)))
          updateObject(boardId, id, { z_index }).catch((e) => console.error('Redo Z_INDEX', e))
        }
        break
      }
    }
  }, [boardId])
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    getBoard(boardId)
      .then((b) => {
        if (!cancelled) setBoard(b ?? null)
      })
      .catch((err: unknown) => {
        console.error('getBoard failed', err)
        if (!cancelled) setBoard(null)
      })
    return () => {
      cancelled = true
    }
  }, [boardId])

  useEffect(() => {
    let cancelled = false
    getMyRole(boardId, user.uid)
      .then((role) => {
        if (!cancelled) {
          setMyRole(role)
          if (role === 'viewer') setActiveTool(null)
        }
      })
      .catch(() => {
        if (!cancelled) setMyRole(null)
      })
    return () => {
      cancelled = true
    }
  }, [boardId, user.uid])

  useEffect(() => {
    let cancelled = false
    listBoardMembers(boardId)
      .then((members) => {
        if (!cancelled) setHasOtherMembers(members.length > 1)
      })
      .catch(() => {
        if (!cancelled) setHasOtherMembers(false)
      })
    return () => {
      cancelled = true
    }
  }, [boardId])

  const handleOptimisticAdd = useCallback((obj: BoardObject) => {
    setObjects((prev) => [...prev, obj])
    setCreateError(null)
    pushUndo({ type: 'CREATE', objects: [obj] })
  }, [pushUndo])

  const handleAddFailed = useCallback((id: string, addErr: unknown) => {
    setObjects((prev) => prev.filter((o) => o.id !== id))
    setCreateError(addErr instanceof Error ? addErr.message : String(addErr))
    popFailedCreate(id)
  }, [popFailedCreate])

  const lastMovedIdsRef = useRef<{ ids: Set<string>; t: number }>({ ids: new Set(), t: 0 })
  const DRAG_GUARD_MS = 600

  /** Clear connector endpoint overrides when a connected object moves so connectors stay attached (Option C). */
  const clearConnectorOverridesFor = useCallback(
    (movedIds: string[]) => {
      if (movedIds.length === 0) return
      const movedSet = new Set(movedIds)
      setObjects((prev) => {
        const next = [...prev]
        let changed = false
        for (let i = 0; i < next.length; i++) {
          const o = next[i]
          if (o.type !== 'connector') continue
          const attached = (o.from_id && movedSet.has(o.from_id)) || (o.to_id && movedSet.has(o.to_id))
          if (!attached) continue
          if (o.from_x !== undefined || o.from_y !== undefined || o.to_x !== undefined || o.to_y !== undefined) {
            const { from_x, from_y, to_x, to_y, ...rest } = o
            next[i] = rest as BoardObject
            changed = true
            updateObject(boardId, o.id, { from_x: null, from_y: null, to_x: null, to_y: null }).catch((err: unknown) =>
              console.error('Failed to clear connector overrides', err)
            )
          }
        }
        return changed ? next : prev
      })
    },
    [boardId]
  )

  const handleObjectMoved = useCallback(
    (id: string, x: number, y: number) => {
      lastMovedIdsRef.current.ids.add(id)
      lastMovedIdsRef.current.t = Date.now()
      finalPositionsRef.current.set(id, { x, y })
      setObjects((prev) => {
        const next = prev.map((o) => (o.id === id ? { ...o, x, y } : o))
        const movedSet = new Set([id])
        for (let i = 0; i < next.length; i++) {
          const o = next[i]
          if (o.type !== 'connector') continue
          const attached = (o.from_id && movedSet.has(o.from_id)) || (o.to_id && movedSet.has(o.to_id))
          if (!attached) continue
          if (o.from_x !== undefined || o.from_y !== undefined || o.to_x !== undefined || o.to_y !== undefined) {
            const { from_x, from_y, to_x, to_y, ...rest } = o
            next[i] = rest as BoardObject
            updateObject(boardId, o.id, { from_x: null, from_y: null, to_x: null, to_y: null }).catch((err: unknown) =>
              console.error('Failed to clear connector overrides', err)
            )
          }
        }
        return next
      })
    },
    [boardId]
  )

  const handleObjectParentChange = useCallback((id: string, parentId: string | null) => {
    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, parent_id: parentId ?? undefined } : o))
    )
  }, [])

  const handleDragStart = useCallback(
    (id: string) => {
      draggingIdRef.current = id
      // Always capture start positions (single + multi) for undo tracking
      const positions = new Map<string, { x: number; y: number }>()
      for (const obj of objects) {
        if (selectedIds.includes(obj.id)) {
          positions.set(obj.id, { x: obj.x, y: obj.y })
        }
      }
      // Also capture the dragged object itself in case it isn't in selectedIds yet
      if (!positions.has(id)) {
        const dragged = objects.find((o) => o.id === id)
        if (dragged) positions.set(id, { x: dragged.x, y: dragged.y })
      }
      moveStartRef.current = new Map(positions)
      finalPositionsRef.current = new Map(positions)
      if (selectedIds.includes(id) && selectedIds.length > 1) {
        dragStartPositionsRef.current = positions
      }
    },
    [selectedIds, objects]
  )

  const handleDragEnd = useCallback(() => {
    const id = draggingIdRef.current
    if (id) {
      lastMovedIdsRef.current.ids.add(id)
      lastMovedIdsRef.current.t = Date.now()
    }
    // Build MOVE undo entry using synchronously-tracked positions (timing-safe)
    const startPositions = moveStartRef.current
    const finalPositions = finalPositionsRef.current
    if (startPositions.size > 0) {
      const moves: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = []
      for (const [selId, start] of startPositions) {
        const final = finalPositions.get(selId)
        if (final && (Math.abs(final.x - start.x) > 0.5 || Math.abs(final.y - start.y) > 0.5)) {
          moves.push({ id: selId, prevX: start.x, prevY: start.y, newX: final.x, newY: final.y })
        }
      }
      if (moves.length > 0) pushUndo({ type: 'MOVE', moves })
    }
    if (selectedIds.length > 0) {
      setObjects((prev) => {
        for (const selId of selectedIds) {
          const o = prev.find((x) => x.id === selId)
          if (o) {
            updateObject(boardId, selId, { x: o.x, y: o.y }).catch((err: unknown) =>
              console.error('Failed to update object position after drag', err)
            )
          }
        }
        return prev
      })
      clearConnectorOverridesFor(selectedIds)
    }
    draggingIdRef.current = null
    dragStartPositionsRef.current = new Map()
    moveStartRef.current = new Map()
    finalPositionsRef.current = new Map()
  }, [boardId, selectedIds, clearConnectorOverridesFor, pushUndo])

  /** Called during multi-drag with the dragged object's current absolute Konva position.
   *  Computes delta from the frozen drag-start position so all selected objects move correctly
   *  regardless of how many React re-renders have occurred since drag started. */
  const handleMultiDragMove = useCallback(
    (movedId: string, currentX: number, currentY: number) => {
      if (selectedIds.length <= 1) return
      const movedStart = dragStartPositionsRef.current.get(movedId)
      if (!movedStart) return
      const deltaX = currentX - movedStart.x
      const deltaY = currentY - movedStart.y
      // Synchronously track final positions for undo (avoids stale-closure timing issues)
      for (const selId of selectedIds) {
        const start = dragStartPositionsRef.current.get(selId)
        if (start) finalPositionsRef.current.set(selId, { x: start.x + deltaX, y: start.y + deltaY })
      }
      setObjects((prev) =>
        prev.map((o) => {
          if (!selectedIds.includes(o.id)) return o
          const start = dragStartPositionsRef.current.get(o.id)
          if (!start) return o
          return { ...o, x: start.x + deltaX, y: start.y + deltaY }
        })
      )
    },
    [selectedIds]
  )

  /** Last positions applied during selection-drag-from-empty (used to persist on drag end) */
  const selectionDragLastPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const handleSelectionDragStart = useCallback(
    (_worldPos: { x: number; y: number }) => {
      // Populate synchronously so refs are ready before the first mousemove fires.
      const positions = new Map<string, { x: number; y: number }>()
      for (const obj of objects) {
        if (selectedIds.includes(obj.id)) positions.set(obj.id, { x: obj.x, y: obj.y })
      }
      dragStartPositionsRef.current = positions
      selectionDragLastPositionsRef.current = new Map(positions)
    },
    [selectedIds, objects]
  )

  const handleSelectionDragMove = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedIds.length === 0) return
      setObjects((prev) =>
        prev.map((o) => {
          if (!selectedIds.includes(o.id)) return o
          const start = dragStartPositionsRef.current.get(o.id)
          if (!start) return o
          const newX = start.x + deltaX
          const newY = start.y + deltaY
          selectionDragLastPositionsRef.current.set(o.id, { x: newX, y: newY })
          return { ...o, x: newX, y: newY }
        })
      )
    },
    [selectedIds]
  )

  const handleSelectionDragEnd = useCallback(() => {
    const toPersist = selectionDragLastPositionsRef.current
    const startPositions = dragStartPositionsRef.current
    const movedIds = Array.from(toPersist.keys())
    // Build MOVE undo entry
    const moves: { id: string; prevX: number; prevY: number; newX: number; newY: number }[] = []
    for (const [id, final] of toPersist) {
      const start = startPositions.get(id)
      if (start && (Math.abs(final.x - start.x) > 0.5 || Math.abs(final.y - start.y) > 0.5)) {
        moves.push({ id, prevX: start.x, prevY: start.y, newX: final.x, newY: final.y })
      }
    }
    if (moves.length > 0) pushUndo({ type: 'MOVE', moves })
    for (const [id, pos] of toPersist) {
      updateObject(boardId, id, { x: pos.x, y: pos.y }).catch((err: unknown) =>
        console.error('Failed to update object position after selection drag', err)
      )
    }
    clearConnectorOverridesFor(movedIds)
    dragStartPositionsRef.current = new Map()
    selectionDragLastPositionsRef.current = new Map()
  }, [boardId, clearConnectorOverridesFor, pushUndo])

  const lastLocalResizeRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })
  const draggingIdRef = useRef<string | null>(null)
  const dragChannelRef = useRef<RealtimeChannel | null>(null)

  const handleObjectResized = useCallback(
    (id: string, payload: { x: number; y: number; width: number; height: number; rotation?: number }) => {
      const { x, y, width, height, rotation } = payload
      lastLocalResizeRef.current = { id, t: Date.now() }
      // Snapshot prev state from objectsRef (called once on transformend, so timing is reliable)
      const prevObj = objectsRef.current.find((o) => o.id === id)
      if (prevObj) {
        pushUndo({
          type: 'RESIZE',
          id,
          prev: { x: prevObj.x, y: prevObj.y, width: prevObj.width, height: prevObj.height, rotation: prevObj.rotation },
          next: { x, y, width, height, rotation },
        })
      }
      setObjects((prev) =>
        prev.map((o) => (o.id === id ? { ...o, x, y, width, height, rotation: rotation ?? o.rotation } : o))
      )
      updateObject(boardId, id, { x, y, width, height, ...(rotation !== undefined ? { rotation } : {}) }).catch(
        (err: unknown) => console.error('Failed to update object size/rotation', err)
      )
    },
    [boardId, pushUndo]
  )

  const setObjectsFromSubscription = useCallback((data: BoardObject[]) => {
    setObjects((prev) => {
      if (data.length === 0 && prev.length > 0) return prev
      const { ids: movedIds, t: movedT } = lastMovedIdsRef.current
      const inGuard = movedIds.size > 0 && Date.now() - movedT < DRAG_GUARD_MS
      if (!inGuard) {
        lastMovedIdsRef.current.ids.clear()
        return data
      }
      const prevById = new Map(prev.map((o) => [o.id, o]))
      const dataIds = new Set(data.map((o) => o.id))
      const merged = data.map((fetched) => {
        const existing = prevById.get(fetched.id)
        if (existing && movedIds.has(fetched.id)) {
          return { ...fetched, x: existing.x, y: existing.y, parent_id: existing.parent_id ?? fetched.parent_id }
        }
        return fetched
      })
      const missingFromFetch = prev.filter((o) => movedIds.has(o.id) && !dataIds.has(o.id))
      return [...merged, ...missingFromFetch]
    })
  }, [])

  const handleRealtimeObjectChange = useCallback(
    (change: import('../supabase/objects.ts').RealtimeObjectChange) => {
      if (change.event === 'DELETE') {
        setObjects((prev) => prev.filter((o) => o.id !== change.old.id))
        return
      }
      if (change.event === 'UPDATE' && change.new.id === draggingIdRef.current) return
      const obj = change.new
      setObjects((prev) => {
        const idx = prev.findIndex((o) => o.id === obj.id)
        if (idx === -1) return [...prev, obj]
        const existing = prev[idx]
        const { id: lastId, t } = lastLocalResizeRef.current
        const justResized = obj.id === lastId && Date.now() - t < 1500
        const { ids: movedIds, t: movedT } = lastMovedIdsRef.current
        const justDragged =
          change.event === 'UPDATE' &&
          movedIds.has(obj.id) &&
          Date.now() - movedT < DRAG_GUARD_MS
        const next = [...prev]
        if (change.event === 'UPDATE' && justResized) {
          next[idx] = {
            ...obj,
            x: existing.x,
            y: existing.y,
            width: existing.width,
            height: existing.height,
            rotation: existing.rotation ?? obj.rotation,
          }
        } else if (justDragged) {
          next[idx] = {
            ...obj,
            x: existing.x,
            y: existing.y,
            parent_id: existing.parent_id ?? obj.parent_id,
          }
        } else {
          next[idx] = obj
        }
        return next
      })
    },
    []
  )

  useEffect(() => {
    setSelectedIds([])
    undoStackRef.current = []
    redoStackRef.current = []
    setUndoCount(0)
    setRedoCount(0)
  }, [boardId])

  const shouldScheduleRefetch = useCallback((change: import('../supabase/objects.ts').RealtimeObjectChange) => {
    if (change.event !== 'UPDATE') return true
    const { ids, t } = lastMovedIdsRef.current
    if (ids.has(change.new.id) && Date.now() - t < DRAG_GUARD_MS) return false
    return true
  }, [])

  useEffect(() => {
    const unsub = subscribeObjects(
      boardId,
      setObjectsFromSubscription,
      handleRealtimeObjectChange,
      shouldScheduleRefetch
    )
    return unsub
  }, [boardId, setObjectsFromSubscription, handleRealtimeObjectChange, shouldScheduleRefetch])

  useEffect(() => {
    const result = subscribeDragMoves(boardId, ({ userId, objectId, x, y }) => {
      if (userId === user.uid) return
      setObjects((prev) => prev.map((o) => (o.id === objectId ? { ...o, x, y } : o)))
    })
    if (!result) return
    const [channel, unsubscribe] = result
    dragChannelRef.current = channel
    return () => {
      unsubscribe()
      dragChannelRef.current = null
    }
  }, [boardId, user.uid])

  const handleBroadcastDragMove = useCallback(
    (id: string, x: number, y: number) => {
      if (!dragChannelRef.current) return
      sendDragMove(dragChannelRef.current, { userId: user.uid, objectId: id, x, y })
    },
    [user.uid]
  )

  /** Duplicate all selected objects with a slight position offset */
  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 0) return
    const toDuplicate = objects.filter((o) => selectedIds.includes(o.id))
    const newIds: string[] = []
    const newObjects: BoardObject[] = []
    for (const obj of toDuplicate) {
      const newId = crypto.randomUUID()
      newIds.push(newId)
      const newObj: BoardObject = { ...obj, id: newId, x: obj.x + 20, y: obj.y + 20 }
      newObjects.push(newObj)
      setObjects((prev) => [...prev, newObj])
      addObject(boardId, newObj).catch((err: unknown) => {
        console.error('Failed to duplicate object', err)
        setObjects((prev) => prev.filter((o) => o.id !== newId))
        popFailedCreate(newId)
      })
    }
    if (newObjects.length > 0) pushUndo({ type: 'CREATE', objects: newObjects })
    setSelectedIds(newIds)
  }, [boardId, objects, selectedIds, pushUndo, popFailedCreate])

  const getFrameDescendantIds = useCallback((frameId: string): Set<string> => {
    const result = new Set<string>()
    const collect = (id: string) => {
      objects.filter((o) => o.parent_id === id).forEach((c) => {
        result.add(c.id)
        if (c.type === 'frame') collect(c.id)
      })
    }
    collect(frameId)
    return result
  }, [objects])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const idsToDelete = new Set(selectedIds)
    for (const id of selectedIds) {
      const obj = objects.find((o) => o.id === id)
      if (obj?.type === 'frame') {
        getFrameDescendantIds(id).forEach((descId) => idsToDelete.add(descId))
      }
    }
    // Snapshot deleted objects for undo before removing from state
    const deletedObjects = objects.filter((o) => idsToDelete.has(o.id))
    if (deletedObjects.length > 0) pushUndo({ type: 'DELETE', objects: deletedObjects })
    const arr = Array.from(idsToDelete)
    setSelectedIds([])
    setObjects((prev) => prev.filter((o) => !idsToDelete.has(o.id)))
    for (const id of arr) {
      deleteObject(boardId, id).catch((err: unknown) => console.error('Failed to delete object', err))
    }
  }, [boardId, selectedIds, objects, getFrameDescendantIds, pushUndo])

  const handleBringToFront = useCallback(() => {
    if (selectedIds.length === 0) return
    const expandedIds = new Set(selectedIds)
    for (const id of selectedIds) {
      const obj = objects.find((o) => o.id === id)
      if (obj?.type === 'frame') getFrameDescendantIds(id).forEach((d) => expandedIds.add(d))
    }
    const idsArray = Array.from(expandedIds)
    const maxZ = objects.reduce((m, o) => Math.max(m, o.z_index ?? 0), 0)
    const prevZIndices: Record<string, number> = {}
    const newZIndices: Record<string, number> = {}
    idsArray.forEach((id, i) => {
      prevZIndices[id] = objects.find((o) => o.id === id)?.z_index ?? 0
      newZIndices[id] = maxZ + 1 + i
    })
    setObjects((prev) => prev.map((o) => expandedIds.has(o.id) ? { ...o, z_index: newZIndices[o.id] } : o))
    pushUndo({ type: 'Z_INDEX', prevZIndices, newZIndices })
    for (const id of idsArray) {
      updateObject(boardId, id, { z_index: newZIndices[id] }).catch((e) => console.error('bringToFront', e))
    }
  }, [boardId, selectedIds, objects, getFrameDescendantIds, pushUndo])

  const handleSendToBack = useCallback(() => {
    if (selectedIds.length === 0) return
    const expandedIds = new Set(selectedIds)
    for (const id of selectedIds) {
      const obj = objects.find((o) => o.id === id)
      if (obj?.type === 'frame') getFrameDescendantIds(id).forEach((d) => expandedIds.add(d))
    }
    const idsArray = Array.from(expandedIds)
    const minZ = objects.reduce((m, o) => Math.min(m, o.z_index ?? 0), 0)
    const prevZIndices: Record<string, number> = {}
    const newZIndices: Record<string, number> = {}
    idsArray.forEach((id, i) => {
      prevZIndices[id] = objects.find((o) => o.id === id)?.z_index ?? 0
      newZIndices[id] = minZ - idsArray.length + i
    })
    setObjects((prev) => prev.map((o) => expandedIds.has(o.id) ? { ...o, z_index: newZIndices[o.id] } : o))
    pushUndo({ type: 'Z_INDEX', prevZIndices, newZIndices })
    for (const id of idsArray) {
      updateObject(boardId, id, { z_index: newZIndices[id] }).catch((e) => console.error('sendToBack', e))
    }
  }, [boardId, selectedIds, objects, getFrameDescendantIds, pushUndo])

  const handleConnectorMoved = useCallback(
    (id: string, fromX: number, fromY: number, toX: number, toY: number) => {
      setObjects((prev) =>
        prev.map((o) =>
          o.id === id && o.type === 'connector'
            ? { ...o, from_x: fromX, from_y: fromY, to_x: toX, to_y: toY }
            : o
        )
      )
      updateObject(boardId, id, { from_x: fromX, from_y: fromY, to_x: toX, to_y: toY }).catch(
        (err: unknown) => console.error('Failed to update connector position', err)
      )
    },
    [boardId]
  )

  const handleConnectorResized = useCallback(
    (id: string, fromX: number, fromY: number, toX: number, toY: number) => {
      setObjects((prev) =>
        prev.map((o) =>
          o.id === id && o.type === 'connector'
            ? { ...o, from_x: fromX, from_y: fromY, to_x: toX, to_y: toY }
            : o
        )
      )
      updateObject(boardId, id, { from_x: fromX, from_y: fromY, to_x: toX, to_y: toY }).catch(
        (err: unknown) => console.error('Failed to update connector resize', err)
      )
    },
    [boardId]
  )

  /** Handle connector creation between two objects (style from connector tool picker) */
  const handleConnectorCreated = useCallback(
    (fromId: string, toId: string, style: ConnectorStyle = 'arrow') => {
      const id = crypto.randomUUID()
      const connector: BoardObject = {
        id,
        type: 'connector',
        from_id: fromId,
        to_id: toId,
        style,
        color: DEFAULT_CONNECTOR_COLOR,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      }
      setObjects((prev) => [...prev, connector])
      pushUndo({ type: 'CREATE', objects: [connector] })
      addObject(boardId, connector).catch((err: unknown) => {
        console.error('Failed to create connector', err)
        setObjects((prev) => prev.filter((o) => o.id !== id))
        popFailedCreate(id)
      })
    },
    [boardId, pushUndo, popFailedCreate]
  )

  /** When connector tool active: set default style. When connector(s) selected: update their style and persist. */
  const handleConnectorStyleChange = useCallback(
    (style: ConnectorStyle) => {
      const selectedConnectorIds = selectedIds.filter(
        (id) => objects.find((o) => o.id === id)?.type === 'connector'
      )
      if (selectedConnectorIds.length > 0) {
        for (const id of selectedConnectorIds) {
          setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, style } : o)))
          updateObject(boardId, id, { style }).catch((err: unknown) =>
            console.error('Failed to update connector style', err)
          )
        }
      } else {
        setConnectorStyle(style)
      }
    },
    [boardId, selectedIds, objects]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return
      const isTyping = () => {
        const el = document.activeElement
        if (!el || !(el instanceof HTMLElement)) return false
        const tag = el.tagName.toLowerCase()
        return tag === 'input' || tag === 'textarea' || el.isContentEditable
      }
      if (isTyping()) return

      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrl = isMac ? e.metaKey : e.ctrlKey

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault()
        handleDeleteSelected()
      } else if (ctrl && e.key === 'd') {
        e.preventDefault()
        handleDuplicate()
      } else if (ctrl && e.key === 'c') {
        e.preventDefault()
        clipboardRef.current = objects.filter((o) => selectedIds.includes(o.id))
      } else if (ctrl && e.key === 'v') {
        e.preventDefault()
        const clipboard = clipboardRef.current
        if (clipboard.length === 0) return
        const newIds: string[] = []
        const pastedObjects: BoardObject[] = []
        for (const obj of clipboard) {
          const newId = crypto.randomUUID()
          newIds.push(newId)
          const newObj: BoardObject = { ...obj, id: newId, x: obj.x + 30, y: obj.y + 30 }
          pastedObjects.push(newObj)
          setObjects((prev) => [...prev, newObj])
          addObject(boardId, newObj).catch((err: unknown) => {
            console.error('Failed to paste object', err)
            setObjects((prev) => prev.filter((o) => o.id !== newId))
            popFailedCreate(newId)
          })
        }
        if (pastedObjects.length > 0) pushUndo({ type: 'CREATE', objects: pastedObjects })
        // Update clipboard positions so repeated paste keeps offsetting
        clipboardRef.current = clipboard.map((o) => ({ ...o, x: o.x + 30, y: o.y + 30 }))
        setSelectedIds(newIds)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [boardId, selectedIds, editingId, objects, handleDeleteSelected, handleDuplicate, handleUndo, handleRedo, pushUndo, popFailedCreate])

  const handleStartEditText = useCallback((id: string, text: string, part?: 'header' | 'body') => {
    setEditingId(id)
    setEditingPart(part ?? null)
    setEditingText(text)
  }, [])

  const handleSaveEditText = useCallback(() => {
    if (!editingId) {
      setEditingId(null)
      setEditingPart(null)
      setEditingText('')
      return
    }
    const id = editingId
    const part = editingPart
    const rawText = editingText
    const textResult = validateObjectText(rawText)
    if (!textResult.valid) return
    const newText = sanitizeObjectText(rawText)
    const obj = objects.find((o) => o.id === id)
    const prevText = part === 'body' ? (obj?.body_text ?? '') : (obj?.text ?? '')
    if (newText !== prevText) pushUndo({ type: 'TEXT', id, part, prevText, newText })
    setEditingId(null)
    setEditingPart(null)
    setEditingText('')
    const update = part === 'body' ? { body_text: newText } : { text: newText }
    setObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...update } : o))
    )
    updateObject(boardId, id, update).catch((err: unknown) => {
      console.error('Failed to save text', err)
      setObjects((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...(part === 'body' ? { body_text: prevText } : { text: prevText }) } : o))
      )
    })
  }, [boardId, editingId, editingPart, editingText, objects, pushUndo])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditingPart(null)
    setEditingText('')
  }, [])

  const selectedObject =
    selectedIds.length === 1 ? (objects.find((o) => o.id === selectedIds[0]) ?? null) : null

  const selectedColorableId =
    selectedObject &&
    ['sticky', 'rect', 'circle', 'line', 'frame', 'connector', 'text'].includes(selectedObject.type)
      ? selectedIds[0]
      : null

  const handleColorChange = useCallback(
    (color: string) => {
      // Snapshot prev colors for undo
      const prevColors: Record<string, string> = {}
      for (const id of selectedIds) {
        const obj = objectsRef.current.find((o) => o.id === id)
        if (obj?.color && obj.color !== color) prevColors[id] = obj.color
      }
      if (Object.keys(prevColors).length > 0) {
        const newColors: Record<string, string> = {}
        for (const id of Object.keys(prevColors)) newColors[id] = color
        pushUndo({ type: 'COLOR', prevColors, newColors })
      }
      for (const id of selectedIds) {
        setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, color } : o)))
        updateObject(boardId, id, { color }).catch((err: unknown) =>
          console.error('Failed to update color', err)
        )
      }
    },
    [boardId, selectedIds, pushUndo]
  )

  const handleResize = useCallback(
    (width: number, height: number) => {
      if (!selectedIds[0]) return
      const id = selectedIds[0]
      setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, width, height } : o)))
      updateObject(boardId, id, { width, height }).catch((err: unknown) =>
        console.error('Failed to resize', err)
      )
    },
    [boardId, selectedIds]
  )

  const handleSignOut = useCallback(async () => {
    removeAllCursorsForUser(user.uid)
    await removePresence(user.uid)
    signOut()
  }, [user.uid])

  /** Create object at viewport center when user clicks a create tool button */
  const handleCreateFromToolbar = useCallback(
    (tool: 'sticky' | 'rect' | 'circle' | 'frame' | 'text') => {
      const { x, y } = viewportCenterRef.current
      const id = crypto.randomUUID()
      let newObj: BoardObject
      if (tool === 'sticky') {
        newObj = { id, type: 'sticky', x, y, width: STICKY_WIDTH, height: STICKY_HEIGHT, text: '', color: DEFAULT_STICKY_COLOR }
      } else if (tool === 'rect') {
        newObj = { id, type: 'rect', x, y, width: STICKY_WIDTH, height: STICKY_HEIGHT, color: DEFAULT_SHAPE_COLOR }
      } else if (tool === 'circle') {
        newObj = { id, type: 'circle', x, y, width: CIRCLE_DIAMETER, height: CIRCLE_DIAMETER, color: DEFAULT_SHAPE_COLOR }
      } else if (tool === 'frame') {
        newObj = { id, type: 'frame', x, y, width: FRAME_DEFAULT_WIDTH, height: FRAME_DEFAULT_HEIGHT, text: '', color: DEFAULT_FRAME_COLOR }
      } else {
        newObj = { id, type: 'text', x, y, width: 200, height: 80, text: '', font_size: TEXT_DEFAULT_FONT_SIZE, font_color: DEFAULT_TEXT_COLOR }
      }
      const boundedObjects = objects
        .filter((o) => o.width > 0 && o.height > 0)
        .map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height }))
      const newObjRect = { x: newObj.x, y: newObj.y, width: newObj.width, height: newObj.height }
      let didReposition = false
      if (doesRectOverlapAny(newObjRect, boundedObjects, 2)) {
        const bounds = viewportBoundsRef.current
        const empty =
          bounds && bounds.width > 0 && bounds.height > 0
            ? findEmptyPositionInViewport(
                { width: newObj.width, height: newObj.height },
                boundedObjects,
                bounds
              )
            : null
        const finalEmpty =
          empty ?? findEmptyPositionOutsideCluster(
            { width: newObj.width, height: newObj.height },
            boundedObjects
          )
        newObj.x = finalEmpty.x
        newObj.y = finalEmpty.y
        didReposition = true
      }
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
      setObjects((prev) => [...prev, newObj])
      setCreateError(null)
      setSelectedIds([id])
      setActiveTool(null)
      if (didReposition) {
        setPanToWorldPosition({ x: newObj.x, y: newObj.y })
      }
      pushUndo({ type: 'CREATE', objects: [newObj] })
      addObject(boardId, newObj).catch((err: unknown) => {
        console.error('Failed to create object', err)
        setObjects((prev) => prev.filter((o) => o.id !== id))
        popFailedCreate(id)
      })
    },
    [boardId, objects, pushUndo, popFailedCreate]
  )

  const handleClearBoard = useCallback(() => {
    deleteAllObjects(boardId, user.uid)
      .then(() => setObjects([]))
      .catch((err: unknown) => console.error('Failed to clear board', err))
  }, [boardId, user.uid])

  const handleBackToBoards = useCallback(() => {
    navigate('/')
  }, [navigate])

  useEffect(() => {
    aiChatScrollRef.current?.scrollTo({ top: aiChatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [aiChatMessages, aiLoading])

  // Auto-remove error messages when back online (clears stale offline errors)
  useEffect(() => {
    const handleOnline = () => {
      setAiChatMessages((prev) =>
        prev.filter((msg) => {
          if (msg.isError) return false
          if (normalizeAiMessageContent(msg.content) === AI_CONNECTION_ERROR_MSG) return false
          return true
        })
      )
      setCreateError(null)
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const handleRunAI = useCallback(async () => {
    const prompt = sanitizeAIPrompt(aiPrompt)
    const result = validateAIPrompt(prompt)
    if (!result.valid) {
      setAiPromptValidationError(result.error ?? 'Enter a message')
      return
    }
    setAiPromptValidationError(null)
    setAiPrompt('')
    setAiLoading(true)
    setAiChatMessages((prev) => [...prev, { role: 'user', content: prompt }])
    try {
      const viewport = viewportBoundsRef.current
        ? { bounds: viewportBoundsRef.current }
        : undefined
      const result = await runAICommand(prompt, objects, boardId, viewport)
      if (result.error) {
        setAiChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: normalizeAiMessageContent(result.error), isError: true },
        ])
      } else {
        setAiChatMessages((prev) => [
          ...prev.filter((msg) => !msg.isError),
          { role: 'assistant', content: result.text },
        ])
        if (result.createdCenter) {
          const center = result.createdCenter
          setTimeout(() => setPanToWorldPosition(center), 150)
        }
      }
    } catch (err: unknown) {
      setAiChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: normalizeAiMessageContent(err), isError: true },
      ])
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, objects, boardId])

  const editingObject = editingId ? (objects.find((o) => o.id === editingId) ?? null) : null

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-indigo-950 via-purple-950 to-violet-900">
      <TopBar
        dark
        presenceNames={presenceNames}
        onSignOut={handleSignOut}
        boardTitle={boardName}
        onBackToBoards={handleBackToBoards}
        onClearBoard={myRole === 'owner' ? handleClearBoard : undefined}
        isShared={hasOtherMembers}
        onShareClick={() => setShowShareModal(true)}
        disableGlassBlur={showShareModal}
      />
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          board={board}
          boardId={boardId}
          currentUserId={user.uid}
          isOwner={myRole === 'owner'}
          onBoardUpdated={() => {
            getBoard(boardId).then((b) => setBoard(b ?? null))
            getMyRole(boardId, user.uid).then((role) => setMyRole(role))
            listBoardMembers(boardId).then((members) => setHasOtherMembers(members.length > 1))
          }}
        />
      )}
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onCreateClick={handleCreateFromToolbar}
        showConnectorSourceHint={activeTool === 'connector' && !pendingConnectorFrom}
        connectorStyle={
          selectedObject?.type === 'connector'
            ? (['arrow', 'line', 'dashed', 'dotted'].includes(selectedObject.style ?? '')
                ? (selectedObject.style as ConnectorStyle)
                : 'arrow')
            : connectorStyle
        }
        onConnectorStyleChange={handleConnectorStyleChange}
        selectedIds={selectedIds}
        selectedObject={selectedObject}
        selectedColorableId={selectedColorableId}
        onColorChange={handleColorChange}
        onResize={handleResize}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteSelected}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoCount > 0}
        canRedo={redoCount > 0}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        isViewOnly={myRole === 'viewer'}
        disableGlassBlur={showShareModal}
      />
      {createError && (
        <div className="px-3 py-2 bg-red-500/20 text-red-300 text-sm border-b border-red-500/20" role="alert">
          Could not create object: {createError}. Try again or check your connection.
        </div>
      )}
      <div id="main-content" className="flex-1 min-h-0">
        <Canvas
          boardId={boardId}
          user={user}
          activeTool={activeTool}
          pendingConnectorFrom={pendingConnectorFrom}
          onPendingConnectorFromChange={setPendingConnectorFrom}
          connectorStyle={connectorStyle}
          objects={sortedObjects}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onStartEditText={handleStartEditText}
          editingObject={editingObject}
          editingPart={editingPart}
          editingText={editingText}
          onEditingTextChange={setEditingText}
          onSaveEdit={handleSaveEditText}
          onCancelEdit={handleCancelEdit}
          onOptimisticAdd={handleOptimisticAdd}
          onAddFailed={handleAddFailed}
          onObjectMoved={handleObjectMoved}
          onObjectParentChange={handleObjectParentChange}
          onObjectResized={handleObjectResized}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onAfterCreateObject={() => setActiveTool(null)}
          onBroadcastDragMove={handleBroadcastDragMove}
          onMultiDragMove={handleMultiDragMove}
          onConnectorCreated={handleConnectorCreated}
          onConnectorResized={handleConnectorResized}
          onConnectorMoved={handleConnectorMoved}
          onViewportChange={(viewport) => {
            viewportCenterRef.current = viewport.center
            viewportBoundsRef.current = viewport.bounds
          }}
          panToWorldPosition={panToWorldPosition}
          onPannedToPosition={() => setPanToWorldPosition(null)}
          onSelectionDragStart={handleSelectionDragStart}
          onSelectionDragMove={handleSelectionDragMove}
          onSelectionDragEnd={handleSelectionDragEnd}
          onEmptyCanvasClick={() => {
            if (activeTool === 'select') setActiveTool(null)
          }}
          onDuplicate={handleDuplicate}
          onDelete={handleDeleteSelected}
          isViewOnly={myRole === 'viewer'}
        />
      </div>

      {/* AI panel — vertical sidebar */}
      {showAIPanel && (
        <div className={`fixed right-0 bottom-0 w-72 h-[60vh] min-h-[280px] z-30 flex flex-col bg-slate-900/85 border-l border-t border-white/[0.10] shadow-2xl rounded-tl-xl pointer-events-auto will-change-transform ${showShareModal ? '' : 'backdrop-blur-xl'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.08]">
            <span className="text-sm font-medium text-white/90">AI Assistant</span>
            <div className="flex items-center gap-1">
              {aiChatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAiChatMessages([])}
                  className="px-2 py-1 text-xs rounded-lg text-white/50 hover:bg-white/10 hover:text-white/80 cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus:outline-none"
                  aria-label="Clear chat history"
                  title="Clear chat"
                >
                  Clear
                </button>
              )}
            <button
              type="button"
              onClick={() => {
                setShowAIPanel(false)
                setAiChatMessages([])
              }}
              className="p-1.5 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/80 cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus:outline-none"
              aria-label="Close AI panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>
          {/* Chat history */}
          <div ref={aiChatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
            {aiChatMessages.length === 0 && !aiLoading && (
              <p className="text-sm text-white/35 text-center py-6">Send a command to get started.</p>
            )}
            {aiChatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : msg.isError
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-white/[0.08] text-white/80'
                  }`}
                >
                  {normalizeAiMessageContent(msg.content)}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl text-sm bg-white/[0.08] text-white/50">
                  Thinking…
                </div>
              </div>
            )}
          </div>
          {/* Vertical input area */}
          <div className="flex flex-col gap-2 p-3 border-t border-white/[0.08]">
            <div className="relative">
              <label htmlFor="ai-prompt-input" className="sr-only">
                AI command
              </label>
              <textarea
                id="ai-prompt-input"
                placeholder="Write your message and press Enter"
                autoComplete="off"
                value={aiPrompt}
                onChange={(e) => {
                  setAiPrompt(e.target.value)
                  setAiPromptValidationError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleRunAI())}
                disabled={aiLoading}
                rows={3}
                className={`w-full resize-none px-3 py-2.5 text-sm bg-white/[0.08] border rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 text-white placeholder:text-white/35 ${aiPromptValidationError ? 'border-red-500 focus-visible:border-transparent' : 'border-white/10 focus-visible:border-transparent'}`}
                aria-invalid={!!aiPromptValidationError}
                aria-describedby={aiPromptValidationError ? 'ai-prompt-input-error' : undefined}
              />
              {aiPromptValidationError && (
                <div
                  id="ai-prompt-input-error"
                  role="alert"
                  className="absolute left-0 top-full mt-1 z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg max-w-[280px]"
                >
                  {aiPromptValidationError}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleRunAI}
              disabled={aiLoading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium cursor-pointer disabled:opacity-70 disabled:cursor-wait hover:bg-violet-700 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus:outline-none"
              aria-label={aiLoading ? 'Running…' : 'Send'}
            >
              {aiLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                  Running…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* AI button fixed bottom-right — hidden when panel is open */}
      {!showAIPanel && (
        <div className="fixed right-6 bottom-6 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowAIPanel(true)}
            className={`flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800/80 text-violet-300 hover:bg-slate-700/80 active:scale-95 transition-all duration-200 shadow-lg border border-white/[0.12] focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 will-change-transform ${showShareModal ? '' : 'backdrop-blur-md'}`}
            aria-label="Open AI panel"
          >
            <GeminiIcon className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
