import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEq = vi.fn()
const mockDelete = vi.fn()

mockDelete.mockReturnValue({ eq: mockEq })
mockEq.mockReturnValue(Promise.resolve({ error: null }))

vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(() => ({ delete: mockDelete })),
  },
}))

vi.mock('./boards', () => ({
  getBoard: vi.fn(),
}))

import { deleteAllObjects } from './objects'
import { getBoard } from './boards'

describe('deleteAllObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when caller is not the board owner', async () => {
    vi.mocked(getBoard).mockResolvedValue({
      id: 'board-1',
      name: 'Test',
      user_id: 'owner-uid',
      created_at: new Date().toISOString(),
      public_access_level: 'private',
      share_slug: null,
    })
    await expect(deleteAllObjects('board-1', 'editor-uid')).rejects.toThrow(
      'Only the board owner can clear the board'
    )
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('throws when board is not found', async () => {
    vi.mocked(getBoard).mockResolvedValue(null)
    await expect(deleteAllObjects('board-1', 'owner-uid')).rejects.toThrow('Board not found')
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes when caller is the board owner', async () => {
    vi.mocked(getBoard).mockResolvedValue({
      id: 'board-1',
      name: 'Test',
      user_id: 'owner-uid',
      created_at: new Date().toISOString(),
      public_access_level: 'private',
      share_slug: null,
    })
    await deleteAllObjects('board-1', 'owner-uid')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('board_id', 'board-1')
  })
})
