import { supabase } from './config'
import { PRESENCE_TIMEOUT_MS, PRESENCE_POLL_MS } from '../constants'

const TABLE = 'presence'

export type PresenceUser = {
  uid: string
  displayName: string | null
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

/** Returns true for expected network-unavailable errors that should be silently ignored. */
function isNetworkError(error: { message?: string } | null | undefined): boolean {
  const msg = error?.message ?? ''
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network request failed') ||
    msg.includes('Load failed')
  )
}

/** Mark current user as online (call on login and on heartbeat). Returns a promise so callers can await before subscribing. */
export function upsertPresence(userId: string, displayName: string | null): Promise<void> {
  const chain = requireSupabase()
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        display_name: displayName,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .then(({ error }) => {
      if (error && !isNetworkError(error)) console.error('upsertPresence', error)
    })
  return Promise.resolve(chain).catch(() => {
    // Network unavailable — silently skip
  })
}

/** Remove current user from presence (call on logout / beforeunload). Returns a promise so callers can await before signOut. */
export async function removePresence(userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
  if (error && !isNetworkError(error)) console.error('removePresence', error)
}

/** Subscribe to the list of online users. Callback receives all rows in presence (show on login, remove on logout); call removePresence on cleanup. */
export function subscribePresence(
  callback: (users: PresenceUser[]) => void
): () => void {
  const db = requireSupabase()
  const fetchAndNotify = async () => {
    try {
      const staleThreshold = new Date(Date.now() - PRESENCE_TIMEOUT_MS).toISOString()
      const { data, error } = await db
        .from(TABLE)
        .select('user_id, display_name')
        .gte('last_seen_at', staleThreshold)
      if (error) {
        if (!isNetworkError(error)) {
          console.error('subscribePresence error', error)
          callback([])
        }
        // Network error: silently skip — presence will resume once back online
        return
      }
      const users: PresenceUser[] = (data ?? []).map((row) => ({
        uid: String(row.user_id),
        displayName: row.display_name != null ? String(row.display_name) : null,
      }))
      callback(users)
    } catch {
      // Unexpected throw — silently skip, will retry on next poll
    }
  }
  fetchAndNotify()
  const channel = db
    .channel('presence:global')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      () => fetchAndNotify()
    )
    .subscribe((status, err) => {
      if (status !== 'SUBSCRIBED') {
        console.warn('[Realtime] presence subscription status:', status, err ?? '')
      }
    })
  const pollId = setInterval(fetchAndNotify, PRESENCE_POLL_MS)
  return () => {
    clearInterval(pollId)
    db.removeChannel(channel)
  }
}
