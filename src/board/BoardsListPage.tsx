import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppUser } from '../types/user'
import { listBoards, createBoard, deleteBoard, updateBoard } from '../supabase/boards'
import type { Board } from '../supabase/boards'
import { signOut } from '../supabase/auth'
import { deleteAllObjects } from '../supabase/objects'
import { deleteCursorsForBoard, removeAllCursorsForUser } from '../supabase/cursors'
import TopBar from './TopBar'

const LIST_MAX_H = 'max-h-[280px]'

type BoardsListPageProps = { user: AppUser; presenceNames: string[] }

export default function BoardsListPage({ user, presenceNames }: BoardsListPageProps) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewBoardForm, setShowNewBoardForm] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const navigate = useNavigate()

  const myBoards = boards.filter((b) => b.user_id === user.uid)
  const sharedBoards = boards.filter((b) => b.user_id !== user.uid)

  useEffect(() => {
    let cancelled = false
    listBoards()
      .then((list) => {
        if (!cancelled) setBoards(list)
      })
      .catch((err: unknown) => {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const toggleSelection = (boardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(boardId)) next.delete(boardId)
      else next.add(boardId)
      return next
    })
  }

  const handleNameClick = (boardId: string) => {
    navigate(`/board/${boardId}`)
  }

  const handleDeleteClick = () => {
    if (selectedIds.size > 0) setShowDeleteConfirm(true)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setError(null)
    setDeleting(true)
    const ids = Array.from(selectedIds)
    try {
      for (const boardId of ids) {
        await deleteAllObjects(boardId)
        await deleteCursorsForBoard(boardId)
        await deleteBoard(boardId)
      }
      setBoards((prev) => prev.filter((b) => !selectedIds.has(b.id)))
      setSelectedIds(new Set())
      setShowDeleteConfirm(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleRenameClick = () => {
    if (selectedIds.size !== 1) return
    const id = Array.from(selectedIds)[0]
    const board = boards.find((b) => b.id === id)
    if (board) {
      setRenameValue(board.name)
      setShowRenameModal(true)
    }
  }

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = renameValue.trim()
    if (selectedIds.size !== 1 || !name) return
    const boardId = Array.from(selectedIds)[0]
    setError(null)
    setRenaming(true)
    try {
      await updateBoard(boardId, { name })
      setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name } : b)))
      setShowRenameModal(false)
      setRenameValue('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRenaming(false)
    }
  }

  const renameBoardId = showRenameModal ? Array.from(selectedIds)[0] : null
  const canRename = selectedIds.size === 1
  const canDelete = selectedIds.size >= 1

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading your boards…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar presenceNames={presenceNames} onSignOut={() => { removeAllCursorsForUser(user.uid); signOut() }} />
      <main id="main-content" className="max-w-2xl mx-auto px-6 py-8 flex-1 w-full flex flex-col gap-8">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm" role="alert">
            {error}
          </div>
        )}

        {/* My Boards */}
        <section className="flex flex-col gap-3" aria-labelledby="my-boards-heading">
          <h1 id="my-boards-heading" className="text-xl font-semibold text-gray-800">
            My Boards
          </h1>
          {!showNewBoardForm ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNewBoardForm(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              >
                + New Board
              </button>
              <button
                type="button"
                onClick={handleRenameClick}
                disabled={!canRename}
                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                aria-label="Rename selected board"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={!canDelete}
                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                aria-label="Delete selected boards"
              >
                Delete
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateBoard} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="new-board-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Board name
                </label>
                <input
                  id="new-board-name"
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Enter board name…"
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
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
                onClick={() => {
                  setShowNewBoardForm(false)
                  setNewBoardName('')
                  setError(null)
                }}
                className="px-5 py-2.5 text-gray-600 font-medium rounded-xl hover:bg-gray-100"
              >
                Cancel
              </button>
            </form>
          )}

          <div className={`overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm ${LIST_MAX_H}`}>
            {myBoards.length === 0 ? (
              <p className="p-6 text-gray-500 text-sm">No boards yet. Click &quot;+ New Board&quot; to create one.</p>
            ) : (
              <ul className="divide-y divide-gray-100" role="list">
                {myBoards.map((board) => (
                  <li key={board.id}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(board.id)}
                        onChange={() => toggleSelection(board.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${board.name}`}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleNameClick(board.id)}
                        className="flex-1 text-left min-w-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded-lg py-1"
                      >
                        <span className="font-medium text-gray-800 block truncate">{board.name}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          Created {new Date(board.created_at).toLocaleDateString()}
                        </span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Shared with you */}
        <section className="flex flex-col gap-3" aria-labelledby="shared-boards-heading">
          <h2 id="shared-boards-heading" className="text-xl font-semibold text-gray-800">
            Shared with you
          </h2>
          <div className={`overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm ${LIST_MAX_H}`}>
            {sharedBoards.length === 0 ? (
              <p className="p-6 text-gray-500 text-sm">No shared boards.</p>
            ) : (
              <ul className="divide-y divide-gray-100" role="list">
                {sharedBoards.map((board) => (
                  <li key={board.id}>
                    <button
                      type="button"
                      onClick={() => handleNameClick(board.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset focus:outline-none rounded-lg"
                    >
                      <span className="font-medium text-gray-800 block truncate">{board.name}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Created {new Date(board.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Delete confirmation */}
        {showDeleteConfirm && selectedIds.size > 0 && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-board-title"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 id="delete-board-title" className="text-lg font-semibold text-gray-800 mb-2">
                Delete {selectedIds.size === 1 ? 'board?' : `${selectedIds.size} boards?`}
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                This cannot be undone. All content on the selected board(s) will be permanently removed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus:outline-none"
                >
                  {deleting ? 'Deleting…' : selectedIds.size === 1 ? 'Delete' : `Delete ${selectedIds.size} boards`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename modal */}
        {showRenameModal && renameBoardId && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-board-title"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 id="rename-board-title" className="text-lg font-semibold text-gray-800 mb-2">
                Rename board
              </h2>
              <form onSubmit={handleRenameSubmit} className="space-y-4">
                <label htmlFor="rename-board-input" className="sr-only">
                  Board name
                </label>
                <input
                  id="rename-board-input"
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Board name…"
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
                  autoFocus
                  disabled={renaming}
                />
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRenameModal(false)
                      setRenameValue('')
                    }}
                    disabled={renaming}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={renaming || !renameValue.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
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
