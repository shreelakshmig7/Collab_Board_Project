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

  // ── Generic complex path ─────────────────────────────────────────────────
  it('treats multi-step prompts as complex', () => {
    const p = getAiCommandPolicy('Add a sticky note and connect it to the frame')
    expect(p.mode).toBe('complex')
    expect(p.maxTurns).toBeGreaterThan(1)
  })

  it('treats arrange as complex multi-turn', () => {
    const p = getAiCommandPolicy('Arrange these sticky notes in a grid')
    expect(p.mode).toBe('complex')
    expect(p.allowGetBoardState).toBe(true)
  })
})
