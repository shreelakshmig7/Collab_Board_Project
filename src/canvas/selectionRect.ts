/**
 * Pure logic for marquee selection: which object IDs intersect the selection rect.
 * Used by Canvas; tested without Konva.
 */

export type BoundedObject = { id: string; x: number; y: number; width: number; height: number }

export type SelectionRect = { x: number; y: number; width: number; height: number }

/**
 * Returns IDs of objects whose bounding box intersects the selection rect.
 * Selection rect width/height may be negative (drag left or up).
 * Objects with width or height 0 are excluded (e.g. connectors).
 */
export function getObjectIdsInSelectionRect(
  objects: BoundedObject[],
  rect: SelectionRect
): string[] {
  const left = Math.min(rect.x, rect.x + rect.width)
  const right = Math.max(rect.x, rect.x + rect.width)
  const top = Math.min(rect.y, rect.y + rect.height)
  const bottom = Math.max(rect.y, rect.y + rect.height)

  const ids: string[] = []
  for (const o of objects) {
    if (o.width <= 0 || o.height <= 0) continue
    const oRight = o.x + o.width
    const oBottom = o.y + o.height
    const intersects =
      o.x < right && oRight > left && o.y < bottom && oBottom > top
    if (intersects) ids.push(o.id)
  }
  return ids
}

/**
 * Given marquee result and current selection, returns the new selection.
 * If shiftKey, adds marquee ids to current selection; otherwise replaces.
 */
export function applyMarqueeToSelection(
  marqueeIds: string[],
  currentSelectedIds: string[],
  shiftKey: boolean
): string[] {
  if (shiftKey) {
    const set = new Set(currentSelectedIds)
    marqueeIds.forEach((id) => set.add(id))
    return Array.from(set)
  }
  return marqueeIds
}
