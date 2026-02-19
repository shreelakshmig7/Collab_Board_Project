import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the Supabase client before importing the module under test ──────────
const mockUpsert = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()

mockUpsert.mockReturnValue({ then: (cb: (r: { error: null }) => void) => Promise.resolve(cb({ error: null })) })
mockDelete.mockReturnValue({ eq: mockEq })
mockEq.mockReturnValue({ then: (cb: (r: { error: null }) => void) => Promise.resolve(cb({ error: null })) })

vi.mock('./config', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
      delete: mockDelete,
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}))

// ── Import after mock is set up ───────────────────────────────────────────────
import { upsertPresence, removePresence } from './presence'
import { supabase } from './config'

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('upsertPresence', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls from() with the presence table', async () => {
    await upsertPresence('uid-1', 'Alice')
    expect(supabase!.from).toHaveBeenCalledWith('presence')
  })

  it('upserts with correct user_id and display_name', async () => {
    await upsertPresence('uid-1', 'Alice')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'uid-1', display_name: 'Alice' }),
      { onConflict: 'user_id' }
    )
  })

  it('includes last_seen_at timestamp in the upsert payload', async () => {
    await upsertPresence('uid-1', 'Alice')
    const payload = mockUpsert.mock.calls[0][0]
    expect(payload).toHaveProperty('last_seen_at')
    expect(new Date(payload.last_seen_at).toString()).not.toBe('Invalid Date')
  })

  it('accepts null displayName', async () => {
    await upsertPresence('uid-2', null)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'uid-2', display_name: null }),
      expect.any(Object)
    )
  })
})

describe('removePresence', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls from() with the presence table', () => {
    removePresence('uid-1')
    expect(supabase!.from).toHaveBeenCalledWith('presence')
  })

  it('filters by the correct user_id', () => {
    removePresence('uid-99')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'uid-99')
  })
})
