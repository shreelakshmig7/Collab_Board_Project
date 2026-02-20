/** Board page: main whiteboard view with toolbar, canvas, object selection, and AI assistant panel. */
import { useState, useEffect, useCallback, useRef } from 'react'
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

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
    </svg>
  )
}

type BoardPageProps = { user: AppUser; boardId: string; boardName: string; presenceNames: string[] }

export default function BoardPage({ user, boardId, boardName, presenceNames }: BoardPageProps) {
  const navigate = useNavigate()
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [connectorStyle, setConnectorStyle] = useState<ConnectorStyle>('arrow')
  const [pendingConnectorFrom, setPendingConnectorFrom] = useState<string | null>(null)
  const [objects, setObjects] = useState<BoardObject[]>([])
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
  const aiChatScrollRef = useRef<HTMLDivElement>(null)

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
  }, [])

  const handleAddFailed = useCallback((id: string, addErr: unknown) => {
    setObjects((prev) => prev.filter((o) => o.id !== id))
    setCreateError(addErr instanceof Error ? addErr.message : String(addErr))
  }, [])

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
      if (selectedIds.includes(id) && selectedIds.length > 1) {
        setObjects((prev) => {
          const positions = new Map<string, { x: number; y: number }>()
          for (const obj of prev) {
            if (selectedIds.includes(obj.id)) {
              positions.set(obj.id, { x: obj.x, y: obj.y })
            }
          }
          dragStartPositionsRef.current = positions
          return prev
        })
      }
    },
    [selectedIds]
  )

  const handleDragEnd = useCallback(() => {
    const id = draggingIdRef.current
    if (id) {
      lastMovedIdsRef.current.ids.add(id)
      lastMovedIdsRef.current.t = Date.now()
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
  }, [boardId, selectedIds, clearConnectorOverridesFor])

  /** Called during multi-drag: move all selected objects (including the dragged one) by the same delta so state stays in sync and the dragged object does not snap back on re-render */
  const handleMultiDragMove = useCallback(
    (_movedId: string, deltaX: number, deltaY: number) => {
      if (selectedIds.length <= 1) return
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
      setObjects((prev) => {
        const positions = new Map<string, { x: number; y: number }>()
        for (const obj of prev) {
          if (selectedIds.includes(obj.id)) positions.set(obj.id, { x: obj.x, y: obj.y })
        }
        dragStartPositionsRef.current = positions
        selectionDragLastPositionsRef.current = new Map(positions)
        return prev
      })
    },
    [selectedIds]
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
    const movedIds = Array.from(toPersist.keys())
    for (const [id, pos] of toPersist) {
      updateObject(boardId, id, { x: pos.x, y: pos.y }).catch((err: unknown) =>
        console.error('Failed to update object position after selection drag', err)
      )
    }
    clearConnectorOverridesFor(movedIds)
    dragStartPositionsRef.current = new Map()
    selectionDragLastPositionsRef.current = new Map()
  }, [boardId, clearConnectorOverridesFor])

  const lastLocalResizeRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })
  const draggingIdRef = useRef<string | null>(null)
  const dragChannelRef = useRef<RealtimeChannel | null>(null)

  const handleObjectResized = useCallback(
    (id: string, payload: { x: number; y: number; width: number; height: number; rotation?: number }) => {
      const { x, y, width, height, rotation } = payload
      lastLocalResizeRef.current = { id, t: Date.now() }
      setObjects((prev) =>
        prev.map((o) => (o.id === id ? { ...o, x, y, width, height, rotation: rotation ?? o.rotation } : o))
      )
      updateObject(boardId, id, { x, y, width, height, ...(rotation !== undefined ? { rotation } : {}) }).catch(
        (err: unknown) => console.error('Failed to update object size/rotation', err)
      )
    },
    [boardId]
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
    for (const obj of toDuplicate) {
      const newId = crypto.randomUUID()
      newIds.push(newId)
      const newObj: BoardObject = { ...obj, id: newId, x: obj.x + 20, y: obj.y + 20 }
      setObjects((prev) => [...prev, newObj])
      addObject(boardId, newObj).catch((err: unknown) => {
        console.error('Failed to duplicate object', err)
        setObjects((prev) => prev.filter((o) => o.id !== newId))
      })
    }
    setSelectedIds(newIds)
  }, [boardId, objects, selectedIds])

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
    const arr = Array.from(idsToDelete)
    setSelectedIds([])
    setObjects((prev) => prev.filter((o) => !idsToDelete.has(o.id)))
    for (const id of arr) {
      deleteObject(boardId, id).catch((err: unknown) => console.error('Failed to delete object', err))
    }
  }, [boardId, selectedIds, objects, getFrameDescendantIds])

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
      addObject(boardId, connector).catch((err: unknown) => {
        console.error('Failed to create connector', err)
        setObjects((prev) => prev.filter((o) => o.id !== id))
      })
    },
    [boardId]
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

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
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
        for (const obj of clipboard) {
          const newId = crypto.randomUUID()
          newIds.push(newId)
          const newObj: BoardObject = { ...obj, id: newId, x: obj.x + 30, y: obj.y + 30 }
          setObjects((prev) => [...prev, newObj])
          addObject(boardId, newObj).catch((err: unknown) => {
            console.error('Failed to paste object', err)
            setObjects((prev) => prev.filter((o) => o.id !== newId))
          })
        }
        // Update clipboard positions so repeated paste keeps offsetting
        clipboardRef.current = clipboard.map((o) => ({ ...o, x: o.x + 30, y: o.y + 30 }))
        setSelectedIds(newIds)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [boardId, selectedIds, editingId, objects, handleDeleteSelected, handleDuplicate])

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
  }, [boardId, editingId, editingPart, editingText, objects])

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
      for (const id of selectedIds) {
        setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, color } : o)))
        updateObject(boardId, id, { color }).catch((err: unknown) =>
          console.error('Failed to update color', err)
        )
      }
    },
    [boardId, selectedIds]
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
      addObject(boardId, newObj).catch((err: unknown) => {
        console.error('Failed to create object', err)
        setObjects((prev) => prev.filter((o) => o.id !== id))
      })
    },
    [boardId, objects]
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
      const result = await runAICommand(prompt, objects, boardId)
      if (result.error) {
        setAiChatMessages((prev) => [...prev, { role: 'assistant', content: result.error!, isError: true }])
      } else {
        setAiChatMessages((prev) => [...prev, { role: 'assistant', content: result.text }])
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setAiChatMessages((prev) => [...prev, { role: 'assistant', content: errMsg, isError: true }])
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, objects, boardId])

  const editingObject = editingId ? (objects.find((o) => o.id === editingId) ?? null) : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        presenceNames={presenceNames}
        onSignOut={handleSignOut}
        boardTitle={boardName}
        onBackToBoards={handleBackToBoards}
        onClearBoard={myRole === 'owner' ? handleClearBoard : undefined}
        isShared={hasOtherMembers}
        onShareClick={() => setShowShareModal(true)}
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
        isViewOnly={myRole === 'viewer'}
      />
      {createError && (
        <div className="px-3 py-2 bg-red-50 text-red-700 text-sm" role="alert">
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
          objects={objects}
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
          onViewportChange={(c) => { viewportCenterRef.current = c }}
          onSelectionDragStart={handleSelectionDragStart}
          onSelectionDragMove={handleSelectionDragMove}
          onSelectionDragEnd={handleSelectionDragEnd}
          onEmptyCanvasClick={() => {
            if (activeTool === 'select') setActiveTool(null)
          }}
          isViewOnly={myRole === 'viewer'}
        />
      </div>

      {/* AI panel — vertical sidebar */}
      {showAIPanel && (
        <div className="fixed right-0 bottom-0 w-72 h-[60vh] min-h-[280px] z-30 flex flex-col bg-white border-l border-t border-gray-200 shadow-[-4px_0_16px_rgba(0,0,0,0.08)] rounded-tl-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-800">AI Assistant</span>
            <button
              type="button"
              onClick={() => {
                setShowAIPanel(false)
                setAiChatMessages([])
              }}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus:outline-none"
              aria-label="Close AI panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Chat history */}
          <div ref={aiChatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
            {aiChatMessages.length === 0 && !aiLoading && (
              <p className="text-sm text-gray-400 text-center py-6">Send a command to get started.</p>
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
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl text-sm bg-gray-100 text-gray-500">
                  Thinking…
                </div>
              </div>
            )}
          </div>
          {/* Vertical input area */}
          <div className="flex flex-col gap-2 p-3 border-t border-gray-100">
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
                className={`w-full resize-none px-3 py-2.5 text-sm bg-gray-50 border rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 placeholder:text-gray-400 ${aiPromptValidationError ? 'border-red-500 focus-visible:border-transparent' : 'border-gray-200 focus-visible:border-transparent'}`}
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
        <div className="fixed right-6 bottom-6 z-40">
          <button
            type="button"
            onClick={() => setShowAIPanel(true)}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 hover:from-violet-200 hover:to-indigo-200 active:scale-95 transition-colors duration-200 shadow-lg border border-violet-200/60 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            aria-label="Open AI panel"
          >
            <GeminiIcon className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
