import { useState, useEffect } from 'react'
import type { BoardObject, ConnectorStyle } from '../types/board'

export type Tool = 'select' | 'sticky' | 'rect' | 'circle' | 'line' | 'frame' | 'text' | 'connector'

const COLORS = ['#FEF08A', '#FECACA', '#BBF7D0', '#BFDBFE', '#E9D5FF', '#FED7AA', '#ffffff', '#1e293b']

const MIN_SIZE = 20
const MAX_SIZE = 800

const CREATE_TOOLS = ['sticky', 'rect', 'circle', 'frame', 'text'] as const
type CreateTool = (typeof CREATE_TOOLS)[number]

type ToolbarProps = {
  activeTool: Tool | null
  onToolChange: (tool: Tool | null) => void
  onCreateClick?: (tool: CreateTool) => void
  connectorStyle: ConnectorStyle
  onConnectorStyleChange: (style: ConnectorStyle) => void
  selectedIds: string[]
  selectedObject: BoardObject | null
  selectedColorableId: string | null
  onColorChange: (color: string) => void
  onResize: (width: number, height: number) => void
  onDuplicate: () => void
  onDelete: () => void
  isViewOnly?: boolean
}

function clampSize(val: number): number {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, val))
}

function toolBtn(active: boolean) {
  return `px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none ${
    active
      ? 'font-semibold bg-blue-100 border-blue-300 text-blue-800'
      : 'font-normal bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
  }`
}

const CONNECTOR_STYLES: { value: ConnectorStyle; label: string }[] = [
  { value: 'arrow', label: 'Arrow' },
  { value: 'line', label: 'Line' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]

export default function Toolbar({
  activeTool,
  onToolChange,
  onCreateClick,
  connectorStyle,
  onConnectorStyleChange,
  selectedIds,
  selectedObject,
  selectedColorableId,
  onColorChange,
  onResize,
  onDuplicate,
  onDelete,
  isViewOnly = false,
}: ToolbarProps) {
  const [localWidth, setLocalWidth] = useState('')
  const [localHeight, setLocalHeight] = useState('')
  const [focusedInput, setFocusedInput] = useState<'w' | 'h' | null>(null)

  const isResizable =
    selectedObject &&
    ['sticky', 'rect', 'circle', 'frame', 'text'].includes(selectedObject.type)
  const isCircle = selectedObject?.type === 'circle'

  useEffect(() => {
    if (selectedObject && !focusedInput) {
      setLocalWidth(String(Math.round(selectedObject.width)))
      setLocalHeight(String(Math.round(selectedObject.height)))
    }
  }, [selectedObject?.id, selectedObject?.width, selectedObject?.height, focusedInput])

  if (isViewOnly) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-medium text-gray-500">View only</span>
      </div>
    )
  }

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
    onResize(selectedObject.width, h)
    setFocusedInput(null)
  }

  const hasSelection = selectedIds.length > 0

  const handleToolClick = (tool: Tool) => {
    if (CREATE_TOOLS.includes(tool as CreateTool) && onCreateClick) {
      onCreateClick(tool as CreateTool)
    } else {
      onToolChange(tool)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 min-h-[48px]">
      <button type="button" onClick={() => onToolChange('select')} className={toolBtn(activeTool === 'select')} title="Select tool: click objects to select; Shift+click to add to selection">
        Select
      </button>
      {/* Creation tools */}
      <div className="flex gap-1 flex-wrap">
        <button type="button" onClick={() => handleToolClick('sticky')} className={toolBtn(activeTool === 'sticky')}>
          Sticky
        </button>
        <button type="button" onClick={() => handleToolClick('rect')} className={toolBtn(activeTool === 'rect')}>
          Rect
        </button>
        <button type="button" onClick={() => handleToolClick('circle')} className={toolBtn(activeTool === 'circle')}>
          Circle
        </button>
        <button type="button" onClick={() => handleToolClick('frame')} className={toolBtn(activeTool === 'frame')}>
          Frame
        </button>
        <button type="button" onClick={() => handleToolClick('text')} className={toolBtn(activeTool === 'text')}>
          Text
        </button>
        <button type="button" onClick={() => handleToolClick('connector')} className={toolBtn(activeTool === 'connector')}>
          Connector
        </button>
      </div>
      {/* Connector style picker: Arrow | Line | Dashed (when Connector tool active or a connector is selected) */}
      {(activeTool === 'connector' || selectedObject?.type === 'connector') && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Style:</span>
          {CONNECTOR_STYLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onConnectorStyleChange(value)}
              aria-label={`Connector style: ${label}`}
              className={`px-2 py-1 text-xs rounded border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none ${
                connectorStyle === value
                  ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                  : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Selection actions */}
      {hasSelection && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">
            {selectedIds.length > 1 ? `${selectedIds.length} selected` : ''}
          </span>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate (Ctrl+D)"
            aria-label="Duplicate selected"
            className="px-3 py-1.5 text-sm rounded-md border border-gray-200 bg-gray-100 hover:bg-gray-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete (Del)"
            aria-label="Delete selected"
            className="px-3 py-1.5 text-sm rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 focus:outline-none"
          >
            Delete
          </button>
        </div>
      )}

      {/* Color picker */}
      {selectedColorableId && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Color:</span>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              aria-label={`Set color ${color}`}
              className="w-6 h-6 rounded border-2 border-gray-400 cursor-pointer hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none"
              style={{ background: color }}
            />
          ))}
        </div>
      )}

      {/* Size controls (single selection only) */}
      {isResizable && selectedObject && selectedIds.length === 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">{isCircle ? 'Size:' : 'W × H:'}</span>
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            aria-label={isCircle ? 'Size' : 'Width'}
            value={focusedInput === 'w' ? localWidth : Math.round(selectedObject.width)}
            onChange={(e) => setLocalWidth(e.target.value)}
            onFocus={() => setFocusedInput('w')}
            onBlur={commitWidth}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-14 px-1.5 py-1 text-sm border border-gray-200 rounded focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none"
          />
          {!isCircle && (
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              aria-label="Height"
              value={focusedInput === 'h' ? localHeight : Math.round(selectedObject.height)}
              onChange={(e) => setLocalHeight(e.target.value)}
              onFocus={() => setFocusedInput('h')}
              onBlur={commitHeight}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-14 px-1.5 py-1 text-sm border border-gray-200 rounded focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none"
            />
          )}
        </div>
      )}
    </div>
  )
}
