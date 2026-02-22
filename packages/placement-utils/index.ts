/**
 * Pure placement helpers: overlap detection and finding empty positions.
 * Shared by client (canvas/toolbar) and edge function (AI create tools).
 */

export type BoundedObject = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

function hasArea(o: BoundedObject): boolean {
  return o.width > 0 && o.height > 0
}

/**
 * Returns true if the candidate rect overlaps any object with positive area.
 * @param padding - Optional margin: existing rects are inflated by this much so "touching" counts as overlap.
 */
export function doesRectOverlapAny(
  candidate: { x: number; y: number; width: number; height: number },
  objects: BoundedObject[],
  padding = 0
): boolean {
  const left = candidate.x
  const right = candidate.x + candidate.width
  const top = candidate.y
  const bottom = candidate.y + candidate.height
  for (const o of objects) {
    if (!hasArea(o)) continue
    const oLeft = o.x - padding
    const oRight = o.x + o.width + padding
    const oTop = o.y - padding
    const oBottom = o.y + o.height + padding
    const intersects =
      oLeft < right && oRight > left && oTop < bottom && oBottom > top
    if (intersects) return true
  }
  return false
}

/**
 * Returns true if the point (cx, cy) is inside any object with positive area.
 */
export function isCenterInsideAny(
  cx: number,
  cy: number,
  objects: BoundedObject[]
): boolean {
  for (const o of objects) {
    if (!hasArea(o)) continue
    if (
      cx >= o.x &&
      cx <= o.x + o.width &&
      cy >= o.y &&
      cy <= o.y + o.height
    ) {
      return true
    }
  }
  return false
}

const GRID_STEP = 12

/**
 * Finds the first position in the viewport (world coords) where a rect of the given size
 * does not overlap any object. Tries viewport center, then right-third, then bottom-third,
 * then left-to-right top-to-bottom grid. Returns null if no empty spot in the viewport.
 */
export function findEmptyPositionInViewport(
  objectSize: { width: number; height: number },
  objects: BoundedObject[],
  viewport: { x: number; y: number; width: number; height: number }
): { x: number; y: number } | null {
  const centerX = viewport.x + viewport.width / 2
  const centerY = viewport.y + viewport.height / 2
  const centerCandidate = {
    x: centerX - objectSize.width / 2,
    y: centerY - objectSize.height / 2,
    width: objectSize.width,
    height: objectSize.height,
  }
  const fitsInViewport =
    centerCandidate.x >= viewport.x &&
    centerCandidate.y >= viewport.y &&
    centerCandidate.x + centerCandidate.width <= viewport.x + viewport.width &&
    centerCandidate.y + centerCandidate.height <= viewport.y + viewport.height
  if (fitsInViewport && !doesRectOverlapAny(centerCandidate, objects)) {
    return { x: centerCandidate.x, y: centerCandidate.y }
  }

  const rightThirdX = viewport.x + (2 / 3) * viewport.width - objectSize.width / 2
  const rightThirdY = viewport.y + viewport.height / 2 - objectSize.height / 2
  const rightThirdCandidate = {
    x: rightThirdX,
    y: rightThirdY,
    width: objectSize.width,
    height: objectSize.height,
  }
  const rightThirdFits =
    rightThirdCandidate.x >= viewport.x &&
    rightThirdCandidate.y >= viewport.y &&
    rightThirdCandidate.x + rightThirdCandidate.width <= viewport.x + viewport.width &&
    rightThirdCandidate.y + rightThirdCandidate.height <= viewport.y + viewport.height
  if (rightThirdFits && !doesRectOverlapAny(rightThirdCandidate, objects)) {
    return { x: rightThirdCandidate.x, y: rightThirdCandidate.y }
  }

  const bottomThirdX = viewport.x + viewport.width / 2 - objectSize.width / 2
  const bottomThirdY = viewport.y + (2 / 3) * viewport.height - objectSize.height / 2
  const bottomThirdCandidate = {
    x: bottomThirdX,
    y: bottomThirdY,
    width: objectSize.width,
    height: objectSize.height,
  }
  const bottomThirdFits =
    bottomThirdCandidate.x >= viewport.x &&
    bottomThirdCandidate.y >= viewport.y &&
    bottomThirdCandidate.x + bottomThirdCandidate.width <= viewport.x + viewport.width &&
    bottomThirdCandidate.y + bottomThirdCandidate.height <= viewport.y + viewport.height
  if (bottomThirdFits && !doesRectOverlapAny(bottomThirdCandidate, objects)) {
    return { x: bottomThirdCandidate.x, y: bottomThirdCandidate.y }
  }

  const step = GRID_STEP
  for (let y = viewport.y; y + objectSize.height <= viewport.y + viewport.height; y += step) {
    for (let x = viewport.x; x + objectSize.width <= viewport.x + viewport.width; x += step) {
      const candidate = {
        x,
        y,
        width: objectSize.width,
        height: objectSize.height,
      }
      if (!doesRectOverlapAny(candidate, objects)) return { x, y }
    }
  }
  return null
}

const CLUSTER_PADDING = 24

/**
 * Returns a position to the right of the bounding box of all objects (with padding),
 * so the new object does not overlap the cluster.
 */
export function findEmptyPositionOutsideCluster(
  _objectSize: { width: number; height: number },
  objects: BoundedObject[]
): { x: number; y: number } {
  const withArea = objects.filter(hasArea)
  if (withArea.length === 0) return { x: 0, y: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const o of withArea) {
    minX = Math.min(minX, o.x)
    minY = Math.min(minY, o.y)
    maxX = Math.max(maxX, o.x + o.width)
    maxY = Math.max(maxY, o.y + o.height)
  }
  return {
    x: maxX + CLUSTER_PADDING,
    y: minY,
  }
}

/**
 * Resolves (x, y) for a new object: if candidate overlaps, returns an empty position
 * (viewport first if bounds provided, else outside cluster). Caps objects array for safety.
 */
export const PLACEMENT_OBJECT_CAP = 200

export function resolvePlacement(
  candidate: { x: number; y: number; width: number; height: number },
  objects: BoundedObject[],
  viewport: { x: number; y: number; width: number; height: number } | null,
  overlapPadding = 2
): { x: number; y: number } {
  const capped = objects.slice(0, PLACEMENT_OBJECT_CAP)
  const bounded = capped
    .filter((o) => o.width > 0 && o.height > 0)
    .map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height }))
  if (!doesRectOverlapAny(candidate, bounded, overlapPadding)) {
    return { x: candidate.x, y: candidate.y }
  }
  const objectSize = { width: candidate.width, height: candidate.height }
  if (viewport && viewport.width > 0 && viewport.height > 0) {
    const empty = findEmptyPositionInViewport(objectSize, bounded, viewport)
    if (empty) return empty
  }
  return findEmptyPositionOutsideCluster(objectSize, bounded)
}
