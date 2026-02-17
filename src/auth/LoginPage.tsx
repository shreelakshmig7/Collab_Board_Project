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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3f4f6',
      }}
    >
      <div
        style={{
          padding: 32,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: 360,
        }}
      >
        <h1 style={{ margin: '0 0 24px', fontSize: 24 }}>CollabBoard</h1>
        {!supabaseReady && (
          <p
            style={{
              marginBottom: 20,
              padding: 12,
              background: '#fef3c7',
              borderRadius: 8,
              fontSize: 13,
              color: '#92400e',
            }}
          >
            Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable sign-in.
          </p>
        )}
        <button
          type="button"
          onClick={handleSignIn}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            cursor: 'pointer',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 8,
          }}
        >
          Sign in with Google
        </button>
        {error && (
          <p style={{ marginTop: 16, color: '#b91c1c', fontSize: 14 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
