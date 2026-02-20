import { describe, it, expect } from 'vitest'
import { getAiCommandPolicy } from './aiCommandPolicy'

describe('getAiCommandPolicy', () => {
  it('treats simple sticky creation as simple + forced tool', () => {
    const p = getAiCommandPolicy('Add a blue sticky-note')
    expect(p.mode).toBe('simple')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.forcedToolName).toBe('createStickyNote')
  })

  it('treats template commands as complex', () => {
    const p = getAiCommandPolicy('Create a SWOT analysis template with four quadrants')
    expect(p.mode).toBe('complex')
    expect(p.maxTurns).toBeGreaterThan(1)
    expect(p.allowGetBoardState).toBe(true)
  })

  it('treats multi-step prompts as complex', () => {
    const p = getAiCommandPolicy('Add a sticky note and connect it to the frame')
    expect(p.mode).toBe('complex')
  })

  it('keeps basic ops single-turn', () => {
    const p = getAiCommandPolicy('Delete the red sticky note')
    expect(p.mode).toBe('simple')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
  })
})

