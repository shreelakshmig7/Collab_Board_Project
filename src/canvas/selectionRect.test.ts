import { describe, it, expect } from 'vitest'
import { getObjectIdsInSelectionRect, applyMarqueeToSelection } from './selectionRect'

type MinObject = { id: string; x: number; y: number; width: number; height: number }

describe('getObjectIdsInSelectionRect', () => {
  const obj = (id: string, x: number, y: number, w: number, h: number): MinObject => ({
    id,
    x,
    y,
    width: w,
    height: h,
  })

  it('returns ids of objects whose bounds intersect the selection rect', () => {
    const objects: MinObject[] = [
      obj('a', 100, 100, 50, 50),
      obj('b', 200, 200, 50, 50),
      obj('c', 300, 300, 50, 50),
    ]
    // Selection from (0,0) to (250,250) — should include a and b, not c
    const ids = getObjectIdsInSelectionRect(objects, { x: 0, y: 0, width: 250, height: 250 })
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
    expect(ids).toHaveLength(2)
  })

  it('handles selection rect with negative width/height (drag left or up)', () => {
    const objects: MinObject[] = [obj('a', 100, 100, 50, 50)]
    const ids = getObjectIdsInSelectionRect(objects, { x: 150, y: 150, width: -100, height: -100 })
    expect(ids).toContain('a')
    expect(ids).toHaveLength(1)
  })

  it('excludes objects with zero width or height (e.g. connectors)', () => {
    const objects: MinObject[] = [
      obj('a', 100, 100, 50, 50),
      obj('conn', 200, 200, 0, 0),
    ]
    const ids = getObjectIdsInSelectionRect(objects, { x: 0, y: 0, width: 300, height: 300 })
    expect(ids).toContain('a')
    expect(ids).not.toContain('conn')
    expect(ids).toHaveLength(1)
  })

  it('returns empty array when no objects intersect', () => {
    const objects: MinObject[] = [obj('a', 500, 500, 50, 50)]
    const ids = getObjectIdsInSelectionRect(objects, { x: 0, y: 0, width: 100, height: 100 })
    expect(ids).toHaveLength(0)
  })

  it('returns empty array for empty objects', () => {
    const ids = getObjectIdsInSelectionRect([], { x: 0, y: 0, width: 100, height: 100 })
    expect(ids).toHaveLength(0)
  })
})

describe('applyMarqueeToSelection', () => {
  it('replaces selection when not shiftKey', () => {
    const result = applyMarqueeToSelection(['a', 'b'], ['x', 'y'], false)
    expect(result).toEqual(['a', 'b'])
  })

  it('adds marquee ids to current selection when shiftKey', () => {
    const result = applyMarqueeToSelection(['b', 'c'], ['a'], true)
    expect(result).toContain('a')
    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result).toHaveLength(3)
  })

  it('deduplicates when shiftKey and marquee overlaps current', () => {
    const result = applyMarqueeToSelection(['a', 'b'], ['a', 'c'], true)
    expect(result).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    expect(result).toHaveLength(3)
  })
})
