import { memo, useRef } from 'react'
import { Group, Rect, Text, Circle, Arrow } from 'react-konva'
import Konva from 'konva'
import type { BoardObject } from '../types/board'
import { DEFAULT_STICKY_COLOR, DEFAULT_SHAPE_COLOR } from '../constants'
import { updateObject } from '../supabase/objects'

const DRAG_UPDATE_THROTTLE_MS = 40

function textFontSize(obj: BoardObject): number {
  const base = Math.min(obj.width, obj.height) * 0.18
  return Math.max(10, Math.min(28, base))
}

type BoardObjectsProps = {
  boardId: string
  objects: BoardObject[]
  selectedId: string | null
  selectedNodeRef?: React.RefObject<Konva.Group | null>
  onSelect: (id: string | null) => void
  onStartEditText?: (id: string, text: string) => void
  onObjectMoved?: (id: string, x: number, y: number) => void
}

function BoardObjects({
  boardId,
  objects,
  selectedId,
  selectedNodeRef,
  onSelect,
  onStartEditText,
  onObjectMoved,
}: BoardObjectsProps) {
  const lastDragUpdateRef = useRef<Record<string, number>>({})

  const throttleDragUpdate = (objId: string, x: number, y: number) => {
    const now = Date.now()
    if (now - (lastDragUpdateRef.current[objId] ?? 0) >= DRAG_UPDATE_THROTTLE_MS) {
      lastDragUpdateRef.current[objId] = now
      onObjectMoved?.(objId, x, y)
      updateObject(boardId, objId, { x, y }).catch((err) =>
        console.error('Failed to update position during drag', err)
      )
    }
  }

  return (
    <>
      {objects.map((obj) => {
        const isSelected = selectedId === obj.id
        const groupRef = isSelected ? selectedNodeRef : undefined
        if (obj.type === 'sticky') {
          const color = obj.color ?? DEFAULT_STICKY_COLOR
          return (
            <Group
              key={obj.id}
              ref={groupRef as React.RefObject<Konva.Group>}
              x={obj.x}
              y={obj.y}
              draggable
              onClick={(e) => {
                e.cancelBubble = true
                onSelect(isSelected ? null : obj.id)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onSelect(isSelected ? null : obj.id)
              }}
              onDragMove={(e) => {
                const node = e.target
                throttleDragUpdate(obj.id, node.x(), node.y())
              }}
              onDragEnd={(e) => {
                const node = e.target
                const x = node.x()
                const y = node.y()
                onObjectMoved?.(obj.id, x, y)
                updateObject(boardId, obj.id, { x, y }).catch((err) =>
                  console.error('Failed to update sticky position', err)
                )
              }}
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
                stroke={isSelected ? '#2563eb' : 'transparent'}
                strokeWidth={isSelected ? 3 : 0}
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
          const radius = obj.width / 2
          return (
            <Group
              key={obj.id}
              ref={groupRef as React.RefObject<Konva.Group>}
              x={obj.x}
              y={obj.y}
              draggable
              onClick={(e) => {
                e.cancelBubble = true
                onSelect(isSelected ? null : obj.id)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onSelect(isSelected ? null : obj.id)
              }}
              onDragMove={(e) => {
                const node = e.target
                throttleDragUpdate(obj.id, node.x(), node.y())
              }}
              onDragEnd={(e) => {
                const node = e.target
                const x = node.x()
                const y = node.y()
                onObjectMoved?.(obj.id, x, y)
                updateObject(boardId, obj.id, { x, y }).catch((err) =>
                  console.error('Failed to update circle position', err)
                )
              }}
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
                radius={radius}
                fill={color}
                stroke={isSelected ? '#2563eb' : '#333'}
                strokeWidth={isSelected ? 3 : 2}
              />
              <Text
                text={obj.text ?? ''}
                width={obj.width - 12}
                height={obj.height - 12}
                x={6}
                y={6}
                fontSize={textFontSize(obj)}
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
              ref={groupRef as React.RefObject<Konva.Group>}
              x={obj.x}
              y={obj.y}
              draggable
              onClick={(e) => {
                e.cancelBubble = true
                onSelect(isSelected ? null : obj.id)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onSelect(isSelected ? null : obj.id)
              }}
              onDragMove={(e) => {
                const node = e.target
                throttleDragUpdate(obj.id, node.x(), node.y())
              }}
              onDragEnd={(e) => {
                const node = e.target
                const x = node.x()
                const y = node.y()
                onObjectMoved?.(obj.id, x, y)
                updateObject(boardId, obj.id, { x, y }).catch((err) =>
                  console.error('Failed to update line position', err)
                )
              }}
            >
              <Arrow
                points={[0, 0, obj.width, obj.height]}
                stroke={color}
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
        const color = obj.color ?? DEFAULT_SHAPE_COLOR
        return (
          <Group
            key={obj.id}
            ref={groupRef as React.RefObject<Konva.Group>}
            x={obj.x}
            y={obj.y}
            draggable
            onClick={(e) => {
              e.cancelBubble = true
              onSelect(isSelected ? null : obj.id)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onSelect(isSelected ? null : obj.id)
            }}
            onDragMove={(e) => {
              const node = e.target
              throttleDragUpdate(obj.id, node.x(), node.y())
            }}
            onDragEnd={(e) => {
              const node = e.target
              const x = node.x()
              const y = node.y()
              onObjectMoved?.(obj.id, x, y)
              updateObject(boardId, obj.id, { x, y }).catch((err) =>
                console.error('Failed to update rect position', err)
              )
            }}
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
              stroke={isSelected ? '#2563eb' : '#333'}
              strokeWidth={isSelected ? 3 : 2}
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
    </>
  )
}

export default memo(BoardObjects)
