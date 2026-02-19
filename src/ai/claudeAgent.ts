/**
 * AI command client: calls the Supabase Edge Function (ai-command) which
 * keeps ANTHROPIC_API_KEY server-side and validates JWT before calling Claude.
 */
import type { BoardObject } from '../types/board'
import { supabase } from '../supabase/config'

export type RunAIResult = { text: string; error?: string }

const getFunctionsUrl = (): string => {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) throw new Error('VITE_SUPABASE_URL is not set')
  return `${url.replace(/\/$/, '')}/functions/v1/ai-command`
}

/**
 * Run an AI command: sends prompt + board state to the Edge Function,
 * which validates JWT, calls Claude, executes tools, and returns the result.
 */
export async function runAICommand(
  userMessage: string,
  currentObjects: BoardObject[],
  boardId: string
): Promise<RunAIResult> {
  if (!supabase) {
    return { text: '', error: 'Supabase not configured' }
  }

  // Refresh session to avoid "expired" errors — must run before fetching a fresh token
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

  if (refreshError) {
    return { text: '', error: `Session error: ${refreshError.message}. Try signing out and back in.` }
  }

  const session = refreshData?.session ?? (await supabase.auth.getSession()).data?.session
  if (!session?.access_token) {
    return { text: '', error: 'Session expired. Please sign out and sign in again to use AI.' }
  }

  const url = getFunctionsUrl()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const messageLC = userMessage.trim().toLowerCase()
  const isComplexCommand = /arrange|grid|swot|journey|retro|template/.test(messageLC)
  const isCreationCommand = /create|add|new|put|place|draw|make/.test(messageLC)
  const isObjectRefCommand = /move|delete|remove|change.*color|update.*color/.test(messageLC)

  const objectsToSend: BoardObject[] =
    isComplexCommand || isCreationCommand || isObjectRefCommand
      ? currentObjects
      : []

  const body = JSON.stringify({
    userMessage: userMessage.trim(),
    currentObjects: objectsToSend,
    boardId,
  })

  let token = session.access_token
  let res: Response
  let retried = false

  do {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
    if (anonKey) headers['apikey'] = anonKey

    res = await fetch(url, { method: 'POST', headers, body })

    // Retry once on 401: refresh and try again (handles token expiry race)
    if (res.status === 401 && !retried) {
      retried = true
      const { data: retryData, error: retryError } = await supabase.auth.refreshSession()
      if (retryError) break
      const retrySession = retryData?.session ?? (await supabase.auth.getSession()).data?.session
      if (retrySession?.access_token) {
        token = retrySession.access_token
        continue
      }
    }
    break
  } while (true)

  const json = await res.json().catch(() => ({}))
  const errMsg =
    (json?.error as string) ||
    (res.status === 401
      ? 'Session expired. Please sign out and sign in again.'
      : res.status === 403
        ? 'Access denied'
        : res.status >= 500
          ? 'AI service error. Try again later.'
          : null)

  if (!res.ok) {
    return { text: '', error: errMsg || `Request failed (${res.status})` }
  }

  return { text: json.text ?? '', error: json.error }
}
