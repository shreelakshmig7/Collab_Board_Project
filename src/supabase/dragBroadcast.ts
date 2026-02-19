import { supabase } from './config'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type DragMovePayload = {
  userId: string
  objectId: string
  x: number
  y: number
}

/**
 * Subscribe to live drag-move broadcasts for a board.
 * Returns [channel, unsubscribe], or null if Supabase is not configured.
 *
 * Use the same channel object to send broadcasts — this avoids any DB round-trip
 * during drag, which is what causes the flash/lag in the first place.
 */
export function subscribeDragMoves(
  boardId: string,
  onMove: (payload: DragMovePayload) => void
): [RealtimeChannel, () => void] | null {
  if (!supabase) return null
  const db = supabase
  const channel = db
    .channel(`drag:${boardId}`)
    .on('broadcast', { event: 'drag_move' }, ({ payload }) => {
      if (payload) onMove(payload as DragMovePayload)
    })
    .subscribe()
  return [channel, () => db.removeChannel(channel)]
}

/** Send a drag-move broadcast on an already-subscribed channel (fire-and-forget). */
export function sendDragMove(channel: RealtimeChannel, payload: DragMovePayload): void {
  channel
    .send({ type: 'broadcast', event: 'drag_move', payload })
    .catch(() => {})
}
