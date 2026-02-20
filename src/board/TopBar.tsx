import { useState, useRef, useEffect } from 'react'
import { signOut } from '../supabase/auth'

type TopBarProps = {
  presenceNames: string[]
  onSignOut?: () => void
  boardTitle?: string
  onBackToBoards?: () => void
  onClearBoard?: () => void
  /** When true, show Shared pill; when false and boardTitle present, show Private pill */
  isShared?: boolean
  /** Opens the Share modal. Only shown when boardTitle is present. */
  onShareClick?: () => void
}

export default function TopBar({ presenceNames, onSignOut, boardTitle, onBackToBoards, onClearBoard, isShared = false, onShareClick }: TopBarProps) {
  const [showPresenceDropdown, setShowPresenceDropdown] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const presenceRef = useRef<HTMLDivElement>(null)

  const count = presenceNames.length
  const label = `Online (${count})`

  const handleClearConfirm = () => {
    onClearBoard?.()
    setShowClearModal(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPresenceDropdown(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <header className="relative z-[100] flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          {onBackToBoards && (
            <button
              type="button"
              onClick={onBackToBoards}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded"
            >
              ← Boards
            </button>
          )}
          <span className="font-semibold text-xl text-gray-800 tracking-tight">
            {boardTitle ?? 'CollabBoard'}
          </span>
          {boardTitle != null && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              aria-label={isShared ? 'Board is shared' : 'Board is private'}
              style={{
                backgroundColor: isShared ? 'rgb(187 247 208)' : 'rgb(243 244 246)',
                color: isShared ? 'rgb(22 101 52)' : 'rgb(75 85 99)',
              }}
            >
              {isShared ? (
                <>
                  <span aria-hidden>🌐</span> Shared
                </>
              ) : (
                <>
                  <span aria-hidden>🔒</span> Private
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-5">
          {boardTitle != null && onShareClick && (
            <button
              type="button"
              onClick={onShareClick}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              aria-label="Share board"
            >
              Share
            </button>
          )}
          {onClearBoard && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            >
              Clear board
            </button>
          )}
        <div
          className="relative flex items-center gap-2"
          ref={presenceRef}
          onMouseEnter={() => setShowPresenceDropdown(true)}
          onMouseLeave={() => setShowPresenceDropdown(false)}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" aria-hidden />
          <button
            type="button"
            className="text-sm text-gray-500 font-medium hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 cursor-default focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
          >
            {label}
          </button>
          {showPresenceDropdown && (
            <div
              data-presence-dropdown
              className="absolute right-0 top-full mt-1 py-2 min-w-[160px] max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-[99999]"
              role="listbox"
            >
              {count === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500">No one else online</div>
              ) : (
                presenceNames.map((name) => (
                  <div
                    key={name}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    role="option"
                  >
                    {name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => (onSignOut ? onSignOut() : signOut())}
          className="px-4 py-2 text-sm font-medium cursor-pointer bg-gray-100 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
        >
          Sign out
        </button>
      </div>
    </header>

      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 id="clear-modal-title" className="text-lg font-semibold text-gray-800 mb-2">
              Clear board?
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete all sticky notes and shapes on this board? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus:outline-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
