import { supabase } from './config'
import { PRESENCE_TIMEOUT_MS } from '../constants'

const TABLE = 'presence'

export type PresenceUser = {
  uid: string
  displayName: string | null
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

/** Mark current user as online (call on login and on heartbeat). Returns a promise so callers can await before subscribing. */
export function upsertPresence(userId: string, displayName: string | null): Promise<void> {
  return Promise.resolve(
    requireSupabase()
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
        if (error) console.error('upsertPresence', error)
      })
  )
}

/** Remove current user from presence (call on logout / beforeunload). */
export function removePresence(userId: string) {
  requireSupabase()
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .then(({ error }) => error && console.error('removePresence', error))
}

/** Subscribe to the list of online users. Callback receives all rows in presence (show on login, remove on logout); call removePresence on cleanup. */
export function subscribePresence(
  callback: (users: PresenceUser[]) => void
): () => void {
  const db = requireSupabase()
  const fetchAndNotify = async () => {
    const staleThreshold = new Date(Date.now() - PRESENCE_TIMEOUT_MS).toISOString()
    const { data, error } = await db
      .from(TABLE)
      .select('user_id, display_name')
      .gte('last_seen_at', staleThreshold)
    if (error) {
      console.error('subscribePresence error', error)
      callback([])
      return
    }
    const users: PresenceUser[] = (data ?? []).map((row) => ({
      uid: String(row.user_id),
      displayName: row.display_name != null ? String(row.display_name) : null,
    }))
    callback(users)
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
  return () => {
    db.removeChannel(channel)
  }
}
