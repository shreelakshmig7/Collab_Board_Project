/**
 * Board API for AI agent: tools that modify board state via Supabase.
 * All mutations are synced in real time to all users.
 */
import {
  getObjects,
  addObject,
  updateObject,
  deleteObject as deleteObjectFromDB,
} from '../supabase/objects'
import type { BoardObject } from '../types/board'
import {
  STICKY_WIDTH,
  STICKY_HEIGHT,
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_CONNECTOR_COLOR,
  CIRCLE_DIAMETER,
  LINE_DEFAULT_WIDTH,
  LINE_DEFAULT_HEIGHT,
  FRAME_DEFAULT_WIDTH,
  FRAME_DEFAULT_HEIGHT,
  TEXT_DEFAULT_FONT_SIZE,
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
  await addObject(boardId, {
    id, type: 'sticky',
    x, y,
    width: STICKY_WIDTH, height: STICKY_HEIGHT,
    text, color,
  })
  return id
}

/** Creates a shape (rect, circle, or line/arrow). */
export async function createShape(
  boardId: string,
  type: ShapeType,
  x: number,
  y: number,
  width?: number,
  height?: number,
  color: string = DEFAULT_SHAPE_COLOR
): Promise<string> {
  const id = crypto.randomUUID()
  const w = type === 'circle' ? (width ?? CIRCLE_DIAMETER) : type === 'line' ? (width ?? LINE_DEFAULT_WIDTH) : (width ?? STICKY_WIDTH)
  const h = type === 'circle' ? w : type === 'line' ? (height ?? LINE_DEFAULT_HEIGHT) : (height ?? STICKY_HEIGHT)
  await addObject(boardId, { id, type, x, y, width: w, height: h, color })
  return id
}

/** Creates a frame (hierarchical container with a title). */
export async function createFrame(
  boardId: string,
  title: string,
  x: number,
  y: number,
  width: number = FRAME_DEFAULT_WIDTH,
  height: number = FRAME_DEFAULT_HEIGHT,
  color: string = DEFAULT_FRAME_COLOR
): Promise<string> {
  const id = crypto.randomUUID()
  await addObject(boardId, { id, type: 'frame', x, y, width, height, text: title, color })
  return id
}

/** Creates a connector (arrow/line) between two objects. */
export async function createConnector(
  boardId: string,
  fromId: string,
  toId: string,
  style: 'arrow' | 'line' = 'arrow',
  color: string = DEFAULT_CONNECTOR_COLOR
): Promise<string> {
  const id = crypto.randomUUID()
  await addObject(boardId, {
    id, type: 'connector',
    from_id: fromId, to_id: toId, style, color,
    x: 0, y: 0, width: 0, height: 0,
  })
  return id
}

/** Creates a standalone text element (no background box). */
export async function createText(
  boardId: string,
  text: string,
  x: number,
  y: number,
  fontSize: number = TEXT_DEFAULT_FONT_SIZE,
  fontColor: string = DEFAULT_TEXT_COLOR
): Promise<string> {
  const id = crypto.randomUUID()
  await addObject(boardId, {
    id, type: 'text',
    x, y, width: 200, height: 80,
    text, font_size: fontSize, font_color: fontColor,
  })
  return id
}

/** Moves an object by id. */
export async function moveObject(boardId: string, objectId: string, x: number, y: number): Promise<void> {
  await updateObject(boardId, objectId, { x, y })
}

/** Resizes an object. */
export async function resizeObject(boardId: string, objectId: string, width: number, height: number): Promise<void> {
  await updateObject(boardId, objectId, { width, height })
}

/** Rotates an object to the specified angle in degrees. */
export async function rotateObject(boardId: string, objectId: string, rotation: number): Promise<void> {
  await updateObject(boardId, objectId, { rotation })
}

/** Updates text of any text-capable object. */
export async function updateText(boardId: string, objectId: string, newText: string): Promise<void> {
  await updateObject(boardId, objectId, { text: newText })
}

/** Changes color of an object. */
export async function changeColor(boardId: string, objectId: string, color: string): Promise<void> {
  await updateObject(boardId, objectId, { color })
}

/** Deletes an object by id. */
export async function deleteObject(boardId: string, objectId: string): Promise<void> {
  await deleteObjectFromDB(boardId, objectId)
}

/**
 * Arranges a set of objects in a grid layout.
 * @param objectIds - ids of objects to arrange (in order)
 * @param columns   - number of columns
 * @param startX    - top-left x of the grid
 * @param startY    - top-left y of the grid
 * @param spacing   - gap between objects in pixels
 */
export async function arrangeInGrid(
  boardId: string,
  objectIds: string[],
  columns: number,
  startX: number = 100,
  startY: number = 100,
  spacing: number = 20
): Promise<void> {
  const objects = await getObjects(boardId)
  const targets = objectIds
    .map((id) => objects.find((o) => o.id === id))
    .filter((o): o is BoardObject => o != null)

  if (targets.length === 0) return

  const cellW = Math.max(...targets.map((o) => o.width))
  const cellH = Math.max(...targets.map((o) => o.height))

  const updates = targets.map((obj, i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = startX + col * (cellW + spacing)
    const y = startY + row * (cellH + spacing)
    return updateObject(boardId, obj.id, { x, y })
  })

  await Promise.all(updates)
}
