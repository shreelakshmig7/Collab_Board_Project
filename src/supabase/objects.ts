import { supabase } from './config'
import type { BoardObject } from '../types/board'

const TABLE = 'board_objects'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const REFETCH_DEBOUNCE_MS = 2000

export type RealtimeObjectChange =
  | { event: 'INSERT' | 'UPDATE'; new: BoardObject }
  | { event: 'DELETE'; old: { id: string } }

function rowToBoardObject(row: Record<string, unknown>): BoardObject {
  const type = String(row.type)
  return {
    id: String(row.id),
    type: type === 'sticky' || type === 'rect' || type === 'circle' || type === 'line' ? type : 'sticky',
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    text: row.text != null ? String(row.text) : undefined,
    color: row.color != null ? String(row.color) : undefined,
  }
}

export function subscribeObjects(
  boardId: string,
  callback: (objects: BoardObject[]) => void,
  onRealtimeChange?: (change: RealtimeObjectChange) => void
): () => void {
  const db = requireSupabase()
  const fetchAndNotify = async () => {
    const { data, error } = await db
      .from(TABLE)
      .select('id, type, x, y, width, height, text, color')
      .eq('board_id', boardId)
    if (error) {
      console.error('subscribeObjects error', error)
      return
    }
    callback((data ?? []).map((row) => ({ ...row, id: row.id } as BoardObject)))
  }
  fetchAndNotify()
  let refetchTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleRefetch = () => {
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(() => {
      refetchTimer = null
      fetchAndNotify()
    }, REFETCH_DEBOUNCE_MS)
  }
  const channel = db
    .channel(`board_objects:${boardId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `board_id=eq.${boardId}` },
      (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
        if (onRealtimeChange && payload && typeof payload === 'object') {
          const ev = (payload.eventType ?? '').toUpperCase()
          if ((ev === 'INSERT' || ev === 'UPDATE') && payload.new && payload.new.id != null) {
            onRealtimeChange({ event: ev as 'INSERT' | 'UPDATE', new: rowToBoardObject(payload.new) })
          } else if (ev === 'DELETE' && payload.old && payload.old.id != null) {
            onRealtimeChange({ event: 'DELETE', old: { id: String(payload.old.id) } })
          }
        }
        scheduleRefetch()
      }
    )
    .subscribe((status, err) => {
      if (status !== 'SUBSCRIBED') {
        console.warn('[Realtime] board_objects subscription status:', status, err ?? '')
      }
    })
  return () => {
    if (refetchTimer) clearTimeout(refetchTimer)
    db.removeChannel(channel)
  }
}

export async function getObjects(boardId: string): Promise<BoardObject[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select('id, type, x, y, width, height, text, color')
    .eq('board_id', boardId)
  if (error) throw error
  return (data ?? []).map((row) => ({ ...row, id: row.id } as BoardObject))
}

export async function addObject(boardId: string, obj: BoardObject): Promise<void> {
  const { error } = await requireSupabase().from(TABLE).insert({
    board_id: boardId,
    id: obj.id,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    text: obj.text ?? null,
    color: obj.color ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function updateObject(
  boardId: string,
  id: string,
  partial: Partial<BoardObject>
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (partial.x !== undefined) row.x = partial.x
  if (partial.y !== undefined) row.y = partial.y
  if (partial.width !== undefined) row.width = partial.width
  if (partial.height !== undefined) row.height = partial.height
  if (partial.text !== undefined) row.text = partial.text
  if (partial.color !== undefined) row.color = partial.color
  const { error } = await requireSupabase()
    .from(TABLE)
    .update(row)
    .eq('board_id', boardId)
    .eq('id', id)
  if (error) throw error
}

export async function deleteObject(boardId: string, id: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(TABLE)
    .delete()
    .eq('board_id', boardId)
    .eq('id', id)
  if (error) throw error
}

/** Delete all objects on a board (clear board). */
export async function deleteAllObjects(boardId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(TABLE)
    .delete()
    .eq('board_id', boardId)
  if (error) throw error
}
