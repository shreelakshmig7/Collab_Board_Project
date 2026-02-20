import { supabase } from './config'

export type Board = {
  id: string
  name: string
  user_id: string
  created_at: string
  public_access_level?: 'private' | 'can_edit'
  share_slug?: string | null
}

const TABLE = 'boards'
const MEMBERS_TABLE = 'board_members'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const BOARD_COLS = 'id, name, user_id, created_at, public_access_level, share_slug'

function mapRow(row: Record<string, unknown>): Board {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Untitled board'),
    user_id: String(row.user_id),
    created_at: String(row.created_at),
    public_access_level: row.public_access_level === 'can_edit' ? 'can_edit' : 'private',
    share_slug: row.share_slug != null ? String(row.share_slug) : null,
  }
}

/** List all boards the current user is a member of (RLS enforces). */
export async function listBoards(): Promise<Board[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select(BOARD_COLS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/** Create a new board. Returns the created board. Trigger adds owner to board_members. */
export async function createBoard(userId: string, name: string): Promise<Board> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .insert({
      user_id: userId,
      name: name || 'Untitled board',
    })
    .select(BOARD_COLS)
    .single()
  if (error) throw error
  return mapRow(data)
}

/** Get a single board by id. Returns null if not found or not a member. */
export async function getBoard(boardId: string): Promise<Board | null> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select(BOARD_COLS)
    .eq('id', boardId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapRow(data)
}

/** Resolve share slug to board id only (RPC). Used when opening /b/:slug; does not expose board rows to non-members. */
export async function getBoardIdByShareSlug(slug: string): Promise<string | null> {
  const { data, error } = await requireSupabase().rpc('get_board_id_by_share_slug', { slug })
  if (error) throw error
  return data != null ? String(data) : null
}

/** Add current user as editor for the board (e.g. after opening share link). Idempotent. */
export async function ensureBoardMember(boardId: string, userId: string, role: 'editor'): Promise<void> {
  const { error } = await requireSupabase()
    .from(MEMBERS_TABLE)
    .upsert({ board_id: boardId, user_id: userId, role }, { onConflict: 'board_id,user_id' })
  if (error) throw error
}

/** Generate a short URL-safe slug for share links. */
export function generateShareSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

/** Enable sharing for a board: set public_access_level to can_edit and assign share_slug if missing. Returns the share slug. */
export async function enableSharing(boardId: string): Promise<string> {
  const existing = await getBoard(boardId)
  if (!existing) throw new Error('Board not found')
  const slug = existing.share_slug ?? generateShareSlug()
  await updateBoard(boardId, { public_access_level: 'can_edit', share_slug: slug })
  return slug
}

/** Update a board (e.g. rename, enable sharing). Caller must be a member. */
export async function updateBoard(
  boardId: string,
  updates: { name?: string; public_access_level?: 'private' | 'can_edit'; share_slug?: string | null }
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.public_access_level !== undefined) row.public_access_level = updates.public_access_level
  if (updates.share_slug !== undefined) row.share_slug = updates.share_slug
  if (Object.keys(row).length === 0) return
  const { error } = await requireSupabase()
    .from(TABLE)
    .update(row)
    .eq('id', boardId)
  if (error) throw error
}

/** Delete a board. Caller should delete board_objects and cursors for this board first. */
export async function deleteBoard(boardId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(TABLE)
    .delete()
    .eq('id', boardId)
  if (error) throw error
}
