import { useState } from 'react'
import { signInWithGoogle, signUpWithEmail, signInWithEmail } from '../supabase/auth'
import { isSupabaseConfigured } from '../supabase/config'

type Mode = 'choose' | 'google' | 'signin' | 'signup'

/** Static SVG network-node pattern — rendered once, zero network cost */
function NetworkPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="net" x="0" y="0" width="140" height="140" patternUnits="userSpaceOnUse">
          <circle cx="0"   cy="0"   r="2"   fill="white" opacity="0.35" />
          <circle cx="70"  cy="45"  r="1.5" fill="white" opacity="0.25" />
          <circle cx="140" cy="0"   r="2"   fill="white" opacity="0.35" />
          <circle cx="35"  cy="105" r="1.5" fill="white" opacity="0.25" />
          <circle cx="105" cy="85"  r="2"   fill="white" opacity="0.3"  />
          <circle cx="140" cy="140" r="2"   fill="white" opacity="0.35" />
          <circle cx="0"   cy="140" r="2"   fill="white" opacity="0.35" />
          <circle cx="20"  cy="60"  r="1"   fill="white" opacity="0.2"  />
          <circle cx="120" cy="110" r="1"   fill="white" opacity="0.2"  />
          <line x1="0"   y1="0"   x2="70"  y2="45"  stroke="white" strokeWidth="0.5" opacity="0.2" />
          <line x1="70"  y1="45"  x2="140" y2="0"   stroke="white" strokeWidth="0.5" opacity="0.2" />
          <line x1="70"  y1="45"  x2="105" y2="85"  stroke="white" strokeWidth="0.5" opacity="0.2" />
          <line x1="0"   y1="0"   x2="35"  y2="105" stroke="white" strokeWidth="0.5" opacity="0.15"/>
          <line x1="35"  y1="105" x2="105" y2="85"  stroke="white" strokeWidth="0.5" opacity="0.2" />
          <line x1="105" y1="85"  x2="140" y2="140" stroke="white" strokeWidth="0.5" opacity="0.2" />
          <line x1="35"  y1="105" x2="0"   y2="140" stroke="white" strokeWidth="0.5" opacity="0.15"/>
          <line x1="105" y1="85"  x2="140" y2="0"   stroke="white" strokeWidth="0.5" opacity="0.15"/>
          <line x1="20"  y1="60"  x2="70"  y2="45"  stroke="white" strokeWidth="0.5" opacity="0.12"/>
          <line x1="120" y1="110" x2="105" y2="85"  stroke="white" strokeWidth="0.5" opacity="0.12"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#net)" />
    </svg>
  )
}

/** 4-point sparkle decoration */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2 C12 2 13 8 13.5 10.5 C16 11 22 12 22 12 C22 12 16 13 13.5 13.5 C13 16 12 22 12 22 C12 22 11 16 10.5 13.5 C8 13 2 12 2 12 C2 12 8 11 10.5 10.5 C11 8 12 2 12 2 Z" />
    </svg>
  )
}

/** Two overlapping rounded-square icon, matching the reference */
function AppIcon() {
  return (
    <div className="relative w-9 h-9 flex-shrink-0" aria-hidden="true">
      <div className="absolute top-0 left-0 w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500" />
      <div className="absolute bottom-0 right-0 w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-400 opacity-90" />
    </div>
  )
}

const googleSvg = (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const darkInputCls = 'w-full h-12 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:border-white/40 transition-all duration-200'
const pillPrimaryCls = 'w-full flex items-center justify-center gap-3 h-12 px-6 rounded-full bg-white/90 hover:bg-white text-gray-800 font-medium text-sm transition-all duration-200 shadow-md focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950 focus:outline-none'
const ghostLinkCls = 'text-white/60 text-sm hover:text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950 focus:outline-none rounded'

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
      if (err) { setError(err.message); return }
      if (data?.url) window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    }
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!email.trim() || !password) { setError('Enter email and password'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    try {
      const { data, error: err } = await signUpWithEmail(email.trim(), password)
      if (err) { setError(err.message); return }
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
    if (!email.trim() || !password) { setError('Enter email and password'); return }
    try {
      const { error: err } = await signInWithEmail(email.trim(), password)
      if (err) { setError(err.message); return }
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    }
  }

  const pageShell = (children: React.ReactNode) => (
    <main
      id="main-content"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900"
    >
      <NetworkPattern />
      {/* Ambient glow blobs — static, pointer-events-none, no Konva impact */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/25 blur-3xl pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/25 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-[420px] mx-4">
        {children}
      </div>

      <Sparkle className="absolute bottom-7 right-9 w-7 h-7 text-white/50" />
    </main>
  )

  if (!supabaseReady) {
    return pageShell(
      <div className="px-10 py-10 bg-white/[0.08] backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
        <p className="p-3 bg-amber-400/20 rounded-xl text-sm text-amber-200 border border-amber-400/30">
          Supabase is not configured. Copy{' '}
          <code className="bg-amber-400/20 px-1 rounded">.env.example</code> to{' '}
          <code className="bg-amber-400/20 px-1 rounded">.env</code> and add your keys.
        </p>
      </div>
    )
  }

  return pageShell(
    <div className="px-10 py-10 bg-white/[0.08] backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl flex flex-col items-center gap-6">

      {/* Logo + brand */}
      <div className="flex items-center gap-3">
        <AppIcon />
        <span className="text-2xl font-semibold text-white tracking-tight">CollabBoard</span>
      </div>

      {/* ── Choose mode ── */}
      {mode === 'choose' && (
        <>
          <p className="text-white/55 text-sm text-center -mt-2">
            Sign in to continue collaborating
          </p>

          <div className="w-full flex flex-col items-center gap-4">
            <button type="button" onClick={handleGoogleSignIn} className={pillPrimaryCls}>
              {googleSvg}
              Continue with Google
            </button>

            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/35 text-xs">or</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            <button
              type="button"
              onClick={() => setMode('signup')}
              className={ghostLinkCls}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
              className={ghostLinkCls}
            >
              Sign in with email
            </button>
          </div>
        </>
      )}

      {/* ── Email sign-in / sign-up ── */}
      {(mode === 'signin' || mode === 'signup') && (
        <>
          <p className="text-white/55 text-sm text-center -mt-2">
            {mode === 'signup' ? 'Create your account' : 'Sign in with your email'}
          </p>

          {message && (
            <p className="w-full p-3 bg-green-400/20 text-green-200 text-sm rounded-xl border border-green-400/30">
              {message}
            </p>
          )}
          {error && (
            <p className="w-full p-3 bg-red-400/20 text-red-200 text-sm rounded-xl border border-red-400/30">
              {error}
            </p>
          )}

          <form
            className="w-full flex flex-col gap-4"
            onSubmit={mode === 'signup' ? handleEmailSignUp : handleEmailSignIn}
          >
            <label htmlFor="login-email" className="sr-only">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={darkInputCls}
              autoComplete="email"
            />

            <label htmlFor="login-password" className="sr-only">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={darkInputCls}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setMode('choose'); setError(null); setMessage(null); setEmail(''); setPassword('') }}
                className="px-4 py-2 text-white/55 text-sm hover:text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-950 focus:outline-none rounded-xl"
              >
                Back
              </button>
              <button type="submit" className={`${pillPrimaryCls} flex-1`}>
                {mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </div>
          </form>

          {mode === 'signin' && (
            <button type="button" onClick={() => setMode('signup')} className={ghostLinkCls}>
              Create an account instead
            </button>
          )}
        </>
      )}
    </div>
  )
}
