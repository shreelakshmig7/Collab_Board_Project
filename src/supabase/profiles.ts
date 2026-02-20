/**
 * Profiles: email and display_name for invite-by-email lookup.
 * App upserts on login so we can resolve email → user_id.
 */
import { supabase } from './config'

const TABLE = 'profiles'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

export type Profile = {
  user_id: string
  email: string | null
  display_name: string | null
  updated_at: string
}

/** Upsert current user's profile (call on login). Email stored lowercase for invite lookup. */
export async function upsertProfile(
  userId: string,
  data: { email?: string | null; display_name?: string | null }
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  }
  if (data.email !== undefined) row.email = data.email != null ? data.email.trim().toLowerCase() : null
  if (data.display_name !== undefined) row.display_name = data.display_name
  const { error } = await requireSupabase()
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id' })
  if (error) throw error
}

/** Look up user_id by email (for invite-by-email). Returns null if not found. */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select('user_id')
    .eq('email', normalized)
    .maybeSingle()
  if (error) throw error
  return data?.user_id != null ? String(data.user_id) : null
}

/** Get display name and email for a user (for "People with access" list). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select('user_id, email, display_name, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    user_id: String(data.user_id),
    email: data.email != null ? String(data.email) : null,
    display_name: data.display_name != null ? String(data.display_name) : null,
    updated_at: String(data.updated_at),
  }
}
