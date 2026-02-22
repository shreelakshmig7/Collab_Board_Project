/**
 * Re-export placement helpers from shared package.
 * @see packages/placement-utils
 */
export {
  doesRectOverlapAny,
  findEmptyPositionInViewport,
  findEmptyPositionOutsideCluster,
  isCenterInsideAny,
  resolvePlacement,
  PLACEMENT_OBJECT_CAP,
  type BoundedObject,
} from '@collab-board/placement-utils'
