import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BoardsListPage from './BoardsListPage'
import * as boards from '../supabase/boards'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../supabase/boards')
vi.mock('../supabase/objects')
vi.mock('../supabase/cursors')
vi.mock('./TopBar', () => ({ default: () => <div data-testid="topbar">TopBar</div> }))

const mockUser = { uid: 'user-1', displayName: 'Test User', email: 'test@example.com' }
const mockPresenceNames = ['You', 'Other']

const myBoard: boards.Board = {
  id: 'board-1',
  name: 'My Board',
  user_id: 'user-1',
  created_at: '2025-01-01T00:00:00Z',
}
const sharedBoard: boards.Board = {
  id: 'board-2',
  name: 'Shared Board',
  user_id: 'other-owner',
  created_at: '2025-01-02T00:00:00Z',
}

describe('BoardsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading then two sections: My Boards and Shared with you', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard, sharedBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Loading your boards/)).toBeInTheDocument()
    await waitFor(() => {
      expect(boards.listBoards).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /My Boards/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Shared with you/i })).toBeInTheDocument()
    })
  })

  it('splits boards into My Boards (owned) and Shared with you (not owned)', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard, sharedBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    expect(screen.getByText('My Board')).toBeInTheDocument()
    expect(screen.getByText('Shared Board')).toBeInTheDocument()
  })

  it('shows empty state when no my boards', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([sharedBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    expect(screen.getByText(/No boards yet/)).toBeInTheDocument()
  })

  it('shows empty state when no shared boards', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    expect(screen.getByText(/No shared boards/)).toBeInTheDocument()
  })

  it('My Boards cards show per-card action menu', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    const menuBtn = screen.getByRole('button', { name: /open actions for my board/i })
    await userEvent.click(menuBtn)
    expect(screen.getByRole('button', { name: /^rename$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('clicking board name navigates to board', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    mockNavigate.mockClear()
    const nameButton = screen.getByRole('button', { name: /My Board/i })
    await userEvent.click(nameButton)
    expect(mockNavigate).toHaveBeenCalledWith('/board/board-1')
  })

  it('Delete opens confirmation dialog', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    const menuBtn = screen.getByRole('button', { name: /open actions for my board/i })
    await userEvent.click(menuBtn)
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i })
    await userEvent.click(deleteBtn)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Delete board\?/)).toBeInTheDocument()
      expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()
    })
  })

  it('Rename opens modal when exactly one board selected', async () => {
    vi.mocked(boards.listBoards).mockResolvedValue([myBoard])
    render(
      <MemoryRouter>
        <BoardsListPage user={mockUser} presenceNames={mockPresenceNames} />
      </MemoryRouter>
    )
    await waitFor(() => expect(boards.listBoards).toHaveBeenCalled())
    const menuBtn = screen.getByRole('button', { name: /open actions for my board/i })
    await userEvent.click(menuBtn)
    const renameBtn = screen.getByRole('button', { name: /^rename$/i })
    await userEvent.click(renameBtn)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/board name/i)).toHaveValue('My Board')
    })
  })
})
