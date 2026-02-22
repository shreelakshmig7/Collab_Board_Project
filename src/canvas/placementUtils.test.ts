import { describe, it, expect } from 'vitest'
import {
  doesRectOverlapAny,
  isCenterInsideAny,
  findEmptyPositionInViewport,
  findEmptyPositionOutsideCluster,
} from './placementUtils'

const bounded = (o: { id: string; x: number; y: number; width: number; height: number }) => o

describe('placementUtils', () => {
  describe('doesRectOverlapAny', () => {
    it('returns false when no objects', () => {
      expect(
        doesRectOverlapAny({ x: 0, y: 0, width: 100, height: 80 }, [])
      ).toBe(false)
    })

    it('returns true when candidate overlaps one object', () => {
      const objects = [bounded({ id: 'a', x: 50, y: 50, width: 100, height: 80 })]
      expect(
        doesRectOverlapAny({ x: 0, y: 0, width: 100, height: 80 }, objects)
      ).toBe(true)
    })

    it('returns false when candidate does not overlap', () => {
      const objects = [bounded({ id: 'a', x: 200, y: 200, width: 100, height: 80 })]
      expect(
        doesRectOverlapAny({ x: 0, y: 0, width: 100, height: 80 }, objects)
      ).toBe(false)
    })

    it('ignores objects with zero width or height', () => {
      const objects = [
        bounded({ id: 'a', x: 0, y: 0, width: 0, height: 80 }),
        bounded({ id: 'b', x: 0, y: 0, width: 100, height: 0 }),
      ]
      expect(
        doesRectOverlapAny({ x: 0, y: 0, width: 100, height: 80 }, objects)
      ).toBe(false)
    })
  })

  describe('isCenterInsideAny', () => {
    it('returns false when no objects', () => {
      expect(isCenterInsideAny(100, 100, [])).toBe(false)
    })

    it('returns true when center is inside an object', () => {
      const objects = [bounded({ id: 'a', x: 0, y: 0, width: 200, height: 200 })]
      expect(isCenterInsideAny(100, 100, objects)).toBe(true)
    })

    it('returns false when center is outside', () => {
      const objects = [bounded({ id: 'a', x: 0, y: 0, width: 50, height: 50 })]
      expect(isCenterInsideAny(100, 100, objects)).toBe(false)
    })

    it('ignores zero-area objects', () => {
      const objects = [bounded({ id: 'a', x: 0, y: 0, width: 1000, height: 0 })]
      expect(isCenterInsideAny(100, 100, objects)).toBe(false)
    })
  })

  describe('findEmptyPositionInViewport', () => {
    const viewport = { x: 0, y: 0, width: 1000, height: 800 }

    it('returns position when viewport is empty (viewport center first)', () => {
      const result = findEmptyPositionInViewport(
        { width: 100, height: 80 },
        [],
        viewport
      )
      expect(result).toEqual({ x: 450, y: 360 })
    })

    it('returns first empty cell when one object exists', () => {
      const objects = [bounded({ id: 'a', x: 0, y: 0, width: 120, height: 100 })]
      const result = findEmptyPositionInViewport(
        { width: 100, height: 80 },
        objects,
        viewport
      )
      expect(result).not.toBeNull()
      expect(result!.x).toBeGreaterThanOrEqual(viewport.x)
      expect(result!.y).toBeGreaterThanOrEqual(viewport.y)
      expect(result!.x + 100).toBeLessThanOrEqual(viewport.x + viewport.width)
      expect(result!.y + 80).toBeLessThanOrEqual(viewport.y + viewport.height)
    })

    it('returns null when viewport is full', () => {
      const objects = [
        bounded({ id: 'a', x: 0, y: 0, width: 1000, height: 800 }),
      ]
      const result = findEmptyPositionInViewport(
        { width: 100, height: 80 },
        objects,
        viewport
      )
      expect(result).toBeNull()
    })
  })

  describe('findEmptyPositionOutsideCluster', () => {
    it('returns position to the right of cluster', () => {
      const objects = [
        bounded({ id: 'a', x: 100, y: 100, width: 80, height: 60 }),
        bounded({ id: 'b', x: 200, y: 150, width: 80, height: 60 }),
      ]
      const result = findEmptyPositionOutsideCluster(
        { width: 100, height: 80 },
        objects
      )
      expect(result.x).toBeGreaterThanOrEqual(280)
      expect(result.y).toBeGreaterThanOrEqual(100)
    })

    it('returns position when no objects', () => {
      const result = findEmptyPositionOutsideCluster(
        { width: 100, height: 80 },
        []
      )
      expect(result).toEqual({ x: 0, y: 0 })
    })
  })
})
