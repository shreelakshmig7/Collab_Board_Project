import { supabase } from './config'
import type { BoardObject } from '../types/board'
import { MIN_OBJECT_SIZE } from '../constants'

const TABLE = 'board_objects'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

const REFETCH_DEBOUNCE_MS = 4000

// Use * so we get any columns that exist. Connector overrides (from_x, etc.) only exist after migration.
const ALL_COLUMNS = '*'

const VALID_TYPES: BoardObject['type'][] = [
  'sticky', 'rect', 'circle', 'line', 'frame', 'connector', 'text',
]

function rowToBoardObject(row: Record<string, unknown>): BoardObject {
  const rawType = String(row.type)
  const objType: BoardObject['type'] = VALID_TYPES.includes(rawType as BoardObject['type'])
    ? (rawType as BoardObject['type'])
    : 'sticky'
  const rawW = Number(row.width)
  const rawH = Number(row.height)
  const width = Number.isFinite(rawW) && rawW > 0 ? rawW : MIN_OBJECT_SIZE
  const height = Number.isFinite(rawH) && rawH > 0 ? rawH : MIN_OBJECT_SIZE
  return {
    id: String(row.id),
    type: objType,
    x: Number(row.x),
    y: Number(row.y),
    width,
    height,
    text: row.text != null ? String(row.text) : undefined,
    body_text: row.body_text != null ? String(row.body_text) : undefined,
    color: row.color != null ? String(row.color) : undefined,
    rotation: row.rotation != null ? Number(row.rotation) : undefined,
    parent_id: row.parent_id != null ? String(row.parent_id) : undefined,
    from_id: row.from_id != null ? String(row.from_id) : undefined,
    to_id: row.to_id != null ? String(row.to_id) : undefined,
    style: row.style != null ? String(row.style) : undefined,
    from_x: row.from_x != null ? Number(row.from_x) : undefined,
    from_y: row.from_y != null ? Number(row.from_y) : undefined,
    to_x: row.to_x != null ? Number(row.to_x) : undefined,
    to_y: row.to_y != null ? Number(row.to_y) : undefined,
    font_size: row.font_size != null ? Number(row.font_size) : undefined,
    font_color: row.font_color != null ? String(row.font_color) : undefined,
  }
}

export type RealtimeObjectChange =
  | { event: 'INSERT' | 'UPDATE'; new: BoardObject }
  | { event: 'DELETE'; old: { id: string } }

export function subscribeObjects(
  boardId: string,
  callback: (objects: BoardObject[]) => void,
  onRealtimeChange?: (change: RealtimeObjectChange) => void,
  /** Return false to skip refetch for this change (e.g. our own recent drags). */
  shouldScheduleRefetch?: (change: RealtimeObjectChange) => boolean
): () => void {
  const db = requireSupabase()
  const fetchAndNotify = async () => {
    const { data, error } = await db
      .from(TABLE)
      .select(ALL_COLUMNS)
      .eq('board_id', boardId)
    if (error) {
      console.error('subscribeObjects error', error)
      return
    }
    callback((data ?? []).map((row) => rowToBoardObject(row as Record<string, unknown>)))
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
        let change: RealtimeObjectChange | null = null
        if (onRealtimeChange && payload && typeof payload === 'object') {
          const ev = (payload.eventType ?? '').toUpperCase()
          if ((ev === 'INSERT' || ev === 'UPDATE') && payload.new && payload.new.id != null) {
            change = { event: ev as 'INSERT' | 'UPDATE', new: rowToBoardObject(payload.new) }
            onRealtimeChange(change)
          } else if (ev === 'DELETE' && payload.old && payload.old.id != null) {
            change = { event: 'DELETE', old: { id: String(payload.old.id) } }
            onRealtimeChange(change)
          }
        }
        if (!shouldScheduleRefetch || !change || shouldScheduleRefetch(change)) {
          scheduleRefetch()
        }
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
    .select(ALL_COLUMNS)
    .eq('board_id', boardId)
  if (error) throw error
  return (data ?? []).map((row) => rowToBoardObject(row as Record<string, unknown>))
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
    body_text: obj.body_text ?? null,
    color: obj.color ?? null,
    rotation: obj.rotation ?? 0,
    parent_id: obj.parent_id ?? null,
    from_id: obj.from_id ?? null,
    to_id: obj.to_id ?? null,
    style: obj.style ?? null,
    font_size: obj.font_size ?? null,
    font_color: obj.font_color ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** Payload to clear connector endpoint overrides (re-attach to objects). */
export type ClearConnectorOverridesPayload = {
  from_x: null
  from_y: null
  to_x: null
  to_y: null
}

/** Connector endpoint overrides can be set to null to clear (re-attach to objects). */
export async function updateObject(
  boardId: string,
  id: string,
  partial: Partial<BoardObject> | ClearConnectorOverridesPayload
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (partial.x !== undefined) row.x = partial.x
  if (partial.y !== undefined) row.y = partial.y
  if (partial.width !== undefined) row.width = partial.width
  if (partial.height !== undefined) row.height = partial.height
  if (partial.text !== undefined) row.text = partial.text
  if (partial.body_text !== undefined) row.body_text = partial.body_text
  if (partial.color !== undefined) row.color = partial.color
  if (partial.rotation !== undefined) row.rotation = partial.rotation
  if ('parent_id' in partial) row.parent_id = partial.parent_id ?? null
  if (partial.from_id !== undefined) row.from_id = partial.from_id
  if (partial.to_id !== undefined) row.to_id = partial.to_id
  if (partial.style !== undefined) row.style = partial.style
  if ('from_x' in partial) row.from_x = partial.from_x ?? null
  if ('from_y' in partial) row.from_y = partial.from_y ?? null
  if ('to_x' in partial) row.to_x = partial.to_x ?? null
  if ('to_y' in partial) row.to_y = partial.to_y ?? null
  if (partial.font_size !== undefined) row.font_size = partial.font_size
  if (partial.font_color !== undefined) row.font_color = partial.font_color
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
