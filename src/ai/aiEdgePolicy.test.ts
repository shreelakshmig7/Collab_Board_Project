import { describe, it, expect } from 'vitest'
import { getPolicyForMessage } from '../../supabase/functions/ai-command/policy'

describe('ai-command edge policy', () => {
  // ── Simple path ───────────────────────────────────────────────────────────
  it('routes sticky creation to fast tier, 1 turn, forced tool', () => {
    const p = getPolicyForMessage('Add a blue sticky-note')
    expect(p.modelTier).toBe('fast')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
    expect(p.forcedToolName).toBe('createStickyNote')
  })

  it('routes shape creation to fast tier with forced tool', () => {
    const p = getPolicyForMessage('Create a blue rectangle')
    expect(p.modelTier).toBe('fast')
    expect(p.forcedToolName).toBe('createShape')
    expect(p.allowGetBoardState).toBe(false)
  })

  it('routes frame creation to fast tier with forced tool', () => {
    const p = getPolicyForMessage('Add a frame called Sprint Planning')
    expect(p.modelTier).toBe('fast')
    expect(p.forcedToolName).toBe('createFrame')
  })

  // ── Compound path ─────────────────────────────────────────────────────────
  it('routes SWOT to compound: smart, 1 turn, createQuadrant forced, no getBoardState', () => {
    const p = getPolicyForMessage('Create a SWOT analysis with four quadrants')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBe(1)
    expect(p.forcedToolName).toBe('createQuadrant')
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
  })

  it('routes quadrant diagram to createQuadrant', () => {
    const p = getPolicyForMessage('Make a 2x2 quadrant diagram')
    expect(p.forcedToolName).toBe('createQuadrant')
  })

  it('routes retrospective to compound: createColumnLayout', () => {
    const p = getPolicyForMessage('Set up a retrospective board')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBe(1)
    expect(p.forcedToolName).toBe('createColumnLayout')
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
  })

  it('routes kanban to createColumnLayout', () => {
    const p = getPolicyForMessage('Create a kanban board')
    expect(p.forcedToolName).toBe('createColumnLayout')
  })

  it('routes journey map to createColumnLayout', () => {
    const p = getPolicyForMessage('Build a user journey map with 5 stages')
    expect(p.forcedToolName).toBe('createColumnLayout')
  })

  it('routes clear board to compound: clearBoard forced, 1 turn', () => {
    const p = getPolicyForMessage('Clear the board')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBe(1)
    expect(p.forcedToolName).toBe('clearBoard')
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
  })

  it('routes wipe to clearBoard', () => {
    const p = getPolicyForMessage('Wipe everything')
    expect(p.forcedToolName).toBe('clearBoard')
  })

  it('routes delete all to clearBoard', () => {
    const p = getPolicyForMessage('Delete all objects')
    expect(p.forcedToolName).toBe('clearBoard')
  })

  // ── Ops path (now complex, not simple) ───────────────────────────────────
  it('routes move to smart tier with getBoardState (not simple)', () => {
    const p = getPolicyForMessage('Move the sticky note to the right')
    expect(p.modelTier).toBe('smart')
    expect(p.allowGetBoardState).toBe(true)
    expect(p.maxTurns).toBe(3)
    expect(p.returnAfterToolExecution).toBe(false)
    expect(p.forcedToolName).toBeUndefined()
  })

  it('routes change color to smart tier with getBoardState', () => {
    const p = getPolicyForMessage('Change the frame color to red')
    expect(p.modelTier).toBe('smart')
    expect(p.allowGetBoardState).toBe(true)
  })

  it('routes delete specific to smart tier with getBoardState', () => {
    const p = getPolicyForMessage('Delete the red sticky note')
    expect(p.modelTier).toBe('smart')
    expect(p.allowGetBoardState).toBe(true)
    expect(p.maxTurns).toBe(3)
  })

  it('routes resize to smart tier with getBoardState', () => {
    const p = getPolicyForMessage('Resize the rectangle')
    expect(p.modelTier).toBe('smart')
    expect(p.allowGetBoardState).toBe(true)
  })

  // ── Generic complex path ─────────────────────────────────────────────────
  it('routes arrange to smart multi-turn with getBoardState', () => {
    const p = getPolicyForMessage('Arrange the sticky notes in a grid')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBeGreaterThan(1)
    expect(p.allowGetBoardState).toBe(true)
    expect(p.returnAfterToolExecution).toBe(false)
  })

  it('routes connector commands to smart multi-turn', () => {
    const p = getPolicyForMessage('Connect the two rectangles with an arrow')
    expect(p.modelTier).toBe('smart')
    expect(p.allowGetBoardState).toBe(true)
  })

  it('routes multi-step prompts to smart multi-turn', () => {
    const p = getPolicyForMessage('Add a sticky note and move it to the corner')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBeGreaterThan(1)
  })
})
