import { describe, it, expect } from 'vitest'
import { getAiCommandPolicy } from './aiCommandPolicy'

describe('getAiCommandPolicy (client)', () => {
  // ── Simple path ───────────────────────────────────────────────────────────
  it('treats sticky creation as simple with forced tool', () => {
    const p = getAiCommandPolicy('Add a blue sticky-note')
    expect(p.mode).toBe('simple')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.forcedToolName).toBe('createStickyNote')
  })

  it('treats circle creation as simple with createShape forced', () => {
    const p = getAiCommandPolicy('Create a green circle')
    expect(p.mode).toBe('simple')
    expect(p.forcedToolName).toBe('createShape')
  })

  it('treats frame creation as simple with createFrame forced', () => {
    const p = getAiCommandPolicy('Add a frame called Design')
    expect(p.mode).toBe('simple')
    expect(p.forcedToolName).toBe('createFrame')
  })

  it('treats text creation as simple with createText forced', () => {
    const p = getAiCommandPolicy('Create a text label')
    expect(p.mode).toBe('simple')
    expect(p.forcedToolName).toBe('createText')
  })

  // ── Compound path ─────────────────────────────────────────────────────────
  it('treats SWOT as compound with createQuadrant', () => {
    const p = getAiCommandPolicy('Create a SWOT analysis template with four quadrants')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createQuadrant')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
  })

  it('treats quadrant as compound', () => {
    const p = getAiCommandPolicy('Make a 2x2 quadrant')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createQuadrant')
  })

  it('treats retro board as compound with createColumnLayout', () => {
    const p = getAiCommandPolicy('Set up a retrospective board with columns')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createColumnLayout')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
  })

  it('treats kanban as compound with createColumnLayout', () => {
    const p = getAiCommandPolicy('Create a kanban board')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createColumnLayout')
  })

  it('treats journey map as compound with createColumnLayout', () => {
    const p = getAiCommandPolicy('Build a user journey map with 5 stages')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createColumnLayout')
  })

  it('treats flowchart as compound with createFlowchart', () => {
    const p = getAiCommandPolicy('Create a flowchart for user onboarding')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createFlowchart')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
  })

  it('treats flow chart (two words) as compound with createFlowchart', () => {
    const p = getAiCommandPolicy('Make a flow chart for the checkout process')
    expect(p.forcedToolName).toBe('createFlowchart')
  })

  it('treats process flow as compound with createFlowchart', () => {
    const p = getAiCommandPolicy('Create a process flow for customer support')
    expect(p.forcedToolName).toBe('createFlowchart')
  })

  it('treats clear board as compound with clearBoard', () => {
    const p = getAiCommandPolicy('Clear the board')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('clearBoard')
    expect(p.allowGetBoardState).toBe(false)
  })

  it('treats wipe everything as compound clearBoard', () => {
    const p = getAiCommandPolicy('Wipe everything')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('clearBoard')
  })

  // ── Ops now route to complex (not simple) ─────────────────────────────────
  it('treats move as complex with getBoardState (no longer simple)', () => {
    const p = getAiCommandPolicy('Move the sticky note to the right')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
    expect(p.maxTurns).toBe(3)
  })

  it('treats change color as complex', () => {
    const p = getAiCommandPolicy('Change the frame color to red')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
  })

  it('treats delete specific as complex', () => {
    const p = getAiCommandPolicy('Delete the red sticky note')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
  })

  it('treats resize as complex', () => {
    const p = getAiCommandPolicy('Resize the rectangle to be larger')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
  })

  // ── Creation grid path ───────────────────────────────────────────────────
  it('treats "create a 2x3 grid of sticky notes" as compound creation grid', () => {
    const p = getAiCommandPolicy('Create a 2x3 grid of sticky notes for pros and cons')
    expect(p.mode).toBe('compound')
    expect(p.maxTurns).toBe(2)
    expect(p.allowGetBoardState).toBe(false)
    expect(p.forcedToolName).toBeUndefined()
  })

  it('treats "make a grid of rectangles" as creation grid', () => {
    const p = getAiCommandPolicy('Make a grid of rectangles for the team')
    expect(p.mode).toBe('compound')
    expect(p.maxTurns).toBe(2)
  })

  it('does NOT treat "arrange in a grid" as creation grid (no creation keyword)', () => {
    const p = getAiCommandPolicy('Arrange these sticky notes in a grid')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
  })

  // ── Generic complex path ─────────────────────────────────────────────────
  it('treats multi-step prompts as complex', () => {
    const p = getAiCommandPolicy('Add a sticky note and connect it to the frame')
    expect(p.mode).toBe('complex')
    expect(p.maxTurns).toBeGreaterThan(1)
  })

  it('treats arrange as complex multi-turn', () => {
    const p = getAiCommandPolicy('Arrange the objects evenly')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
  })

  // ── Bulk creation path ────────────────────────────────────────────────────
  it('treats "create 50 sticky notes" as compound with createBulkObjects', () => {
    const p = getAiCommandPolicy('Create 50 sticky notes')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createBulkObjects')
    expect(p.maxTurns).toBe(1)
    expect(p.allowGetBoardState).toBe(false)
  })

  it('treats "add 20 rectangles" as compound bulk', () => {
    const p = getAiCommandPolicy('Add 20 rectangles')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createBulkObjects')
    expect(p.allowGetBoardState).toBe(false)
  })

  it('treats "create a dozen frames" as compound bulk', () => {
    const p = getAiCommandPolicy('Create a dozen frames')
    expect(p.mode).toBe('compound')
    expect(p.forcedToolName).toBe('createBulkObjects')
  })

  it('treats "make several circles" as compound bulk', () => {
    const p = getAiCommandPolicy('Make several circles')
    expect(p.forcedToolName).toBe('createBulkObjects')
  })

  it('treats "add 100 text labels" as compound bulk', () => {
    const p = getAiCommandPolicy('Add 100 text labels')
    expect(p.forcedToolName).toBe('createBulkObjects')
  })

  it('does NOT treat single-object creation as bulk', () => {
    const p = getAiCommandPolicy('Create a sticky note')
    expect(p.forcedToolName).toBe('createStickyNote')
    expect(p.forcedToolName).not.toBe('createBulkObjects')
  })

  it('does NOT treat "create 2 stickies" as bulk (below threshold)', () => {
    const p = getAiCommandPolicy('Create 2 stickies')
    expect(p.forcedToolName).not.toBe('createBulkObjects')
  })

  it('does NOT treat contextual creation as bulk — "create a sticky next to the blue frame"', () => {
    const p = getAiCommandPolicy('Create a sticky note next to the blue frame')
    expect(p.forcedToolName).not.toBe('createBulkObjects')
  })
})
