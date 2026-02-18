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

/** List all boards for the current user (by user_id). */
export async function listBoards(userId: string): Promise<Board[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select('id, name, user_id, created_at')
    .eq('user_id', userId)
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
