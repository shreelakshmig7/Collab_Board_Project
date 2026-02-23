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

  it('routes flowchart to compound: smart, 1 turn, createFlowchart forced, no getBoardState', () => {
    const p = getPolicyForMessage('Create a flowchart for user onboarding')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBe(1)
    expect(p.forcedToolName).toBe('createFlowchart')
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
  })

  it('routes flow chart (two words) to createFlowchart', () => {
    const p = getPolicyForMessage('Make a flow chart for the checkout process')
    expect(p.forcedToolName).toBe('createFlowchart')
  })

  it('routes flow diagram to createFlowchart', () => {
    const p = getPolicyForMessage('Draw a flow diagram for incident response')
    expect(p.forcedToolName).toBe('createFlowchart')
  })

  it('routes process flow to createFlowchart', () => {
    const p = getPolicyForMessage('Create a process flow for customer support')
    expect(p.forcedToolName).toBe('createFlowchart')
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
  it('routes move to smart tier with getBoardState, returnAfterToolExecution: true', () => {
    const p = getPolicyForMessage('Move the sticky note to the right')
    expect(p.modelTier).toBe('smart')
    expect(p.allowGetBoardState).toBe(true)
    expect(p.maxTurns).toBe(3)
    expect(p.returnAfterToolExecution).toBe(true)
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

  // ── Creation grid path ───────────────────────────────────────────────────
  it('routes "create a 2x3 grid of sticky notes" to smart, 2 turns, returnAfterToolExecution', () => {
    const p = getPolicyForMessage('Create a 2x3 grid of sticky notes for pros and cons')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBe(2)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
    expect(p.forcedToolName).toBeUndefined()
  })

  it('routes "make a grid of rectangles" to creation grid path', () => {
    const p = getPolicyForMessage('Make a grid of rectangles for the team')
    expect(p.modelTier).toBe('smart')
    expect(p.maxTurns).toBe(2)
    expect(p.returnAfterToolExecution).toBe(true)
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

  // ── Bulk creation path ────────────────────────────────────────────────────
  it('routes "create 50 sticky notes" to bulk: fast, 1 turn, createBulkObjects, no board state', () => {
    const p = getPolicyForMessage('Create 50 sticky notes')
    expect(p.forcedToolName).toBe('createBulkObjects')
    expect(p.modelTier).toBe('fast')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.returnAfterToolExecution).toBe(true)
  })

  it('routes "add 20 rectangles" to bulk', () => {
    const p = getPolicyForMessage('Add 20 rectangles')
    expect(p.forcedToolName).toBe('createBulkObjects')
    expect(p.allowGetBoardState).toBe(false)
  })

  it('routes "create a dozen frames" to bulk', () => {
    const p = getPolicyForMessage('Create a dozen frames')
    expect(p.forcedToolName).toBe('createBulkObjects')
  })

  it('routes "make several circles" to bulk', () => {
    const p = getPolicyForMessage('Make several circles')
    expect(p.forcedToolName).toBe('createBulkObjects')
  })

  it('routes "add 100 text labels" to bulk', () => {
    const p = getPolicyForMessage('Add 100 text labels')
    expect(p.forcedToolName).toBe('createBulkObjects')
  })

  it('does NOT route single-object creation to bulk', () => {
    const p = getPolicyForMessage('Create a sticky note')
    expect(p.forcedToolName).toBe('createStickyNote')
    expect(p.forcedToolName).not.toBe('createBulkObjects')
  })

  it('does NOT route "create 2 stickies" to bulk (below threshold)', () => {
    const p = getPolicyForMessage('Create 2 stickies')
    expect(p.forcedToolName).not.toBe('createBulkObjects')
  })

  it('does NOT route contextual creation to bulk — "create a sticky next to the blue frame"', () => {
    const p = getPolicyForMessage('Create a sticky note next to the blue frame')
    expect(p.forcedToolName).not.toBe('createBulkObjects')
  })
})
