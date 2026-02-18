import { signOut } from '../supabase/auth'

type TopBarProps = {
  presenceNames: string[]
  onAIClick?: () => void
  onSignOut?: () => void
}

export default function TopBar({ presenceNames, onAIClick, onSignOut }: TopBarProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 18 }}>CollabBoard</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {onAIClick && (
          <button
            type="button"
            onClick={onAIClick}
            style={{
              padding: '6px 12px',
              fontSize: 14,
              cursor: 'pointer',
              background: '#ede9fe',
              color: '#5b21b6',
              border: '1px solid #c4b5fd',
              borderRadius: 6,
            }}
          >
            AI command
          </button>
        )}
        <span style={{ fontSize: 14, color: '#6b7280' }}>
          {presenceNames.length ? presenceNames.join(', ') + ' online' : 'You online'}
        </span>
        <button
          type="button"
          onClick={() => (onSignOut ? onSignOut() : signOut())}
          style={{
            padding: '6px 12px',
            fontSize: 14,
            cursor: 'pointer',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
