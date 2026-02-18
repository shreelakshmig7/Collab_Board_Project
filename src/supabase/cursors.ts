import { supabase } from './config'

const TABLE = 'cursors'

export type CursorPayload = {
  x: number
  y: number
  displayName: string | null
  color: string
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

export function setMyCursor(
  boardId: string,
  uid: string,
  payload: CursorPayload
) {
  requireSupabase()
    .from(TABLE)
    .upsert(
      {
        board_id: boardId,
        user_id: uid,
        x: payload.x,
        y: payload.y,
        display_name: payload.displayName,
        color: payload.color,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'board_id,user_id' }
    )
    .then(({ error }) => error && console.error('setMyCursor', error))
}

export function removeMyCursor(boardId: string, uid: string) {
  requireSupabase()
    .from(TABLE)
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', uid)
    .then(({ error }) => error && console.error('removeMyCursor', error))
}

/** Delete all cursors for a board (e.g. when deleting the board). */
export async function deleteCursorsForBoard(boardId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(TABLE)
    .delete()
    .eq('board_id', boardId)
  if (error) throw error
}

export function subscribeCursors(
  boardId: string,
  callback: (cursors: Record<string, CursorPayload & { uid: string }>) => void
) {
  const db = requireSupabase()
  const fetchAndNotify = async () => {
    const { data, error } = await db
      .from(TABLE)
      .select('user_id, x, y, display_name, color')
      .eq('board_id', boardId)
    if (error) {
      console.error('subscribeCursors error', error)
      callback({})
      return
    }
    const out: Record<string, CursorPayload & { uid: string }> = {}
    for (const row of data ?? []) {
      out[row.user_id] = {
        uid: row.user_id,
        x: row.x,
        y: row.y,
        displayName: row.display_name,
        color: row.color ?? '#333',
      }
    }
    callback(out)
  }
  fetchAndNotify()
  const channel = db
    .channel(`cursors:${boardId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `board_id=eq.${boardId}` },
      () => fetchAndNotify()
    )
    .subscribe((status, err) => {
      if (status !== 'SUBSCRIBED') {
        console.warn('[Realtime] cursors subscription status:', status, err ?? '')
      }
    })
  return () => {
    db.removeChannel(channel)
  }
}

/** Call when user leaves (e.g. beforeunload) to remove their cursor. */
export function setupCursorOnDisconnect(_boardId: string, _uid: string) {
  const remove = () => removeMyCursor(_boardId, _uid)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', remove)
    return () => window.removeEventListener('beforeunload', remove)
  }
  return () => {}
}

const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export function cursorColorFromUid(uid: string): string {
  let hash = 0
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i)
    hash |= 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}
