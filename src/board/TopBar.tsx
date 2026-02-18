import { signOut } from '../supabase/auth'

type TopBarProps = {
  presenceNames: string[]
  onAIClick?: () => void
  onSignOut?: () => void
}

export default function TopBar({ presenceNames, onAIClick, onSignOut }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      <span className="font-semibold text-lg">CollabBoard</span>
      <div className="flex items-center gap-4">
        {onAIClick && (
          <button
            type="button"
            onClick={onAIClick}
            className="px-3 py-1.5 text-sm cursor-pointer bg-violet-100 text-violet-800 border border-violet-300 rounded-md hover:bg-violet-200 transition-colors"
          >
            AI command
          </button>
        )}
        <span className="text-sm text-gray-500">
          {presenceNames.length ? presenceNames.join(', ') + ' online' : 'You online'}
        </span>
        <button
          type="button"
          onClick={() => (onSignOut ? onSignOut() : signOut())}
          className="px-3 py-1.5 text-sm cursor-pointer bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
