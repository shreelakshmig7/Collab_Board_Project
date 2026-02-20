/**
 * Board members and invites: granular invite-only permission system.
 * Only board owner can add/remove members and manage invites.
 */
import { supabase } from './config'
import { getUserIdByEmail } from './profiles'
import { getProfile } from './profiles'

const MEMBERS_TABLE = 'board_members'
const INVITES_TABLE = 'board_invites'

export type BoardMemberRole = 'owner' | 'editor' | 'viewer'

export type BoardMemberWithProfile = {
  user_id: string
  role: BoardMemberRole
  email: string | null
  display_name: string | null
}

export type BoardInvite = {
  id: string
  board_id: string
  email: string
  role: 'editor' | 'viewer'
  invited_by: string
  created_at: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

/** Get current user's role on a board. Returns null if not a member. */
export async function getMyRole(boardId: string, userId: string): Promise<BoardMemberRole | null> {
  const { data, error } = await requireSupabase()
    .from(MEMBERS_TABLE)
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data || !['owner', 'editor', 'viewer'].includes(data.role)) return null
  return data.role as BoardMemberRole
}

/** List all members of a board with their profiles (for "People with access"). */
export async function listBoardMembers(boardId: string): Promise<BoardMemberWithProfile[]> {
  const { data: rows, error } = await requireSupabase()
    .from(MEMBERS_TABLE)
    .select('user_id, role')
    .eq('board_id', boardId)
  if (error) throw error
  const result: BoardMemberWithProfile[] = []
  for (const row of rows ?? []) {
    const profile = await getProfile(row.user_id)
    result.push({
      user_id: String(row.user_id),
      role: row.role as BoardMemberRole,
      email: profile?.email ?? null,
      display_name: profile?.display_name ?? null,
    })
  }
  return result
}

/** Add a member (owner only). Idempotent. */
export async function addBoardMember(
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const { error } = await requireSupabase()
    .from(MEMBERS_TABLE)
    .upsert({ board_id: boardId, user_id: userId, role }, { onConflict: 'board_id,user_id' })
  if (error) throw error
}

/** Update a member's role (owner only). */
export async function updateMemberRole(
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const { error } = await requireSupabase()
    .from(MEMBERS_TABLE)
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Remove a member (owner only). Cannot remove the last owner. */
export async function removeBoardMember(boardId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(MEMBERS_TABLE)
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)
  if (error) throw error
}

/** List pending invites for a board (owner only). */
export async function listBoardInvites(boardId: string): Promise<BoardInvite[]> {
  const { data, error } = await requireSupabase()
    .from(INVITES_TABLE)
    .select('id, board_id, email, role, invited_by, created_at')
    .eq('board_id', boardId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    board_id: String(row.board_id),
    email: String(row.email),
    role: row.role as 'editor' | 'viewer',
    invited_by: String(row.invited_by),
    created_at: String(row.created_at),
  }))
}

/** Create a pending invite (owner only). If email matches an existing user, add them as member instead. */
export async function inviteByEmail(
  boardId: string,
  email: string,
  role: 'editor' | 'viewer',
  invitedByUserId: string
): Promise<{ added: boolean; message: string }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) throw new Error('Email is required')

  const existingUserId = await getUserIdByEmail(normalized)
  if (existingUserId) {
    await addBoardMember(boardId, existingUserId, role)
    return { added: true, message: 'Added as member' }
  }

  const { error } = await requireSupabase()
    .from(INVITES_TABLE)
    .upsert(
      { board_id: boardId, email: normalized, role, invited_by: invitedByUserId },
      { onConflict: 'board_id,email' }
    )
  if (error) throw error
  return { added: false, message: 'Invitation sent (they’ll have access when they sign up with this email)' }
}

/** Revoke a pending invite (owner only). */
export async function revokeInvite(boardId: string, inviteId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(INVITES_TABLE)
    .delete()
    .eq('board_id', boardId)
    .eq('id', inviteId)
  if (error) throw error
}
