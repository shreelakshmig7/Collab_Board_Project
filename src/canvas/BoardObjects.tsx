import { memo, useRef } from 'react'
import { Group, Rect, Text, Circle, Arrow, Line } from 'react-konva'
import Konva from 'konva'
import type { BoardObject } from '../types/board'
import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_FRAME_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_CONNECTOR_COLOR,
  TEXT_DEFAULT_FONT_SIZE,
} from '../constants'
import { updateObject } from '../supabase/objects'

const DRAG_UPDATE_THROTTLE_MS = 40

function textFontSize(obj: BoardObject): number {
  const base = Math.min(obj.width, obj.height) * 0.18
  return Math.max(10, Math.min(28, base))
}

type BoardObjectsProps = {
  boardId: string
  objects: BoardObject[]
  selectedIds: string[]
  onObjectClick: (id: string, shiftKey: boolean) => void
  onStartEditText?: (id: string, text: string) => void
  onObjectMoved?: (id: string, x: number, y: number) => void
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  /** Called on every throttled drag-move. Should broadcast position to peers — no DB write. */
  onBroadcastDragMove?: (id: string, x: number, y: number) => void
  /** Called during multi-drag with delta from drag start position */
  onMultiDragMove?: (movedId: string, deltaX: number, deltaY: number) => void
  /** Connector tool: id of the first object clicked, waiting for second object */
  pendingConnectorFrom?: string | null
}

function BoardObjects({
  boardId,
  objects,
  selectedIds,
  onObjectClick,
  onStartEditText,
  onObjectMoved,
  onDragStart,
  onDragEnd,
  onBroadcastDragMove,
  onMultiDragMove,
  pendingConnectorFrom,
}: BoardObjectsProps) {
  const lastDragUpdateRef = useRef<Record<string, number>>({})

  const throttleDragUpdate = (objId: string, x: number, y: number) => {
    const now = Date.now()
    if (now - (lastDragUpdateRef.current[objId] ?? 0) >= DRAG_UPDATE_THROTTLE_MS) {
      lastDragUpdateRef.current[objId] = now
      onBroadcastDragMove?.(objId, x, y)
    }
  }

  const isMultiSelect = selectedIds.length > 1

  const makeDragHandlers = (obj: BoardObject) => ({
    onDragStart: () => onDragStart?.(obj.id),
    onDragMove: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const node = e.target
      const nodeX = node.x()
      const nodeY = node.y()
      throttleDragUpdate(obj.id, nodeX, nodeY)
      if (isMultiSelect && selectedIds.includes(obj.id)) {
        const deltaX = nodeX - obj.x
        const deltaY = nodeY - obj.y
        onMultiDragMove?.(obj.id, deltaX, deltaY)
      }
    },
    onDragEnd: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const node = e.target
      const x = node.x()
      const y = node.y()
      onObjectMoved?.(obj.id, x, y)
      updateObject(boardId, obj.id, { x, y }).catch((err: unknown) =>
        console.error('Failed to update object position', err)
      )
      onDragEnd?.()
    },
  })

  // Frames render first (behind all other objects)
  const frames = objects.filter((o) => o.type === 'frame')
  const nonFrames = objects.filter((o) => o.type !== 'frame' && o.type !== 'connector')
  const connectors = objects.filter((o) => o.type === 'connector')

  return (
    <>
      {/* Frames rendered first so they appear behind other objects */}
      {frames.map((obj) => {
        const isSelected = selectedIds.includes(obj.id)
        const isPending = pendingConnectorFrom === obj.id
        const color = obj.color ?? DEFAULT_FRAME_COLOR
        const frameChildren = objects.filter((o) => o.parent_id === obj.id)

        const handleFrameDragEnd = (e: Konva.KonvaEventObject<MouseEvent>) => {
          const node = e.target
          const newX = node.x()
          const newY = node.y()
          const dx = newX - obj.x
          const dy = newY - obj.y
          onObjectMoved?.(obj.id, newX, newY)
          updateObject(boardId, obj.id, { x: newX, y: newY }).catch((err: unknown) =>
            console.error('Failed to update frame position', err)
          )
          for (const child of frameChildren) {
            const childX = child.x + dx
            const childY = child.y + dy
            onObjectMoved?.(child.id, childX, childY)
            updateObject(boardId, child.id, { x: childX, y: childY }).catch((err: unknown) =>
              console.error('Failed to update frame child position', err)
            )
          }
          onDragEnd?.()
        }

        return (
          <Group
            key={obj.id}
            id={obj.id}
            x={obj.x}
            y={obj.y}
            rotation={obj.rotation ?? 0}
            draggable
            onClick={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, e.evt.shiftKey)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, false)
            }}
            onDragStart={() => onDragStart?.(obj.id)}
            onDragMove={(e) => {
              const node = e.target
              throttleDragUpdate(obj.id, node.x(), node.y())
            }}
            onDragEnd={handleFrameDragEnd}
            onDblClick={(e) => {
              e.cancelBubble = true
              onStartEditText?.(obj.id, obj.text ?? '')
            }}
            onDblTap={(e) => {
              e.cancelBubble = true
              onStartEditText?.(obj.id, obj.text ?? '')
            }}
          >
            {/* Frame body */}
            <Rect
              width={obj.width}
              height={obj.height}
              fill="rgba(99, 102, 241, 0.05)"
              stroke={isSelected ? '#2563eb' : isPending ? '#f59e0b' : color}
              strokeWidth={isSelected ? 3 : 2}
              cornerRadius={4}
              dash={[8, 4]}
            />
            {/* Title bar */}
            <Rect
              width={obj.width}
              height={28}
              fill={color}
              opacity={0.18}
              cornerRadius={[4, 4, 0, 0]}
              listening={false}
            />
            <Text
              text={obj.text ?? 'Frame'}
              x={10}
              y={6}
              fontSize={13}
              fontStyle="bold"
              fill={color}
              listening={false}
            />
          </Group>
        )
      })}

      {/* Non-frame, non-connector objects */}
      {nonFrames.map((obj) => {
        const isSelected = selectedIds.includes(obj.id)
        const isPending = pendingConnectorFrom === obj.id
        const selectionStroke = isSelected ? '#2563eb' : isPending ? '#f59e0b' : undefined

        if (obj.type === 'sticky') {
          const color = obj.color ?? DEFAULT_STICKY_COLOR
          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              {...makeDragHandlers(obj)}
              onDblClick={(e) => {
                e.cancelBubble = true
                onStartEditText?.(obj.id, obj.text ?? '')
              }}
              onDblTap={(e) => {
                e.cancelBubble = true
                onStartEditText?.(obj.id, obj.text ?? '')
              }}
            >
              <Rect
                width={obj.width}
                height={obj.height}
                fill={color}
                cornerRadius={8}
                stroke={selectionStroke ?? 'transparent'}
                strokeWidth={selectionStroke ? 3 : 0}
              />
              <Text
                text={obj.text ?? ''}
                width={obj.width - 16}
                height={obj.height - 16}
                x={8}
                y={8}
                fontSize={textFontSize(obj)}
                listening={false}
                wrap="word"
                align="center"
                verticalAlign="middle"
              />
            </Group>
          )
        }

        if (obj.type === 'circle') {
          const color = obj.color ?? DEFAULT_SHAPE_COLOR
          const diameter = Math.min(obj.width, obj.height)
          const radius = diameter / 2
          const clipPath = (): [Path2D] => {
            const p = new Path2D()
            p.arc(radius, radius, radius, 0, Math.PI * 2)
            return [p]
          }
          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable
              clipFunc={clipPath}
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              {...makeDragHandlers(obj)}
              onDblClick={(e) => {
                e.cancelBubble = true
                onStartEditText?.(obj.id, obj.text ?? '')
              }}
              onDblTap={(e) => {
                e.cancelBubble = true
                onStartEditText?.(obj.id, obj.text ?? '')
              }}
            >
              <Circle
                x={radius}
                y={radius}
                radius={radius}
                fill={color}
                stroke={selectionStroke ?? '#333'}
                strokeWidth={selectionStroke ? 3 : 2}
              />
              <Text
                text={obj.text ?? ''}
                width={diameter - 12}
                height={diameter - 12}
                x={6}
                y={6}
                fontSize={textFontSize({ ...obj, width: diameter, height: diameter })}
                listening={false}
                wrap="word"
                align="center"
                verticalAlign="middle"
              />
            </Group>
          )
        }

        if (obj.type === 'line') {
          const color = obj.color ?? DEFAULT_SHAPE_COLOR
          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              {...makeDragHandlers(obj)}
            >
              <Arrow
                points={[0, 0, obj.width, obj.height]}
                stroke={selectionStroke ?? color}
                strokeWidth={isSelected ? 4 : 2}
                lineCap="round"
                lineJoin="round"
                pointerLength={12}
                pointerWidth={12}
                pointerAtEnding
              />
            </Group>
          )
        }

        if (obj.type === 'text') {
          const fontSize = obj.font_size ?? TEXT_DEFAULT_FONT_SIZE
          const fontColor = obj.font_color ?? DEFAULT_TEXT_COLOR
          return (
            <Group
              key={obj.id}
              id={obj.id}
              x={obj.x}
              y={obj.y}
              rotation={obj.rotation ?? 0}
              draggable
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
              {...makeDragHandlers(obj)}
              onDblClick={(e) => {
                e.cancelBubble = true
                onStartEditText?.(obj.id, obj.text ?? '')
              }}
              onDblTap={(e) => {
                e.cancelBubble = true
                onStartEditText?.(obj.id, obj.text ?? '')
              }}
            >
              {isSelected && (
                <Rect
                  x={-4}
                  y={-4}
                  width={obj.width + 8}
                  height={obj.height + 8}
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dash={[4, 3]}
                  cornerRadius={4}
                  listening={false}
                />
              )}
              <Text
                text={obj.text ?? ''}
                width={obj.width}
                height={obj.height}
                fontSize={fontSize}
                fill={fontColor}
                wrap="word"
                align="left"
                verticalAlign="top"
              />
            </Group>
          )
        }

        // Default: rect
        const color = obj.color ?? DEFAULT_SHAPE_COLOR
        return (
          <Group
            key={obj.id}
            id={obj.id}
            x={obj.x}
            y={obj.y}
            rotation={obj.rotation ?? 0}
            draggable
            onClick={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, e.evt.shiftKey)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, false)
            }}
            {...makeDragHandlers(obj)}
            onDblClick={(e) => {
              e.cancelBubble = true
              onStartEditText?.(obj.id, obj.text ?? '')
            }}
            onDblTap={(e) => {
              e.cancelBubble = true
              onStartEditText?.(obj.id, obj.text ?? '')
            }}
          >
            <Rect
              width={obj.width}
              height={obj.height}
              fill={color}
              stroke={selectionStroke ?? '#333'}
              strokeWidth={selectionStroke ? 3 : 2}
            />
            <Text
              text={obj.text ?? ''}
              width={obj.width - 16}
              height={obj.height - 16}
              x={8}
              y={8}
              fontSize={textFontSize(obj)}
              listening={false}
              wrap="word"
              align="center"
              verticalAlign="middle"
            />
          </Group>
        )
      })}

      {/* Connectors: rendered on top, computed from from/to object positions */}
      {connectors.map((obj) => {
        const fromObj = objects.find((o) => o.id === obj.from_id)
        const toObj = objects.find((o) => o.id === obj.to_id)
        if (!fromObj || !toObj) return null

        const fromX = fromObj.x + fromObj.width / 2
        const fromY = fromObj.y + fromObj.height / 2
        const toX = toObj.x + toObj.width / 2
        const toY = toObj.y + toObj.height / 2
        const isSelected = selectedIds.includes(obj.id)
        const strokeColor = obj.color ?? DEFAULT_CONNECTOR_COLOR
        const isArrow = obj.style !== 'line'

        if (isArrow) {
          return (
            <Arrow
              key={obj.id}
              id={obj.id}
              points={[fromX, fromY, toX, toY]}
              stroke={isSelected ? '#2563eb' : strokeColor}
              strokeWidth={isSelected ? 3 : 2}
              fill={isSelected ? '#2563eb' : strokeColor}
              pointerLength={12}
              pointerWidth={10}
              pointerAtEnding
              lineCap="round"
              onClick={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, e.evt.shiftKey)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onObjectClick(obj.id, false)
              }}
            />
          )
        }

        return (
          <Line
            key={obj.id}
            id={obj.id}
            points={[fromX, fromY, toX, toY]}
            stroke={isSelected ? '#2563eb' : strokeColor}
            strokeWidth={isSelected ? 3 : 2}
            lineCap="round"
            onClick={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, e.evt.shiftKey)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onObjectClick(obj.id, false)
            }}
          />
        )
      })}
    </>
  )
}

export default memo(BoardObjects)
