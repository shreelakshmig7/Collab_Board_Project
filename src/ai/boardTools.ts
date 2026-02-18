/**
 * Board API for AI agent: tools that modify board state via Firestore.
 * All mutations are synced in real time to all users.
 */
import {
  getObjects,
  addObject,
  updateObject,
} from '../supabase/objects'
import type { BoardObject } from '../types/board'
import {
  STICKY_WIDTH,
  STICKY_HEIGHT,
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
  CIRCLE_DIAMETER,
  LINE_DEFAULT_WIDTH,
  LINE_DEFAULT_HEIGHT,
} from '../constants'

export type ShapeType = 'rect' | 'circle' | 'line'

/** Returns current board objects (for AI context). */
export async function getBoardState(boardId: string): Promise<BoardObject[]> {
  return getObjects(boardId)
}

/** Creates a sticky note. */
export async function createStickyNote(
  boardId: string,
  text: string,
  x: number,
  y: number,
  color: string = DEFAULT_STICKY_COLOR
): Promise<string> {
  const id = crypto.randomUUID()
  const obj: BoardObject = {
    id,
    type: 'sticky',
    x,
    y,
    width: STICKY_WIDTH,
    height: STICKY_HEIGHT,
    text,
    color,
  }
  await addObject(boardId, obj)
  return id
}

/** Creates a shape (rect, circle, or line). */
export async function createShape(
  boardId: string,
  type: ShapeType,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string = DEFAULT_SHAPE_COLOR
): Promise<string> {
  const id = crypto.randomUUID()
  const w =
    type === 'circle' ? (width || CIRCLE_DIAMETER) : type === 'line' ? (width || LINE_DEFAULT_WIDTH) : width || STICKY_WIDTH
  const h = type === 'circle' ? w : type === 'line' ? (height ?? LINE_DEFAULT_HEIGHT) : height || STICKY_HEIGHT
  const obj: BoardObject = {
    id,
    type,
    x,
    y,
    width: w,
    height: h,
    color,
  }
  await addObject(boardId, obj)
  return id
}

/** Moves an object by id. */
export async function moveObject(boardId: string, objectId: string, x: number, y: number): Promise<void> {
  await updateObject(boardId, objectId, { x, y })
}

/** Resizes an object. */
export async function resizeObject(
  boardId: string,
  objectId: string,
  width: number,
  height: number
): Promise<void> {
  await updateObject(boardId, objectId, { width, height })
}

/** Updates text of a sticky (or other text-capable object). */
export async function updateText(boardId: string, objectId: string, newText: string): Promise<void> {
  await updateObject(boardId, objectId, { text: newText })
}

/** Changes color of an object. */
export async function changeColor(boardId: string, objectId: string, color: string): Promise<void> {
  await updateObject(boardId, objectId, { color })
}
