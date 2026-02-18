import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppUser } from '../types/user'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import type { Tool } from './Toolbar'
import Canvas from '../canvas/Canvas'
import { subscribeObjects, updateObject, deleteObject, deleteAllObjects } from '../supabase/objects'
import { removeMyCursor } from '../supabase/cursors'
import { signOut } from '../supabase/auth'
import type { BoardObject } from '../types/board'
import { runAICommand } from '../ai/claudeAgent'

/** Gemini-style star/sparkle icon (inline SVG) */
function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
    </svg>
  )
}

type BoardPageProps = { user: AppUser; boardId: string; boardName: string }

export default function BoardPage({ user, boardId, boardName }: BoardPageProps) {
  const navigate = useNavigate()
  const [activeTool, setActiveTool] = useState<Tool>('sticky')
  const [presenceNames, setPresenceNames] = useState<string[]>([])
  const [objects, setObjects] = useState<BoardObject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showComingSoon, setShowComingSoon] = useState(false)

  const handleOptimisticAdd = useCallback((obj: BoardObject) => {
    setObjects((prev) => [...prev, obj])
    setCreateError(null)
  }, [])
  const handleAddFailed = useCallback((id: string, err: unknown) => {
    setObjects((prev) => prev.filter((o) => o.id !== id))
    setCreateError(err instanceof Error ? err.message : String(err))
  }, [])

  const handleObjectMoved = useCallback((id: string, x: number, y: number) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)))
  }, [])

  const lastLocalResizeRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })

  const handleObjectResized = useCallback(
    (id: string, payload: { x: number; y: number; width: number; height: number }) => {
      const { x, y, width, height } = payload
      lastLocalResizeRef.current = { id, t: Date.now() }
      setObjects((prev) =>
        prev.map((o) => (o.id === id ? { ...o, x, y, width, height } : o))
      )
      updateObject(boardId, id, { x, y, width, height }).catch((err) =>
        console.error('Failed to update object size', err)
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
    const unsub = subscribeObjects(
      boardId,
      setObjectsFromSubscription,
      handleRealtimeObjectChange
    )
    return unsub
  }, [boardId, setObjectsFromSubscription, handleRealtimeObjectChange])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteObject(boardId, selectedId)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [boardId, selectedId, editingId])

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
    updateObject(boardId, id, { text: newText }).catch((err) => {
      console.error('Failed to save sticky text', err)
      setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, text: previousText } : o)))
    })
  }, [boardId, editingId, editingText, objects])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditingText('')
  }, [])

  const selectedObject = objects.find((o) => o.id === selectedId)
  const selectedStickyId = selectedObject?.type === 'sticky' ? selectedId : null
  const editingObject = editingId ? objects.find((o) => o.id === editingId) ?? null : null
  const selectedColorableId =
    selectedObject &&
    (selectedObject.type === 'sticky' ||
      selectedObject.type === 'rect' ||
      selectedObject.type === 'circle' ||
      selectedObject.type === 'line')
      ? selectedId
      : null

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedColorableId) return
      setObjects((prev) =>
        prev.map((o) => (o.id === selectedColorableId ? { ...o, color } : o))
      )
      updateObject(boardId, selectedColorableId, { color }).catch((err) =>
        console.error('Failed to update color', err)
      )
    },
    [boardId, selectedColorableId]
  )

  const handleResize = useCallback(
    (width: number, height: number) => {
      if (!selectedId) return
      setObjects((prev) =>
        prev.map((o) =>
          o.id === selectedId ? { ...o, width, height } : o
        )
      )
      updateObject(boardId, selectedId, { width, height }).catch((err) =>
        console.error('Failed to resize', err)
      )
    },
    [boardId, selectedId]
  )

  const handleSignOut = useCallback(() => {
    removeMyCursor(boardId, user.uid)
    signOut()
  }, [boardId, user.uid])

  const handleClearBoard = useCallback(() => {
    deleteAllObjects(boardId).then(() => setObjects([])).catch((err) =>
      console.error('Failed to clear board', err)
    )
  }, [boardId])

  const handleBackToBoards = useCallback(() => {
    navigate('/')
  }, [navigate])

  useEffect(() => {
    if (!showComingSoon) return
    const t = setTimeout(() => setShowComingSoon(false), 2500)
    return () => clearTimeout(t)
  }, [showComingSoon])

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
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, objects])

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
        selectedStickyId={selectedStickyId}
        selectedColorableId={selectedColorableId}
        selectedObject={selectedObject ?? null}
        onColorChange={handleColorChange}
        onResize={handleResize}
      />
      {createError && (
        <div className="px-3 py-2 bg-red-50 text-red-700 text-sm">
          Could not create object: {createError}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <Canvas
          boardId={boardId}
          user={user}
          activeTool={activeTool}
          onPresenceChange={setPresenceNames}
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
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
          onAfterCreateObject={() => setActiveTool('pan')}
        />
      </div>
      {/* AI button fixed bottom-right */}
      <div className="fixed right-6 bottom-6 z-40">
        <button
          type="button"
          onClick={() => setShowComingSoon(true)}
          className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 hover:from-violet-200 hover:to-indigo-200 active:scale-95 transition-all duration-200 shadow-lg border border-violet-200/60"
          title="AI (coming soon)"
          aria-label="AI – coming soon"
        >
          <GeminiIcon className="w-6 h-6" />
        </button>
        {showComingSoon && (
          <div
            role="tooltip"
            className="absolute right-0 bottom-full mb-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-2xl shadow-lg whitespace-nowrap"
            style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.25)' }}
          >
            Coming soon!!
            <span className="absolute right-6 top-full border-8 border-transparent border-t-gray-900" style={{ marginTop: '-1px' }} />
          </div>
        )}
      </div>

      {showAIPanel && (
        <div className="px-4 py-3 bg-violet-50 border-b border-violet-200 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="e.g. Add a yellow sticky that says Hello"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRunAI()}
            disabled={aiLoading}
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-violet-300 rounded-md"
          />
          <button
            type="button"
            onClick={handleRunAI}
            disabled={aiLoading}
            className="px-4 py-2 text-sm cursor-pointer bg-violet-700 text-white border-0 rounded-md disabled:opacity-70 disabled:cursor-wait hover:bg-violet-800"
          >
            {aiLoading ? 'Running…' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => setShowAIPanel(false)}
            className="px-3 py-2 text-sm cursor-pointer hover:bg-violet-100 rounded-md"
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
    </div>
  )
}
