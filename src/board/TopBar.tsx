import { useState, useEffect } from 'react'
import { signOut } from '../supabase/auth'

/** Gemini-style star/sparkle icon (inline SVG) */
function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
    </svg>
  )
}

type TopBarProps = {
  presenceNames: string[]
  onSignOut?: () => void
}

export default function TopBar({ presenceNames, onSignOut }: TopBarProps) {
  const [showComingSoon, setShowComingSoon] = useState(false)

  useEffect(() => {
    if (!showComingSoon) return
    const t = setTimeout(() => setShowComingSoon(false), 2500)
    return () => clearTimeout(t)
  }, [showComingSoon])

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm">
      <span className="font-semibold text-xl text-gray-800 tracking-tight">CollabBoard</span>
      <div className="flex items-center gap-5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowComingSoon(true)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 hover:from-violet-200 hover:to-indigo-200 active:scale-95 transition-all duration-200 shadow-sm border border-violet-200/60"
            title="AI (coming soon)"
            aria-label="AI – coming soon"
          >
            <GeminiIcon className="w-5 h-5" />
          </button>
          {showComingSoon && (
            <div
              role="tooltip"
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-2xl shadow-lg whitespace-nowrap z-50"
              style={{
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.25)',
              }}
            >
              Coming soon!!
              <span
                className="absolute left-1/2 -translate-x-1/2 top-full border-8 border-transparent border-t-gray-900"
                style={{ marginTop: '-1px' }}
              />
            </div>
          )}
        </div>
        <span className="text-sm text-gray-500 font-medium">
          {presenceNames.length ? presenceNames.join(', ') + ' online' : 'You online'}
        </span>
        <button
          type="button"
          onClick={() => (onSignOut ? onSignOut() : signOut())}
          className="px-4 py-2 text-sm font-medium cursor-pointer bg-gray-100 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
