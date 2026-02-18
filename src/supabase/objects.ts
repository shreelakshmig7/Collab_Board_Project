import { supabase } from './config'
import type { BoardObject } from '../types/board'

const TABLE = 'board_objects'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const REFETCH_DEBOUNCE_MS = 400

export function subscribeObjects(
  boardId: string,
  callback: (objects: BoardObject[]) => void
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
    if (refetchTimer) return
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
      scheduleRefetch
    )
    .subscribe((status, err) => {
      if (status !== 'SUBSCRIBED' && status !== 'OK') {
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
