import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppUser } from '../types/user'
import { listBoards, createBoard, deleteBoard, updateBoard } from '../supabase/boards'
import type { Board } from '../supabase/boards'
import { signOut } from '../supabase/auth'
import { deleteAllObjects } from '../supabase/objects'
import { deleteCursorsForBoard } from '../supabase/cursors'
import TopBar from './TopBar'

type BoardsListPageProps = { user: AppUser; presenceNames: string[] }

export default function BoardsListPage({ user, presenceNames }: BoardsListPageProps) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewBoardForm, setShowNewBoardForm] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
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

  const selectedBoard = selectedBoardId ? boards.find((b) => b.id === selectedBoardId) : null

  const handleDeleteBoard = async () => {
    if (!selectedBoardId || !selectedBoard) return
    setError(null)
    setDeleting(true)
    try {
      await deleteAllObjects(selectedBoardId)
      await deleteCursorsForBoard(selectedBoardId)
      await deleteBoard(selectedBoardId)
      setBoards((prev) => prev.filter((b) => b.id !== selectedBoardId))
      setSelectedBoardId(null)
      setShowDeleteConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleRenameBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = renameValue.trim()
    if (!name || !selectedBoardId || !selectedBoard) return
    if (selectedBoard.user_id !== user.uid) return
    setError(null)
    setRenaming(true)
    try {
      await updateBoard(selectedBoardId, { name })
      setBoards((prev) => prev.map((b) => (b.id === selectedBoardId ? { ...b, name } : b)))
      setShowRenameModal(false)
      setRenameValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRenaming(false)
    }
  }

  const openRenameModal = () => {
    if (selectedBoard && selectedBoard.user_id === user.uid) {
      setRenameValue(selectedBoard.name)
      setShowRenameModal(true)
    }
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
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNewBoardForm(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
            >
              + New Board
            </button>
            <button
              type="button"
              onClick={() => selectedBoardId && setShowDeleteConfirm(true)}
              disabled={!selectedBoardId || (selectedBoard?.user_id !== user.uid)}
              title={selectedBoardId && selectedBoard?.user_id !== user.uid ? 'You can only delete boards you created' : undefined}
              className="px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete board
            </button>
            <button
              type="button"
              onClick={openRenameModal}
              disabled={!selectedBoardId || (selectedBoard?.user_id !== user.uid)}
              title={selectedBoardId && selectedBoard?.user_id !== user.uid ? 'You can only rename boards you created' : undefined}
              className="px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Rename board
            </button>
          </div>
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedBoardId(board.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedBoardId(board.id)}
                  className={`w-full text-left px-5 py-4 rounded-xl border shadow-sm transition-all cursor-pointer ${
                    selectedBoardId === board.id
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                      : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow'
                  }`}
                >
                  <span className="font-medium text-gray-800">{board.name}</span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Created {new Date(board.created_at).toLocaleDateString()}
                  </span>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenBoard(board.id); }}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-lg"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showDeleteConfirm && selectedBoard && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-board-title"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 id="delete-board-title" className="text-lg font-semibold text-gray-800 mb-2">
                Delete board?
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                Are you sure you want to delete &quot;{selectedBoard.name}&quot;? All sticky notes and shapes on this board will be permanently removed. This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBoard}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showRenameModal && selectedBoard && selectedBoard.user_id === user.uid && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-board-title"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 id="rename-board-title" className="text-lg font-semibold text-gray-800 mb-2">
                Rename board
              </h2>
              <form onSubmit={handleRenameBoard} className="space-y-4">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Board name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  disabled={renaming}
                />
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowRenameModal(false); setRenameValue(''); }}
                    disabled={renaming}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={renaming || !renameValue.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                  >
                    {renaming ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
