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

function toolButtonClass(active: boolean) {
  return `px-4 py-2 rounded-md border border-gray-200 cursor-pointer transition-colors ${
    active ? 'font-semibold bg-blue-100 border-blue-200' : 'font-normal bg-gray-100 hover:bg-gray-200'
  }`
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
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex gap-2">
        <button type="button" onClick={() => onToolChange('sticky')} className={toolButtonClass(activeTool === 'sticky')}>
          Sticky
        </button>
        <button type="button" onClick={() => onToolChange('rect')} className={toolButtonClass(activeTool === 'rect')}>
          Rect
        </button>
        <button type="button" onClick={() => onToolChange('circle')} className={toolButtonClass(activeTool === 'circle')}>
          Circle
        </button>
        <button type="button" onClick={() => onToolChange('line')} className={toolButtonClass(activeTool === 'line')}>
          Line
        </button>
      </div>
      {selectedColorableId && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{selectedStickyId ? 'Sticky color:' : 'Color:'}</span>
          {STICKY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              className="w-7 h-7 rounded-md border-2 border-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: color }}
            />
          ))}
        </div>
      )}
      {isResizable && selectedObject && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{isCircle ? 'Size:' : 'W × H:'}</span>
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
            className="w-14 px-1.5 py-1 text-sm border border-gray-200 rounded"
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
              className="w-14 px-1.5 py-1 text-sm border border-gray-200 rounded"
            />
          )}
        </div>
      )}
    </div>
  )
}
