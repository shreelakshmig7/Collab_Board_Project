import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { AppUser } from '../types/user'
import { listBoards, createBoard, deleteBoard, updateBoard } from '../supabase/boards'
import { validateBoardName, sanitizeBoardName } from '../utils/inputValidation'
import type { Board } from '../supabase/boards'
import { signOut } from '../supabase/auth'
import { deleteAllObjects } from '../supabase/objects'
import { deleteCursorsForBoard, removeAllCursorsForUser } from '../supabase/cursors'
import { removePresence } from '../supabase/presence'
import { BOARD_LIST_POLL_MS } from '../constants'
import TopBar from './TopBar'

const LIST_MAX_H = 'max-h-[400px]'

const BOARDS_LIST_CONNECTION_MSG = 'Connection error. Check your network and try again.'

function NetworkPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.22]"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="net-dash" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <circle cx="0"   cy="0"   r="2"   fill="#a78bfa" />
          <circle cx="120" cy="0"   r="2"   fill="#a78bfa" />
          <circle cx="0"   cy="120" r="2"   fill="#a78bfa" />
          <circle cx="120" cy="120" r="2"   fill="#a78bfa" />
          <circle cx="60"  cy="60"  r="1.5" fill="#c4b5fd" />
          <circle cx="22"  cy="82"  r="1"   fill="#c4b5fd" />
          <circle cx="88"  cy="28"  r="1"   fill="#c4b5fd" />
          <circle cx="40"  cy="20"  r="1"   fill="#c4b5fd" />
          <circle cx="95"  cy="90"  r="1"   fill="#c4b5fd" />
          <line x1="0"   y1="0"   x2="60"  y2="60"  stroke="#8b5cf6" strokeWidth="0.5" />
          <line x1="120" y1="0"   x2="60"  y2="60"  stroke="#8b5cf6" strokeWidth="0.5" />
          <line x1="0"   y1="120" x2="60"  y2="60"  stroke="#8b5cf6" strokeWidth="0.5" />
          <line x1="120" y1="120" x2="60"  y2="60"  stroke="#8b5cf6" strokeWidth="0.5" />
          <line x1="60"  y1="60"  x2="22"  y2="82"  stroke="#7c3aed" strokeWidth="0.5" />
          <line x1="60"  y1="60"  x2="88"  y2="28"  stroke="#7c3aed" strokeWidth="0.5" />
          <line x1="60"  y1="60"  x2="40"  y2="20"  stroke="#7c3aed" strokeWidth="0.4" />
          <line x1="60"  y1="60"  x2="95"  y2="90"  stroke="#7c3aed" strokeWidth="0.4" />
          <line x1="0"   y1="0"   x2="88"  y2="28"  stroke="#8b5cf6" strokeWidth="0.3" />
          <line x1="120" y1="0"   x2="22"  y2="82"  stroke="#8b5cf6" strokeWidth="0.3" />
          <line x1="0"   y1="120" x2="95"  y2="90"  stroke="#8b5cf6" strokeWidth="0.3" />
          <line x1="120" y1="120" x2="40"  y2="20"  stroke="#8b5cf6" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#net-dash)" />
    </svg>
  )
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={className} width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M22 2 L24.5 19.5 L42 22 L24.5 24.5 L22 42 L19.5 24.5 L2 22 L19.5 19.5 Z" fill="white" opacity="0.55" />
    </svg>
  )
}

/** Normalize caught error to a display string. Never returns "[object Object]". */
function normalizeListError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err !== null && typeof err === 'object' && 'message' in err) {
    return normalizeListError((err as { message: unknown }).message)
  }
  const s = String(err)
  return s === '[object Object]' || s.includes('[object Object]') ? BOARDS_LIST_CONNECTION_MSG : s
}

type BoardsListPageProps = { user: AppUser; presenceNames: string[] }

export default function BoardsListPage({ user, presenceNames }: BoardsListPageProps) {
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [createValidationError, setCreateValidationError] = useState<string | null>(null)
  const [renameValidationError, setRenameValidationError] = useState<string | null>(null)
  const [openBoardMenuId, setOpenBoardMenuId] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const myBoards = boards
    .filter((b) => b.user_id === user.uid)
    .filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const sharedBoards = boards
    .filter((b) => b.user_id !== user.uid)
    .filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()))

  useEffect(() => {
    let cancelled = false
    listBoards()
      .then((list) => {
        if (!cancelled) setBoards(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(normalizeListError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.uid, location.pathname])

  useEffect(() => {
    let cancelled = false
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || location.pathname !== '/') return
      listBoards()
        .then((list) => {
          if (!cancelled) setBoards(list)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(normalizeListError(err))
        })
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user.uid, location.pathname])

  useEffect(() => {
    if (location.pathname !== '/') return
    let cancelled = false
    const poll = () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      listBoards()
        .then((list) => {
          if (!cancelled) setBoards(list)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(normalizeListError(err))
        })
    }
    const intervalId = setInterval(poll, BOARD_LIST_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [user.uid, location.pathname])

  // Clear error and refetch boards when back online
  useEffect(() => {
    const handleOnline = () => {
      setError(null)
      listBoards()
        .then((list) => setBoards(list))
        .catch(() => {})
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = sanitizeBoardName(newBoardName)
    const result = validateBoardName(name)
    if (!result.valid) {
      setCreateValidationError(result.error ?? 'Invalid board name')
      return
    }
    setCreateValidationError(null)
    setError(null)
    setCreating(true)
    try {
      const board = await createBoard(user.uid, name)
      setShowCreateModal(false)
      setNewBoardName('')
      navigate(`/board/${board.id}`, { replace: true })
    } catch (err: unknown) {
      setError(normalizeListError(err))
    } finally {
      setCreating(false)
    }
  }

  const handleNewBoardNameChange = (value: string) => {
    setNewBoardName(value)
    setCreateValidationError(null)
  }

  const handleNameClick = (boardId: string) => {
    navigate(`/board/${boardId}`)
  }

  const openRenameForBoard = (board: Board) => {
    setSelectedIds(new Set([board.id]))
    setRenameValue(board.name)
    setShowRenameModal(true)
    setOpenBoardMenuId(null)
  }

  const openDeleteForBoard = (boardId: string) => {
    setSelectedIds(new Set([boardId]))
    setShowDeleteConfirm(true)
    setOpenBoardMenuId(null)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setError(null)
    setDeleting(true)
    const ids = Array.from(selectedIds)
    try {
      for (const boardId of ids) {
        await deleteAllObjects(boardId, user.uid)
        await deleteCursorsForBoard(boardId)
        await deleteBoard(boardId)
      }
      setBoards((prev) => prev.filter((b) => !selectedIds.has(b.id)))
      setSelectedIds(new Set())
      setShowDeleteConfirm(false)
    } catch (err: unknown) {
      setError(normalizeListError(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = sanitizeBoardName(renameValue)
    if (selectedIds.size !== 1) return
    const result = validateBoardName(name)
    if (!result.valid) {
      setRenameValidationError(result.error ?? 'Invalid board name')
      return
    }
    const boardId = Array.from(selectedIds)[0]
    setRenameValidationError(null)
    setError(null)
    setRenaming(true)
    try {
      await updateBoard(boardId, { name })
      setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name } : b)))
      setShowRenameModal(false)
      setRenameValue('')
    } catch (err: unknown) {
      setError(normalizeListError(err))
    } finally {
      setRenaming(false)
    }
  }

  const handleRenameValueChange = (value: string) => {
    setRenameValue(value)
    setRenameValidationError(null)
  }

  const renameBoardId = showRenameModal ? Array.from(selectedIds)[0] : null
  const hasBlockingModal = showDeleteConfirm || showRenameModal || showCreateModal

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-violet-900">
        <div className="px-8 py-6 bg-white/[0.08] backdrop-blur-md border border-white/10 rounded-2xl shadow-xl">
          <p className="text-white/70">Loading your boards…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-violet-900 flex flex-col relative overflow-hidden">
      {/* Background decorations — static, no JS cost */}
      <NetworkPattern />
      <div className="absolute top-1/4 left-1/6 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/6 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-8 right-8 pointer-events-none" aria-hidden="true">
        <Sparkle />
      </div>

      <TopBar
        dark
        presenceNames={presenceNames}
        onSignOut={async () => {
          removeAllCursorsForUser(user.uid)
          await removePresence(user.uid)
          signOut()
        }}
        disableGlassBlur={hasBlockingModal}
      />

      <main id="main-content" className="relative z-10 w-[70%] mx-auto px-6 py-8 flex-1 flex flex-col gap-8">
        {error && (
          <div className="p-4 bg-red-500/20 backdrop-blur-sm text-red-300 rounded-xl text-sm border border-red-500/20" role="alert">
            {normalizeListError(error)}
          </div>
        )}

        {/* My Boards */}
        <section className="flex flex-col gap-3" aria-labelledby="my-boards-heading">
          <div className="flex items-center justify-between gap-3">
            <h1 id="my-boards-heading" className="text-xl font-semibold text-white">
              My Boards
            </h1>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-white/20 text-white/70 font-medium hover:bg-white/[0.08] hover:text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus:outline-none text-sm"
            >
              + New Board
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-white/40" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search boards…"
              aria-label="Search boards"
              className="w-full pl-9 pr-4 py-2 text-sm border border-white/[0.15] bg-white/[0.08] text-white rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:border-transparent placeholder:text-white/35"
            />
          </div>

          <div className={`overflow-y-auto rounded-xl border border-white/[0.10] bg-white/[0.05] backdrop-blur-[8px] p-3 ${LIST_MAX_H}`}>
            {myBoards.length === 0 ? (
              searchQuery ? (
                <p className="p-6 text-white/50 text-sm">No boards match &ldquo;{searchQuery}&rdquo;.</p>
              ) : (
                <div className="flex flex-col items-center justify-center gap-5 py-10 px-6 text-center">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 96 96"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="opacity-60"
                  >
                    <rect x="8" y="14" width="80" height="60" rx="8" fill="#312e81" stroke="#6366f1" strokeWidth="2" />
                    <rect x="8" y="14" width="80" height="14" rx="8" fill="#3730a3" />
                    <rect x="8" y="21" width="80" height="7" fill="#3730a3" />
                    <rect x="20" y="38" width="20" height="18" rx="3" fill="#fde68a" opacity="0.8" />
                    <rect x="46" y="38" width="20" height="18" rx="3" fill="#bbf7d0" opacity="0.8" />
                    <circle cx="76" cy="74" r="14" fill="#6366F1" />
                    <line x1="76" y1="68" x2="76" y2="80" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="70" y1="74" x2="82" y2="74" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-base font-semibold text-white/90">No boards yet</p>
                    <p className="text-sm text-white/50">Start collaborating by creating your first board.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 active:scale-[0.98] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus:outline-none shadow-lg shadow-indigo-900/50"
                  >
                    + Create your first board
                  </button>
                </div>
              )
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-3" role="list">
                {myBoards.map((board) => (
                  <li key={board.id}>
                    <div className="relative rounded-xl border border-white/[0.12] bg-white/[0.07] hover:bg-white/[0.13] transition-all duration-200">
                      <button
                        type="button"
                        aria-label={`Open actions for ${board.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenBoardMenuId((prev) => (prev === board.id ? null : board.id))
                        }}
                        className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/30 focus:outline-none transition-all"
                      >
                        ···
                      </button>
                      {openBoardMenuId === board.id && (
                        <div className="absolute top-10 right-2 z-20 min-w-[120px] rounded-xl border border-white/10 bg-slate-800/90 backdrop-blur-sm shadow-xl p-1">
                          <button
                            type="button"
                            onClick={() => openRenameForBoard(board)}
                            className="w-full text-left px-3 py-2 text-sm text-white/80 rounded-lg hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30 focus:outline-none"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteForBoard(board.id)}
                            className="w-full text-left px-3 py-2 text-sm text-red-400 rounded-lg hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400 focus:outline-none"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleNameClick(board.id)}
                        className="w-full text-left min-w-0 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus:outline-none rounded-xl p-4 pr-10"
                      >
                        <span className="font-medium text-white block truncate">{board.name}</span>
                        <span className="block text-xs text-white/45 mt-0.5">
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
          <h2 id="shared-boards-heading" className="text-xl font-semibold text-white">
            Shared with you
          </h2>
          <div className={`overflow-y-auto rounded-xl border border-white/[0.10] bg-white/[0.05] backdrop-blur-[8px] p-3 ${LIST_MAX_H}`}>
            {sharedBoards.length === 0 ? (
              <p className="p-6 text-white/45 text-sm">
                {searchQuery ? `No shared boards match "${searchQuery}".` : 'No shared boards.'}
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-3" role="list">
                {sharedBoards.map((board) => (
                  <li key={board.id}>
                    <div className="relative rounded-xl border border-white/[0.12] bg-white/[0.07] hover:bg-white/[0.13] transition-all duration-200">
                      <span className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/20">
                        Shared
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNameClick(board.id)}
                        className="w-full text-left min-w-0 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1 focus:outline-none rounded-xl p-4 pr-16"
                      >
                        <span className="font-medium text-white block truncate">{board.name}</span>
                        <span className="block text-xs text-white/45 mt-0.5">
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

        {/* Delete confirmation */}
        {showDeleteConfirm && selectedIds.size > 0 && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-board-title"
          >
            <div className="bg-slate-900/85 backdrop-blur-xl border border-white/[0.15] rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <h2 id="delete-board-title" className="text-lg font-semibold text-white mb-2">
                Delete {selectedIds.size === 1 ? 'board?' : `${selectedIds.size} boards?`}
              </h2>
              <p className="text-white/60 text-sm mb-6">
                This cannot be undone. All content on the selected board(s) will be permanently removed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white/70 border border-white/20 rounded-xl hover:bg-white/10 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus:outline-none transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-500 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus:outline-none"
                >
                  {deleting ? 'Deleting…' : selectedIds.size === 1 ? 'Delete' : `Delete ${selectedIds.size} boards`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create board modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-board-title"
          >
            <div className="bg-slate-900/85 backdrop-blur-xl border border-white/[0.15] rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <h2 id="create-board-title" className="text-lg font-semibold text-white mb-4">
                New Board
              </h2>
              <form onSubmit={handleCreateBoard} className="space-y-4">
                <div className="relative">
                  <label htmlFor="new-board-name" className="sr-only">
                    Board name
                  </label>
                  <input
                    id="new-board-name"
                    type="text"
                    value={newBoardName}
                    onChange={(e) => handleNewBoardNameChange(e.target.value)}
                    placeholder="Enter board name…"
                    autoComplete="off"
                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:border-transparent bg-white/[0.08] text-white placeholder:text-white/35 ${createValidationError ? 'border-red-500' : 'border-white/[0.15]'}`}
                    autoFocus
                    disabled={creating}
                    aria-invalid={!!createValidationError}
                    aria-describedby={createValidationError ? 'new-board-name-error' : undefined}
                  />
                  {createValidationError && (
                    <div
                      id="new-board-name-error"
                      role="alert"
                      className="absolute left-0 top-full mt-1 z-[210] px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-[280px]"
                    >
                      {createValidationError}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewBoardName('')
                      setCreateValidationError(null)
                    }}
                    disabled={creating}
                    className="px-4 py-2 text-sm font-medium text-white/70 border border-white/20 rounded-xl hover:bg-white/10 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus:outline-none transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newBoardName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus:outline-none transition-all duration-200"
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rename modal */}
        {showRenameModal && renameBoardId && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-board-title"
          >
            <div className="bg-slate-900/85 backdrop-blur-xl border border-white/[0.15] rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
              <h2 id="rename-board-title" className="text-lg font-semibold text-white mb-2">
                Rename board
              </h2>
              <form onSubmit={handleRenameSubmit} className="space-y-4">
                <div className="relative">
                  <label htmlFor="rename-board-input" className="sr-only">
                    Board name
                  </label>
                  <input
                    id="rename-board-input"
                    type="text"
                    value={renameValue}
                    onChange={(e) => handleRenameValueChange(e.target.value)}
                    placeholder="Board name…"
                    autoComplete="off"
                    className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:border-transparent bg-white/[0.08] text-white placeholder:text-white/35 ${renameValidationError ? 'border-red-500' : 'border-white/[0.15]'}`}
                    autoFocus
                    disabled={renaming}
                    aria-invalid={!!renameValidationError}
                    aria-describedby={renameValidationError ? 'rename-board-input-error' : undefined}
                  />
                  {renameValidationError && (
                    <div
                      id="rename-board-input-error"
                      role="alert"
                      className="absolute left-0 top-full mt-1 z-[210] px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-[280px]"
                    >
                      {renameValidationError}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRenameModal(false)
                      setRenameValue('')
                      setRenameValidationError(null)
                    }}
                    disabled={renaming}
                    className="px-4 py-2 text-sm font-medium text-white/70 border border-white/20 rounded-xl hover:bg-white/10 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus:outline-none transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={renaming || !renameValue.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus:outline-none transition-all duration-200"
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
