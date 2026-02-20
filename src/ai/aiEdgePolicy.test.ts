import { describe, it, expect } from 'vitest'
import { getPolicyForMessage } from '../../supabase/functions/ai-command/policy'

describe('ai-command policy (edge)', () => {
  it('routes simple creation to fast tier + single turn', () => {
    const p = getPolicyForMessage('Add a blue sticky-note')
    expect(p.modelTier).toBe('fast')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
    expect(p.forcedToolName).toBe('createStickyNote')
  })

  it('routes templates to smart tier + multi turn', () => {
    const p = getPolicyForMessage('Create a SWOT analysis template with four quadrants')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBeGreaterThan(1)
    expect(p.allowGetBoardState).toBe(true)
    expect(p.returnAfterToolExecution).toBe(false)
  })
})

