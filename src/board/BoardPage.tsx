import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppUser } from '../types/user'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import type { Tool } from './Toolbar'
import Canvas from '../canvas/Canvas'
import { subscribeObjects, updateObject, deleteObject } from '../supabase/objects'
import { removeMyCursor } from '../supabase/cursors'
import { signOut } from '../supabase/auth'
import { MVP_BOARD_ID } from '../constants'
import type { BoardObject } from '../types/board'
import { runAICommand } from '../ai/claudeAgent'

type BoardPageProps = { user: AppUser }

export default function BoardPage({ user }: BoardPageProps) {
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
      updateObject(MVP_BOARD_ID, id, { x, y, width, height }).catch((err) =>
        console.error('Failed to update object size', err)
      )
    },
    []
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
      MVP_BOARD_ID,
      setObjectsFromSubscription,
      handleRealtimeObjectChange
    )
    return unsub
  }, [setObjectsFromSubscription, handleRealtimeObjectChange])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteObject(MVP_BOARD_ID, selectedId)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, editingId])

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
    updateObject(MVP_BOARD_ID, id, { text: newText }).catch((err) => {
      console.error('Failed to save sticky text', err)
      setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, text: previousText } : o)))
    })
  }, [editingId, editingText, objects])

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
      updateObject(MVP_BOARD_ID, selectedColorableId, { color }).catch((err) =>
        console.error('Failed to update color', err)
      )
    },
    [selectedColorableId]
  )

  const handleResize = useCallback(
    (width: number, height: number) => {
      if (!selectedId) return
      setObjects((prev) =>
        prev.map((o) =>
          o.id === selectedId ? { ...o, width, height } : o
        )
      )
      updateObject(MVP_BOARD_ID, selectedId, { width, height }).catch((err) =>
        console.error('Failed to resize', err)
      )
    },
    [selectedId]
  )

  const handleSignOut = useCallback(() => {
    removeMyCursor(MVP_BOARD_ID, user.uid)
    signOut()
  }, [user.uid])

  const handleRunAI = useCallback(async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) return
    setAiLoading(true)
    setAiResult(null)
    setAiError(null)
    try {
      const result = await runAICommand(prompt, objects)
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
        onAIClick={() => setShowAIPanel((v) => !v)}
        onSignOut={handleSignOut}
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
        />
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
