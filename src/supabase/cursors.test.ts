import { describe, it, expect } from 'vitest'
import { cursorColorFromUid } from './cursors'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

describe('cursorColorFromUid', () => {
  it('returns a valid hex colour string', () => {
    expect(cursorColorFromUid('any-uid')).toMatch(HEX_COLOR)
  })

  it('is deterministic — same uid always returns same colour', () => {
    const uid = 'user-abc-123'
    expect(cursorColorFromUid(uid)).toBe(cursorColorFromUid(uid))
  })

  it('returns different colours for different uids', () => {
    const colours = new Set(
      ['uid-1', 'uid-2', 'uid-3', 'uid-4', 'uid-5', 'uid-6', 'uid-7', 'uid-8']
        .map(cursorColorFromUid)
    )
    // With 8 possible colours and 8 distinct inputs, we expect at least 2 unique colours
    expect(colours.size).toBeGreaterThan(1)
  })

  it('handles an empty string without throwing', () => {
    expect(() => cursorColorFromUid('')).not.toThrow()
    expect(cursorColorFromUid('')).toMatch(HEX_COLOR)
  })

  it('handles a very long uid without throwing', () => {
    const longUid = 'x'.repeat(10_000)
    expect(() => cursorColorFromUid(longUid)).not.toThrow()
    expect(cursorColorFromUid(longUid)).toMatch(HEX_COLOR)
  })
})
