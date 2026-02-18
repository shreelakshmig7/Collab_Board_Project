import { supabase } from './config'

export type Board = {
  id: string
  name: string
  user_id: string
  created_at: string
}

const TABLE = 'boards'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

/** List all boards (created by any user). */
export async function listBoards(): Promise<Board[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select('id, name, user_id, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? 'Untitled board'),
    user_id: String(row.user_id),
    created_at: String(row.created_at),
  }))
}

/** Create a new board. Returns the created board. */
export async function createBoard(userId: string, name: string): Promise<Board> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .insert({
      user_id: userId,
      name: name || 'Untitled board',
    })
    .select('id, name, user_id, created_at')
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    name: String(data.name),
    user_id: String(data.user_id),
    created_at: String(data.created_at),
  }
}

/** Get a single board by id. Returns null if not found or not owned. */
export async function getBoard(boardId: string): Promise<Board | null> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select('id, name, user_id, created_at')
    .eq('id', boardId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: String(data.id),
    name: String(data.name),
    user_id: String(data.user_id),
    created_at: String(data.created_at),
  }
}

/** Update a board (e.g. rename). Only the owner can update. */
export async function updateBoard(boardId: string, updates: { name?: string }): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
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
