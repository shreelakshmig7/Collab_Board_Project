import { useState } from 'react'
import { signInWithGoogle } from '../supabase/auth'
import { isSupabaseConfigured } from '../supabase/config'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const supabaseReady = isSupabaseConfigured()

  async function handleSignIn() {
    setError(null)
    try {
      const { data, error: err } = await signInWithGoogle()
      if (err) {
        setError(err.message)
        return
      }
      if (data?.url) window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded-xl shadow-lg text-center max-w-[360px]">
        <h1 className="m-0 mb-6 text-2xl font-semibold">CollabBoard</h1>
        {!supabaseReady && (
          <p className="mb-5 p-3 bg-amber-100 rounded-lg text-sm text-amber-800">
            Supabase is not configured. Copy <code className="bg-amber-200 px-1 rounded">.env.example</code> to <code className="bg-amber-200 px-1 rounded">.env</code> and add <code className="bg-amber-200 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-amber-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable sign-in.
          </p>
        )}
        <button
          type="button"
          onClick={handleSignIn}
          className="px-6 py-3 text-base cursor-pointer bg-blue-600 text-white border-0 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign in with Google
        </button>
        {error && (
          <p className="mt-4 text-red-600 text-sm">{error}</p>
        )}
      </div>
    </div>
  )
}
