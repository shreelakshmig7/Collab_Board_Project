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
  const { data: { session }, error: sessionError } = await supabase?.auth.getSession() ?? { data: { session: null }, error: null }

  if (!supabase) {
    return { text: '', error: 'Supabase not configured' }
  }
  if (sessionError) {
    return { text: '', error: sessionError.message }
  }
  if (!session?.access_token) {
    return { text: '', error: 'Please sign in to use AI commands' }
  }

  const url = getFunctionsUrl()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      userMessage: userMessage.trim(),
      currentObjects,
      boardId,
    }),
  })

  const json = await res.json().catch(() => ({}))
  const errMsg = (json?.error as string) || (res.status === 401 ? 'Session expired. Please sign in again.' : res.status === 403 ? 'Access denied' : res.status >= 500 ? 'AI service error. Try again later.' : null)

  if (!res.ok) {
    return { text: '', error: errMsg || `Request failed (${res.status})` }
  }

  return { text: json.text ?? '', error: json.error }
}
