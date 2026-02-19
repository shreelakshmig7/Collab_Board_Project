import { useState } from 'react'
import { signInWithGoogle, signUpWithEmail, signInWithEmail } from '../supabase/auth'
import { isSupabaseConfigured } from '../supabase/config'

type Mode = 'choose' | 'google' | 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const supabaseReady = isSupabaseConfigured()

  async function handleGoogleSignIn() {
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

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!email.trim() || !password) {
      setError('Enter email and password')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    try {
      const { data, error: err } = await signUpWithEmail(email.trim(), password)
      if (err) {
        setError(err.message)
        return
      }
      if (data?.user && !data.session) {
        setMessage('Check your email to confirm your account, then sign in.')
        setMode('signin')
      } else if (data?.session) {
        window.location.reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed')
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter email and password')
      return
    }
    try {
      const { error: err } = await signInWithEmail(email.trim(), password)
      if (err) {
        setError(err.message)
        return
      }
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    }
  }

  if (!supabaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="p-8 max-w-[400px] w-full">
          <p className="p-3 bg-amber-100 rounded-lg text-sm text-amber-800">
            Supabase is not configured. Copy <code className="bg-amber-200 px-1 rounded">.env.example</code> to <code className="bg-amber-200 px-1 rounded">.env</code> and add your keys.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center bg-white pt-24">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        {/* Logo / app name - Gmail style */}
        <h1 className="text-3xl font-normal text-gray-800 mb-2">CollabBoard</h1>
        {mode === 'choose' && (
          <>
            <p className="text-lg text-gray-700 mb-8">Sign in to continue</p>
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 h-12 px-4 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-4 my-2">
                <div className="flex-1 h-px bg-gray-300" />
                <span className="text-sm text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-300" />
              </div>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
                className="w-full h-12 px-4 text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              >
                Sign in with email
              </button>
            </div>
          </>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <>
            <p className="text-lg text-gray-700 mb-6">
              {mode === 'signup' ? 'Create your account' : 'Sign in with your email'}
            </p>
            {message && (
              <p className="w-full mb-4 p-3 bg-green-50 text-green-800 text-sm rounded-lg">{message}</p>
            )}
            {error && (
              <p className="w-full mb-4 text-red-600 text-sm">{error}</p>
            )}
            <form
              className="w-full flex flex-col gap-4"
              onSubmit={mode === 'signup' ? handleEmailSignUp : handleEmailSignIn}
            >
              <label htmlFor="login-email" className="sr-only">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="Email address…"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
                autoComplete="email"
              />
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="Password…"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('choose'); setError(null); setMessage(null); setEmail(''); setPassword(''); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 h-12 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
                >
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </div>
            </form>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="mt-4 text-sm text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none rounded"
              >
                Create an account
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
