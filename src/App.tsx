import { useEffect, useState } from 'react'
import { onAuthStateChanged } from './supabase/auth'
import type { AppUser } from './types/user'
import LoginPage from './auth/LoginPage'
import BoardPage from './board/BoardPage'

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged((u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  if (!user) {
    return <LoginPage />
  }

  return <BoardPage user={user} />
}
