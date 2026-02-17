import { useState, useEffect } from 'react'
import type { BoardObject } from '../types/board'

export type Tool = 'sticky' | 'rect' | 'circle' | 'line' | 'pan'

const STICKY_COLORS = ['#FEF08A', '#FECACA', '#BBF7D0', '#BFDBFE']

const MIN_SIZE = 20
const MAX_SIZE = 800

type ToolbarProps = {
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  selectedStickyId: string | null
  selectedColorableId: string | null
  selectedObject: BoardObject | null
  onColorChange: (color: string) => void
  onResize: (width: number, height: number) => void
}

function clampSize(val: number): number {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, val))
}

export default function Toolbar({
  activeTool,
  onToolChange,
  selectedStickyId,
  selectedColorableId,
  selectedObject,
  onColorChange,
  onResize,
}: ToolbarProps) {
  const [localWidth, setLocalWidth] = useState('')
  const [localHeight, setLocalHeight] = useState('')
  const [focusedInput, setFocusedInput] = useState<'w' | 'h' | null>(null)

  const isResizable =
    selectedObject &&
    (selectedObject.type === 'sticky' ||
      selectedObject.type === 'rect' ||
      selectedObject.type === 'circle' ||
      selectedObject.type === 'line')
  const isCircle = selectedObject?.type === 'circle'

  useEffect(() => {
    if (selectedObject && !focusedInput) {
      setLocalWidth(String(Math.round(selectedObject.width)))
      setLocalHeight(String(Math.round(selectedObject.height)))
    }
  }, [selectedObject?.id, selectedObject?.width, selectedObject?.height, focusedInput])

  const commitWidth = () => {
    if (!selectedObject) return
    const num = Number(localWidth)
    const w = clampSize(Number.isFinite(num) ? num : MIN_SIZE)
    setLocalWidth(String(w))
    if (isCircle) onResize(w, w)
    else onResize(w, selectedObject.height)
    setFocusedInput(null)
  }
  const commitHeight = () => {
    if (!selectedObject) return
    const num = Number(localHeight)
    const h = clampSize(Number.isFinite(num) ? num : MIN_SIZE)
    setLocalHeight(String(h))
    if (isCircle) onResize(selectedObject.width, h)
    else onResize(selectedObject.width, h)
    setFocusedInput(null)
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onToolChange('sticky')}
          style={{
            padding: '8px 16px',
            fontWeight: activeTool === 'sticky' ? 600 : 400,
            background: activeTool === 'sticky' ? '#dbeafe' : '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Sticky
        </button>
        <button
          type="button"
          onClick={() => onToolChange('rect')}
          style={{
            padding: '8px 16px',
            fontWeight: activeTool === 'rect' ? 600 : 400,
            background: activeTool === 'rect' ? '#dbeafe' : '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Rect
        </button>
        <button
          type="button"
          onClick={() => onToolChange('circle')}
          style={{
            padding: '8px 16px',
            fontWeight: activeTool === 'circle' ? 600 : 400,
            background: activeTool === 'circle' ? '#dbeafe' : '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Circle
        </button>
        <button
          type="button"
          onClick={() => onToolChange('line')}
          style={{
            padding: '8px 16px',
            fontWeight: activeTool === 'line' ? 600 : 400,
            background: activeTool === 'line' ? '#dbeafe' : '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Line
        </button>
      </div>
      {selectedColorableId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            {selectedStickyId ? 'Sticky color:' : 'Color:'}
          </span>
          {STICKY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: color,
                border: '2px solid #333',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}
      {isResizable && selectedObject && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>
            {isCircle ? 'Size:' : 'W × H:'}
          </span>
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={focusedInput === 'w' ? localWidth : Math.round(selectedObject.width)}
            onChange={(e) => setLocalWidth(e.target.value)}
            onFocus={() => setFocusedInput('w')}
            onBlur={commitWidth}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ width: 56, padding: '4px 6px', fontSize: 13 }}
          />
          {!isCircle && (
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={focusedInput === 'h' ? localHeight : Math.round(selectedObject.height)}
              onChange={(e) => setLocalHeight(e.target.value)}
              onFocus={() => setFocusedInput('h')}
              onBlur={commitHeight}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ width: 56, padding: '4px 6px', fontSize: 13 }}
            />
          )}
        </div>
      )}
    </div>
  )
}
