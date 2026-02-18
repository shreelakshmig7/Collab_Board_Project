import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppUser } from '../types/user'
import { listBoards, createBoard } from '../supabase/boards'
import type { Board } from '../supabase/boards'
import { signOut } from '../supabase/auth'
import TopBar from './TopBar'

type BoardsListPageProps = { user: AppUser; presenceNames: string[] }

export default function BoardsListPage({ user, presenceNames }: BoardsListPageProps) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewBoardForm, setShowNewBoardForm] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setError(null)
    listBoards()
      .then((list) => {
        if (!cancelled) setBoards(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.uid])

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newBoardName.trim()
    if (!name) return
    setError(null)
    setCreating(true)
    try {
      const board = await createBoard(user.uid, name)
      setShowNewBoardForm(false)
      setNewBoardName('')
      navigate(`/board/${board.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleOpenBoard = (id: string) => {
    navigate(`/board/${id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading your boards…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar presenceNames={presenceNames} onSignOut={() => signOut()} />
      <main className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        <h1 className="text-2xl font-semibold text-gray-800 mb-8">My Boards</h1>
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}
        {!showNewBoardForm ? (
          <button
            type="button"
            onClick={() => setShowNewBoardForm(true)}
            className="mb-8 flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
          >
            + New Board
          </button>
        ) : (
          <form onSubmit={handleCreateBoard} className="mb-8 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="new-board-name" className="block text-sm font-medium text-gray-700 mb-1">
                Board name
              </label>
              <input
                id="new-board-name"
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Enter board name"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={creating}
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newBoardName.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewBoardForm(false); setNewBoardName(''); setError(null); }}
              className="px-5 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100"
            >
              Cancel
            </button>
          </form>
        )}
        {boards.length === 0 ? (
          <p className="text-gray-500 text-sm">No boards yet. Click &quot;+ New Board&quot; and enter a name to create one.</p>
        ) : (
          <ul className="space-y-2">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  onClick={() => handleOpenBoard(board.id)}
                  className="w-full text-left px-5 py-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-blue-200 hover:shadow transition-all"
                >
                  <span className="font-medium text-gray-800">{board.name}</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Created {new Date(board.created_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
