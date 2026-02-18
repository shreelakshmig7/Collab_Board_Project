import { useState, useEffect, useCallback } from 'react'
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

  const handleObjectResized = useCallback(
    (id: string, payload: { x: number; y: number; width: number; height: number }) => {
      const { x, y, width, height } = payload
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
      if (prev.length > 0 && data.length < prev.length) return prev
      if (prev.length === 0) return data
      const dataById = new Map(data.map((o) => [o.id, o]))
      const merged = prev.map((p) => dataById.get(p.id) ?? p)
      const added = data.filter((d) => !prev.some((p) => p.id === d.id))
      return [...merged, ...added]
    })
  }, [])

  useEffect(() => {
    const unsub = subscribeObjects(MVP_BOARD_ID, setObjectsFromSubscription)
    return unsub
  }, [setObjectsFromSubscription])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteObject(MVP_BOARD_ID, selectedId)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId])

  const handleStartEditSticky = useCallback((id: string, text: string) => {
    setEditingId(id)
    setEditingText(text)
  }, [])

  const handleSaveStickyText = useCallback(() => {
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

  const selectedObject = objects.find((o) => o.id === selectedId)
  const selectedStickyId = selectedObject?.type === 'sticky' ? selectedId : null
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>
          Could not create object: {createError}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas
          user={user}
          activeTool={activeTool}
          onPresenceChange={setPresenceNames}
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onStartEditSticky={handleStartEditSticky}
          onOptimisticAdd={handleOptimisticAdd}
          onAddFailed={handleAddFailed}
          onObjectMoved={handleObjectMoved}
          onObjectResized={handleObjectResized}
        />
      </div>
      {showAIPanel && (
        <div
          style={{
            padding: '12px 16px',
            background: '#f5f3ff',
            borderBottom: '1px solid #c4b5fd',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <input
            type="text"
            placeholder="e.g. Add a yellow sticky that says Hello"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRunAI()}
            disabled={aiLoading}
            style={{
              flex: '1',
              minWidth: 200,
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #c4b5fd',
              borderRadius: 6,
            }}
          />
          <button
            type="button"
            onClick={handleRunAI}
            disabled={aiLoading}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              cursor: aiLoading ? 'wait' : 'pointer',
              background: '#5b21b6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
            }}
          >
            {aiLoading ? 'Running…' : 'Run'}
          </button>
          <button
            type="button"
            onClick={() => setShowAIPanel(false)}
            style={{ padding: '8px 12px', fontSize: 14, cursor: 'pointer' }}
          >
            Close
          </button>
          {(aiResult != null || aiError) && (
            <span style={{ fontSize: 13, color: aiError ? '#b91c1c' : '#6b7280' }}>
              {aiError ?? aiResult}
            </span>
          )}
        </div>
      )}
      {editingId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleSaveStickyText}
        >
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 12,
              minWidth: 280,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
              Edit sticky text
            </label>
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSaveStickyText()
                }
              }}
              style={{
                width: '100%',
                minHeight: 80,
                padding: 8,
                fontSize: 14,
              }}
              autoFocus
            />
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setEditingId(null)}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveStickyText}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
