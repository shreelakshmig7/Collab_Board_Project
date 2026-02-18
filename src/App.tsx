import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from './supabase/auth'
import type { AppUser } from './types/user'
import LoginPage from './auth/LoginPage'
import BoardsListPage from './board/BoardsListPage'
import BoardPage from './board/BoardPage'
import { getBoard } from './supabase/boards'

function BoardPageWrapper({ user }: { user: AppUser }) {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const [boardName, setBoardName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!boardId) {
      setNotFound(true)
      return
    }
    let cancelled = false
    getBoard(boardId)
      .then((board) => {
        if (cancelled) return
        if (!board) {
          setNotFound(true)
          return
        }
        setBoardName(board.name)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
    return () => {
      cancelled = true
    }
  }, [boardId])

  useEffect(() => {
    if (notFound) navigate('/', { replace: true })
  }, [notFound, navigate])

  if (!boardId || notFound || boardName === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading board…</p>
      </div>
    )
  }

  return <BoardPage user={user} boardId={boardId} boardName={boardName} />
}

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BoardsListPage user={user} />} />
        <Route path="/board/:boardId" element={<BoardPageWrapper user={user} />} />
      </Routes>
    </BrowserRouter>
  )
}
