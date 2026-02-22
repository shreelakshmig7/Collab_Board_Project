/**
 * Unit tests for the board-state routing logic in claudeAgent.ts.
 * These test the regex decisions (isBulkCreation, isQueryCommand) in isolation
 * without invoking the network — the Supabase/fetch calls are not exercised here.
 */
import { describe, it, expect } from 'vitest'

// ── Mirror the exact regexes from claudeAgent.ts ────────────────────────────
// If those regexes change, update these too (keep in sync).

const BULK_QUANTITY_RE = /\b([3-9]|\d{2,}|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozen|several|many|multiple|bunch)\b/i
const BULK_OBJECT_TYPE_RE = /\b(sticky|stickies|note|notes|rect|rectangles?|squares?|circles?|shape|shapes|frame|frames|text)\b/i
const CREATION_RE = /create|add|new|put|place|draw|make/i
const COMPLEX_RE = /arrange|grid|swot|journey|retro|template|space|align|distribute|kanban/i
const OBJECT_REF_RE = /\b(move|drag|delete|remove|resize|rotate|change|update|rename)\b|color/i
const QUERY_RE_INTENT = /\b(how many|count|list|what|describe|show me|tell me)\b/i
const QUERY_RE_OBJECT = /\b(objects?|sticky|stickies|frame|frames|shape|shapes|note|notes|board|canvas|rect|circle|text)\b/i

function classifyMessage(msg: string) {
  const lc = msg.trim().toLowerCase()
  const isCreation = CREATION_RE.test(lc)
  const isBulkCreation =
    isCreation &&
    BULK_QUANTITY_RE.test(lc) &&
    BULK_OBJECT_TYPE_RE.test(lc)
  const isComplexCommand = COMPLEX_RE.test(lc)
  const isObjectRefCommand = OBJECT_REF_RE.test(lc)
  const isQueryCommand = QUERY_RE_INTENT.test(lc) && QUERY_RE_OBJECT.test(lc)

  if (isBulkCreation) return 'bulk'
  if (isComplexCommand || isCreation || isObjectRefCommand || isQueryCommand) return 'sendBoardState'
  return 'noBoardState'
}

describe('claudeAgent board-state routing', () => {
  // ── Query commands — must send board state ────────────────────────────────
  it('sends board state for "how many objects are there in the board"', () => {
    expect(classifyMessage('How many objects are there in the board')).toBe('sendBoardState')
  })

  it('sends board state for "how many sticky notes are there"', () => {
    expect(classifyMessage('How many sticky notes are there')).toBe('sendBoardState')
  })

  it('sends board state for "list all objects"', () => {
    expect(classifyMessage('List all objects')).toBe('sendBoardState')
  })

  it('sends board state for "what frames are on the board"', () => {
    expect(classifyMessage('What frames are on the board')).toBe('sendBoardState')
  })

  it('sends board state for "describe the canvas"', () => {
    expect(classifyMessage('Describe the canvas')).toBe('sendBoardState')
  })

  it('sends board state for "show me all the shapes"', () => {
    expect(classifyMessage('Show me all the shapes')).toBe('sendBoardState')
  })

  it('sends board state for "tell me what stickies are on the board"', () => {
    expect(classifyMessage('Tell me what stickies are on the board')).toBe('sendBoardState')
  })

  // ── Query without object word — should NOT trigger query path ────────────
  it('does NOT treat "tell me a joke" as a query command', () => {
    expect(classifyMessage('Tell me a joke')).toBe('noBoardState')
  })

  it('does NOT treat "help me brainstorm ideas" as a query command', () => {
    expect(classifyMessage('Help me brainstorm ideas')).toBe('noBoardState')
  })

  // "What should I add?" contains "add" (CREATION_RE) — sending board state is correct
  it('sends board state for "what should I add?" via creation path', () => {
    expect(classifyMessage('What should I add?')).toBe('sendBoardState')
  })

  // ── Bulk creation — must NOT send board state ─────────────────────────────
  it('strips board state for "create 50 sticky notes"', () => {
    expect(classifyMessage('Create 50 sticky notes')).toBe('bulk')
  })

  it('strips board state for "add 20 rectangles"', () => {
    expect(classifyMessage('Add 20 rectangles')).toBe('bulk')
  })

  // ── Other paths unaffected ────────────────────────────────────────────────
  it('sends board state for single creation (unchanged)', () => {
    expect(classifyMessage('Create a sticky note')).toBe('sendBoardState')
  })

  it('sends board state for move command (unchanged)', () => {
    expect(classifyMessage('Move the red sticky to the right')).toBe('sendBoardState')
  })
})
