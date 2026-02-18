import { supabase } from './config'
import type { AppUser } from '../types/user'

function toAppUser(uid: string, displayName: string | null): AppUser {
  return { uid, displayName }
}

export function signInWithGoogle() {
  if (!supabase) {
    return Promise.reject(
      new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
    )
  }
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export function signUpWithEmail(email: string, password: string) {
  if (!supabase) {
    return Promise.reject(
      new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
    )
  }
  return supabase.auth.signUp({ email, password })
}

export function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    return Promise.reject(
      new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
    )
  }
  return supabase.auth.signInWithPassword({ email, password })
}

export function signOut() {
  if (!supabase) return Promise.resolve()
  return supabase.auth.signOut()
}

export function onAuthStateChanged(callback: (user: AppUser | null) => void): () => void {
  const client = supabase
  if (!client) {
    callback(null)
    return () => {}
  }
  const getSessionAndNotify = async () => {
    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      callback(null)
      return
    }
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? null
    callback(toAppUser(user.id, name))
  }
  getSessionAndNotify()
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      callback(null)
      return
    }
    const u = session.user
    const name = u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? null
    callback(toAppUser(u.id, name))
  })
  return () => subscription.unsubscribe()
}
