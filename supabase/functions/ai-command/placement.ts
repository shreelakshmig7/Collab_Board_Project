/**
 * Placement helpers for AI create tools. Synced from packages/placement-utils — keep in sync.
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
    if (oLeft < right && oRight > left && oTop < bottom && oBottom > top) return true
  }
  return false
}

const GRID_STEP = 12

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
  const rightThirdCandidate = { x: rightThirdX, y: rightThirdY, width: objectSize.width, height: objectSize.height }
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
  const bottomThirdCandidate = { x: bottomThirdX, y: bottomThirdY, width: objectSize.width, height: objectSize.height }
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
      const candidate = { x, y, width: objectSize.width, height: objectSize.height }
      if (!doesRectOverlapAny(candidate, objects)) return { x, y }
    }
  }
  return null
}

/** Find (startX, startY) so the whole layout box fits in viewport without overlapping. One shot: center first, then grid. */
export function findEmptyBulkPositionInViewport(
  layoutWidth: number,
  layoutHeight: number,
  objects: BoundedObject[],
  viewport: { x: number; y: number; width: number; height: number }
): { x: number; y: number } | null {
  const centerX = viewport.x + viewport.width / 2 - layoutWidth / 2
  const centerY = viewport.y + viewport.height / 2 - layoutHeight / 2
  const centerBox = { x: centerX, y: centerY, width: layoutWidth, height: layoutHeight }
  const fitsInViewport =
    centerBox.x >= viewport.x &&
    centerBox.y >= viewport.y &&
    centerBox.x + centerBox.width <= viewport.x + viewport.width &&
    centerBox.y + centerBox.height <= viewport.y + viewport.height
  if (fitsInViewport && !doesRectOverlapAny(centerBox, objects)) {
    return { x: centerX, y: centerY }
  }
  const step = Math.max(GRID_STEP, Math.min(layoutWidth, layoutHeight) / 4)
  for (let y = viewport.y; y + layoutHeight <= viewport.y + viewport.height; y += step) {
    for (let x = viewport.x; x + layoutWidth <= viewport.x + viewport.width; x += step) {
      const box = { x, y, width: layoutWidth, height: layoutHeight }
      if (!doesRectOverlapAny(box, objects)) return { x, y }
    }
  }
  return null
}

const CLUSTER_PADDING = 24

export function findEmptyPositionOutsideCluster(
  objectSize: { width: number; height: number },
  objects: BoundedObject[]
): { x: number; y: number } {
  const withArea = objects.filter(hasArea)
  if (withArea.length === 0) return { x: 0, y: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const o of withArea) {
    minX = Math.min(minX, o.x)
    minY = Math.min(minY, o.y)
    maxX = Math.max(maxX, o.x + o.width)
    maxY = Math.max(maxY, o.y + o.height)
  }
  return { x: maxX + CLUSTER_PADDING, y: minY }
}

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

/** Resolve (startX, startY) for a bulk layout so the whole box doesn't overlap. Tries viewport first when provided, then outside cluster. One check per bulk op. */
export function resolveBulkPlacement(
  startX: number,
  startY: number,
  layoutWidth: number,
  layoutHeight: number,
  objects: BoundedObject[],
  overlapPadding = 2,
  viewport: { x: number; y: number; width: number; height: number } | null = null
): { x: number; y: number } {
  const capped = objects.slice(0, PLACEMENT_OBJECT_CAP)
  const bounded = capped
    .filter((o) => o.width > 0 && o.height > 0)
    .map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height }))
  const box = { x: startX, y: startY, width: layoutWidth, height: layoutHeight }
  if (!doesRectOverlapAny(box, bounded, overlapPadding)) {
    return { x: startX, y: startY }
  }
  if (viewport && viewport.width > 0 && viewport.height > 0) {
    const inView = findEmptyBulkPositionInViewport(layoutWidth, layoutHeight, bounded, viewport)
    if (inView) return inView
  }
  return findEmptyPositionOutsideCluster({ width: layoutWidth, height: layoutHeight }, bounded)
}
