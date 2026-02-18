import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from '../supabase/auth'

type TopBarProps = {
  presenceNames: string[]
  onSignOut?: () => void
  boardTitle?: string
  onBackToBoards?: () => void
  onClearBoard?: () => void
}

export default function TopBar({ presenceNames, onSignOut, boardTitle, onBackToBoards, onClearBoard }: TopBarProps) {
  const [showPresenceDropdown, setShowPresenceDropdown] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const presenceRef = useRef<HTMLDivElement>(null)
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!showPresenceDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if ((target as Element).closest?.('[data-presence-dropdown]')) return
      if (presenceRef.current && !presenceRef.current.contains(target)) {
        setShowPresenceDropdown(false)
        setDropdownRect(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPresenceDropdown])

  const count = presenceNames.length
  const label = `Online (${count})`

  const handleClearConfirm = () => {
    onClearBoard?.()
    setShowClearModal(false)
  }

  return (
    <>
      <header className="relative z-[100] flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          {onBackToBoards && (
            <button
              type="button"
              onClick={onBackToBoards}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Boards
            </button>
          )}
          <span className="font-semibold text-xl text-gray-800 tracking-tight">
            {boardTitle ?? 'CollabBoard'}
          </span>
        </div>
        <div className="flex items-center gap-5">
          {onClearBoard && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            >
              Clear board
            </button>
          )}
        <div className="relative flex items-center gap-2" ref={presenceRef}>
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" aria-hidden />
          <button
            type="button"
            onClick={(e) => {
              const open = !showPresenceDropdown
              if (open) setDropdownRect(e.currentTarget.getBoundingClientRect())
              else setDropdownRect(null)
              setShowPresenceDropdown(open)
            }}
            className="text-sm text-gray-500 font-medium hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            {label}
          </button>
          {showPresenceDropdown && dropdownRect &&
            createPortal(
              <div
                data-presence-dropdown
                className="fixed py-2 min-w-[160px] max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl"
                style={{
                  top: dropdownRect.bottom + 4,
                  left: dropdownRect.right - 160,
                  zIndex: 99999,
                }}
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
              </div>,
              document.body
            )}
        </div>
        <button
          type="button"
          onClick={() => (onSignOut ? onSignOut() : signOut())}
          className="px-4 py-2 text-sm font-medium cursor-pointer bg-gray-100 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </header>

      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700"
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
