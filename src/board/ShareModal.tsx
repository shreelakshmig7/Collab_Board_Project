import { useState, useCallback, useEffect } from 'react'
import type { Board } from '../supabase/boards'
import {
  listBoardMembers,
  listBoardInvites,
  inviteByEmail,
  updateMemberRole,
  removeBoardMember,
  revokeInvite,
  type BoardMemberWithProfile,
  type BoardInvite,
} from '../supabase/boardMembers'
import { validateInviteEmail, sanitizeInviteEmail } from '../utils/inputValidation'
type ShareModalProps = {
  isOpen: boolean
  onClose: () => void
  board: Board | null
  boardId: string
  currentUserId: string
  isOwner: boolean
  onBoardUpdated?: () => void
}

const ROLE_OPTIONS: { value: 'editor' | 'viewer'; label: string }[] = [
  { value: 'editor', label: 'Can Edit' },
  { value: 'viewer', label: 'Can View' },
]

export default function ShareModal({
  isOpen,
  onClose,
  board,
  boardId,
  currentUserId,
  isOwner,
  onBoardUpdated,
}: ShareModalProps) {
  const [members, setMembers] = useState<BoardMemberWithProfile[]>([])
  const [invites, setInvites] = useState<BoardInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteValidationError, setInviteValidationError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchLists = useCallback(async () => {
    if (!boardId) return
    try {
      const [m, i] = await Promise.all([listBoardMembers(boardId), listBoardInvites(boardId)])
      setMembers(m)
      setInvites(i)
    } catch (err) {
      console.error('fetch members/invites failed', err)
      setMembers([])
      setInvites([])
    }
  }, [boardId])

  useEffect(() => {
    if (isOpen && boardId) fetchLists()
  }, [isOpen, boardId, fetchLists])

  const handleInvite = useCallback(async () => {
    const email = sanitizeInviteEmail(inviteEmail)
    const result = validateInviteEmail(email)
    if (!result.valid) {
      setInviteValidationError(result.error ?? 'Invalid email')
      return
    }
    setInviteValidationError(null)
    setError(null)
    setMessage(null)
    setInviting(true)
    try {
      const inviteResult = await inviteByEmail(boardId, email, inviteRole, currentUserId)
      setInviteEmail('')
      setMessage(inviteResult.message)
      await fetchLists()
      onBoardUpdated?.()
    } catch (err) {
      console.error('inviteByEmail failed', err)
      setError(err instanceof Error ? err.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }, [boardId, inviteEmail, inviteRole, currentUserId, fetchLists, onBoardUpdated])

  const handleRoleChange = useCallback(
    async (userId: string, role: 'editor' | 'viewer') => {
      setError(null)
      try {
        await updateMemberRole(boardId, userId, role)
        await fetchLists()
        onBoardUpdated?.()
      } catch (err) {
        console.error('updateMemberRole failed', err)
        setError(err instanceof Error ? err.message : 'Failed to update role')
      }
    },
    [boardId, fetchLists, onBoardUpdated]
  )

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      setError(null)
      try {
        await removeBoardMember(boardId, userId)
        await fetchLists()
        onBoardUpdated?.()
      } catch (err) {
        console.error('removeBoardMember failed', err)
        setError(err instanceof Error ? err.message : 'Failed to remove')
      }
    },
    [boardId, fetchLists, onBoardUpdated]
  )

  const handleRevokeInvite = useCallback(
    async (inviteId: string) => {
      setError(null)
      try {
        await revokeInvite(boardId, inviteId)
        await fetchLists()
        onBoardUpdated?.()
      } catch (err) {
        console.error('revokeInvite failed', err)
        setError(err instanceof Error ? err.message : 'Failed to revoke')
      }
    },
    [boardId, fetchLists, onBoardUpdated]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="share-modal-title" className="text-lg font-semibold text-gray-800">
            Share {board?.name ? `"${board.name}"` : 'board'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-green-700" role="status">
            {message}
          </p>
        )}

        {isOwner && (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="share-invite-email" className="text-sm font-medium text-gray-700">
                Add by email
              </label>
              <div className="flex gap-2 flex-wrap items-start">
                <div className="flex-1 min-w-[140px] relative">
                  <input
                    id="share-invite-email"
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value)
                      setInviteValidationError(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${inviteValidationError ? 'border-red-500' : 'border-gray-300'}`}
                    aria-label="Email to invite"
                    aria-invalid={!!inviteValidationError}
                    aria-describedby={inviteValidationError ? 'share-invite-email-error' : undefined}
                  />
                  {inviteValidationError && (
                    <div
                      id="share-invite-email-error"
                      role="alert"
                      className="absolute left-0 top-full mt-1 z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg max-w-[280px]"
                    >
                      {inviteValidationError}
                    </div>
                  )}
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shrink-0"
                  aria-label="Role for invite"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                >
                  {inviting ? 'Inviting…' : 'Invite'}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-gray-700">People with access</h3>
          <ul className="divide-y divide-gray-100" role="list">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between py-2 first:pt-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">
                    {(m.display_name || m.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 block truncate">
                      {m.user_id === currentUserId ? 'You (Owner)' : m.display_name || m.email || 'Unknown'}
                    </span>
                    {m.user_id !== currentUserId && m.email && (
                      <span className="text-xs text-gray-500 block truncate">{m.email}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-gray-100">
                    {m.role === 'owner' ? 'Owner' : m.role === 'editor' ? 'Can Edit' : 'Can View'}
                  </span>
                  {isOwner && m.role !== 'owner' && (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value as 'editor' | 'viewer')}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                        aria-label={`Change role for ${m.display_name || m.email}`}
                      >
                        <option value="editor">Can Edit</option>
                        <option value="viewer">Can View</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded focus:visible:ring-2 focus:visible:ring-red-500 outline-none"
                        aria-label={`Remove ${m.display_name || m.email}`}
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {invites.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mt-1">Pending invites</p>
              <ul className="divide-y divide-gray-100" role="list">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{inv.email}</span>
                    <span className="text-xs text-gray-500">
                      {inv.role === 'editor' ? 'Can Edit' : 'Can View'}
                    </span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

      </div>
    </div>
  )
}