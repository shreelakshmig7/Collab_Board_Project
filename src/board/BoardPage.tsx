import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppUser } from '../types/user'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import type { Tool } from './Toolbar'
import Canvas from '../canvas/Canvas'
import { subscribeObjects, updateObject, deleteObject, deleteAllObjects, addObject } from '../supabase/objects'
import { removeAllCursorsForUser } from '../supabase/cursors'
import { subscribeDragMoves, sendDragMove } from '../supabase/dragBroadcast'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { signOut } from '../supabase/auth'
import type { BoardObject } from '../types/board'
import { runAICommand } from '../ai/claudeAgent'
import { DEFAULT_CONNECTOR_COLOR } from '../constants'

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
  const [activeTool, setActiveTool] = useState<Tool>('sticky')
  const [objects, setObjects] = useState<BoardObject[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Clipboard for copy/paste
  const clipboardRef = useRef<BoardObject[]>([])
  // Drag start positions for multi-drag
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const handleOptimisticAdd = useCallback((obj: BoardObject) => {
    setObjects((prev) => [...prev, obj])
    setCreateError(null)
  }, [])

  const handleAddFailed = useCallback((id: string, addErr: unknown) => {
    setObjects((prev) => prev.filter((o) => o.id !== id))
    setCreateError(addErr instanceof Error ? addErr.message : String(addErr))
  }, [])

  const handleObjectMoved = useCallback((id: string, x: number, y: number) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)))
  }, [])

  const handleDragStart = useCallback(
    (id: string) => {
      draggingIdRef.current = id
      // Store start positions for all selected objects (for multi-drag)
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
    draggingIdRef.current = null
    dragStartPositionsRef.current = new Map()
  }, [])

  /** Called during multi-drag: move all other selected objects by the same delta as the dragged one */
  const handleMultiDragMove = useCallback(
    (movedId: string, deltaX: number, deltaY: number) => {
      if (selectedIds.length <= 1) return
      setObjects((prev) =>
        prev.map((o) => {
          if (o.id === movedId) return o // Konva handles this one
          if (!selectedIds.includes(o.id)) return o
          const start = dragStartPositionsRef.current.get(o.id)
          if (!start) return o
          return { ...o, x: start.x + deltaX, y: start.y + deltaY }
        })
      )
    },
    [selectedIds]
  )

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
      return data
    })
  }, [])

  const handleRealtimeObjectChange = useCallback(
    (change: import('../supabase/objects').RealtimeObjectChange) => {
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
        const next = [...prev]
        if (change.event === 'UPDATE' && justResized) {
          next[idx] = {
            ...obj,
            x: existing.x,
            y: existing.y,
            width: existing.width,
            height: existing.height,
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

  useEffect(() => {
    const unsub = subscribeObjects(boardId, setObjectsFromSubscription, handleRealtimeObjectChange)
    return unsub
  }, [boardId, setObjectsFromSubscription, handleRealtimeObjectChange])

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

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const idsToDelete = [...selectedIds]
    setSelectedIds([])
    setObjects((prev) => prev.filter((o) => !idsToDelete.includes(o.id)))
    for (const id of idsToDelete) {
      deleteObject(boardId, id).catch((err: unknown) => console.error('Failed to delete object', err))
    }
  }, [boardId, selectedIds])

  /** Handle connector creation between two objects */
  const handleConnectorCreated = useCallback(
    (fromId: string, toId: string) => {
      const id = crypto.randomUUID()
      const connector: BoardObject = {
        id,
        type: 'connector',
        from_id: fromId,
        to_id: toId,
        style: 'arrow',
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

  const handleStartEditText = useCallback((id: string, text: string) => {
    setEditingId(id)
    setEditingText(text)
  }, [])

  const handleSaveEditText = useCallback(() => {
    if (!editingId) {
      setEditingId(null)
      setEditingText('')
      return
    }
    const id = editingId
    const newText = editingText
    const previousText = objects.find((o) => o.id === id)?.text ?? ''
    setEditingId(null)
    setEditingText('')
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, text: newText } : o)))
    updateObject(boardId, id, { text: newText }).catch((err: unknown) => {
      console.error('Failed to save text', err)
      setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, text: previousText } : o)))
    })
  }, [boardId, editingId, editingText, objects])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
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
      // Apply to all selected objects
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

  const handleSignOut = useCallback(() => {
    removeAllCursorsForUser(user.uid)
    signOut()
  }, [user.uid])

  const handleClearBoard = useCallback(() => {
    deleteAllObjects(boardId)
      .then(() => setObjects([]))
      .catch((err: unknown) => console.error('Failed to clear board', err))
  }, [boardId])

  const handleBackToBoards = useCallback(() => {
    navigate('/')
  }, [navigate])

  const handleRunAI = useCallback(async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) return
    setAiLoading(true)
    setAiResult(null)
    setAiError(null)
    try {
      const result = await runAICommand(prompt, objects, boardId)
      setAiResult(result.text)
      if (result.error) setAiError(result.error)
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : String(err))
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
        onClearBoard={handleClearBoard}
      />
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        selectedIds={selectedIds}
        selectedObject={selectedObject}
        selectedColorableId={selectedColorableId}
        onColorChange={handleColorChange}
        onResize={handleResize}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteSelected}
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
          objects={objects}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onStartEditText={handleStartEditText}
          editingObject={editingObject}
          editingText={editingText}
          onEditingTextChange={setEditingText}
          onSaveEdit={handleSaveEditText}
          onCancelEdit={handleCancelEdit}
          onOptimisticAdd={handleOptimisticAdd}
          onAddFailed={handleAddFailed}
          onObjectMoved={handleObjectMoved}
          onObjectResized={handleObjectResized}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onAfterCreateObject={() => setActiveTool('pan')}
          onBroadcastDragMove={handleBroadcastDragMove}
          onMultiDragMove={handleMultiDragMove}
          onConnectorCreated={handleConnectorCreated}
        />
      </div>

      {/* AI panel */}
      {showAIPanel && (
        <div className="px-4 py-3 bg-violet-50 border-t border-violet-200 flex flex-wrap items-center gap-3">
          <label htmlFor="ai-prompt-input" className="sr-only">
            AI command
          </label>
          <input
            id="ai-prompt-input"
            type="text"
            placeholder='e.g. "Create a SWOT analysis" or "Add a yellow sticky that says Hello"'
            autoComplete="off"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRunAI()}
            disabled={aiLoading}
            className="flex-1 min-w-[240px] px-3 py-2 text-sm border border-violet-300 rounded-md focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleRunAI}
            disabled={aiLoading}
            className="px-4 py-2 text-sm cursor-pointer bg-violet-700 text-white border-0 rounded-md disabled:opacity-70 disabled:cursor-wait hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus:outline-none"
          >
            {aiLoading ? 'Running…' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => setShowAIPanel(false)}
            className="px-3 py-2 text-sm cursor-pointer hover:bg-violet-100 rounded-md focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus:outline-none"
          >
            Close
          </button>
          {(aiResult != null || aiError) && (
            <span className={`text-sm ${aiError ? 'text-red-600' : 'text-gray-500'}`}>
              {aiError ?? aiResult}
            </span>
          )}
        </div>
      )}

      {/* AI button fixed bottom-right */}
      <div className="fixed right-6 bottom-6 z-40">
        <button
          type="button"
          onClick={() => setShowAIPanel((v) => !v)}
          className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 hover:from-violet-200 hover:to-indigo-200 active:scale-95 transition-colors duration-200 shadow-lg border border-violet-200/60 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          aria-label={showAIPanel ? 'Close AI panel' : 'Open AI panel'}
          aria-expanded={showAIPanel}
        >
          <GeminiIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
