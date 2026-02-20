import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShareModal from './ShareModal'
import * as boardMembers from '../supabase/boardMembers'

vi.mock('../supabase/boardMembers')

const defaultBoard = {
  id: 'board-1',
  name: 'Test Board',
  user_id: 'owner-1',
  created_at: '2025-01-01T00:00:00Z',
}

describe('ShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(boardMembers.listBoardMembers).mockResolvedValue([])
    vi.mocked(boardMembers.listBoardInvites).mockResolvedValue([])
  })

  it('renders nothing when not open', () => {
    render(
      <ShareModal
        isOpen={false}
        onClose={() => {}}
        board={defaultBoard}
        boardId="board-1"
        currentUserId="owner-1"
        isOwner={true}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows dialog with title and People with access when open', async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        board={defaultBoard}
        boardId="board-1"
        currentUserId="owner-1"
        isOwner={true}
      />
    )
    await waitFor(() => {
      expect(boardMembers.listBoardMembers).toHaveBeenCalledWith('board-1')
      expect(boardMembers.listBoardInvites).toHaveBeenCalledWith('board-1')
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Share "Test Board"/ })).toBeInTheDocument()
    expect(screen.getByText('People with access')).toBeInTheDocument()
  })

  it('shows Add by email and Invite when owner', async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        board={defaultBoard}
        boardId="board-1"
        currentUserId="owner-1"
        isOwner={true}
      />
    )
    await waitFor(() => expect(boardMembers.listBoardMembers).toHaveBeenCalled())
    expect(screen.getByLabelText(/Email to invite/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Invite/i })).toBeInTheDocument()
  })

  it('does not show Add by email or Invite when not owner', async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        board={defaultBoard}
        boardId="board-1"
        currentUserId="editor-1"
        isOwner={false}
      />
    )
    await waitFor(() => expect(boardMembers.listBoardMembers).toHaveBeenCalled())
    expect(screen.queryByLabelText(/Email to invite/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Invite/i })).not.toBeInTheDocument()
  })

  it('does not show Copy link or Link section', async () => {
    render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        board={defaultBoard}
        boardId="board-1"
        currentUserId="owner-1"
        isOwner={true}
      />
    )
    await waitFor(() => expect(boardMembers.listBoardMembers).toHaveBeenCalled())
    expect(screen.queryByLabelText(/Share link/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copy link/i })).not.toBeInTheDocument()
  })
})
