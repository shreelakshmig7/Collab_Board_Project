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
  /** When true, show "Select source node" tooltip next to Connector button */
  showConnectorSourceHint?: boolean
  connectorStyle: ConnectorStyle
  onConnectorStyleChange: (style: ConnectorStyle) => void
  selectedIds: string[]
  selectedObject: BoardObject | null
  selectedColorableId: string | null
  onColorChange: (color: string) => void
  onResize: (width: number, height: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onBringToFront?: () => void
  onSendToBack?: () => void
  isViewOnly?: boolean
  /** Disable backdrop blur while modal overlays are open to avoid blur nesting. */
  disableGlassBlur?: boolean
}

function clampSize(val: number): number {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, val))
}

function toolBtn(active: boolean) {
  return `px-3 py-1.5 text-sm rounded-lg border-2 cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none ${
    active
      ? 'font-semibold bg-blue-500/20 border-blue-400 text-blue-300 shadow-sm ring-2 ring-blue-400/40'
      : 'font-normal bg-white/[0.06] border-white/10 hover:bg-white/[0.14] hover:border-white/20 text-white/80'
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
  showConnectorSourceHint = false,
  connectorStyle,
  onConnectorStyleChange,
  selectedIds,
  selectedObject,
  selectedColorableId,
  onColorChange,
  onResize,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onBringToFront,
  onSendToBack,
  isViewOnly = false,
  disableGlassBlur = false,
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
      <div className={`flex items-center gap-3 px-4 py-2 bg-purple-950/60 border-b border-white/[0.08] shadow-lg rounded-b-xl min-h-[48px] will-change-transform ${disableGlassBlur ? '' : 'backdrop-blur-md'}`}>
        <span className="text-sm font-medium text-white/50">View only</span>
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
    <div className={`flex flex-wrap items-center gap-2 px-4 py-2 bg-purple-950/60 border-b border-white/[0.08] shadow-lg rounded-b-xl min-h-[48px] will-change-transform ${disableGlassBlur ? '' : 'backdrop-blur-md'}`}>
      {/* Undo / Redo */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="flex items-center justify-center w-8 h-8 rounded-lg border-2 border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7v6h6" /><path d="M3 13C5.5 7.5 11 5 16 5c3 0 5.5 1 7 3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="flex items-center justify-center w-8 h-8 rounded-lg border-2 border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 7v6h-6" /><path d="M21 13C18.5 7.5 13 5 8 5c-3 0-5.5 1-7 3" />
          </svg>
        </button>
      </div>
      <div className="h-6 w-px bg-white/[0.12]" />
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
        <span className="relative inline-block">
          <button type="button" onClick={() => handleToolClick('connector')} className={toolBtn(activeTool === 'connector')}>
            Connector
          </button>
          {showConnectorSourceHint && (
            <span
              className="absolute left-0 top-full mt-1 px-2 py-1 text-xs font-medium text-white/80 bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-lg shadow-lg whitespace-nowrap z-50"
              role="status"
              aria-live="polite"
            >
              Select source node
            </span>
          )}
        </span>
      </div>
      {/* Connector style picker: Arrow | Line | Dashed (when Connector tool active or a connector is selected) */}
      {(activeTool === 'connector' || selectedObject?.type === 'connector') && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-white/50">Style:</span>
          {CONNECTOR_STYLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onConnectorStyleChange(value)}
              aria-label={`Connector style: ${label}`}
              className={`px-2 py-1 text-xs rounded-lg border-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none ${
                connectorStyle === value
                  ? 'bg-blue-500/20 border-blue-400 text-blue-300 font-medium ring-2 ring-blue-400/40'
                  : 'bg-white/[0.06] border-white/10 text-white/70 hover:bg-white/[0.14] hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="h-6 w-px bg-white/[0.12]" />

      {/* Selection actions */}
      {hasSelection && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/45 mr-1">
            {selectedIds.length > 1 ? `${selectedIds.length} selected` : ''}
          </span>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate (Ctrl+D)"
            aria-label="Duplicate selected"
            className="px-3 py-1.5 text-sm rounded-lg border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.14] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none transition-all duration-200"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete (Del)"
            aria-label="Delete selected"
            className="px-3 py-1.5 text-sm rounded-lg border border-red-400/30 bg-red-500/15 text-red-300 hover:bg-red-500/25 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 focus:outline-none transition-all duration-200"
          >
            Delete
          </button>
          <div className="h-4 w-px bg-white/[0.12] mx-0.5" />
          <button
            type="button"
            onClick={onBringToFront}
            title="Bring to Front"
            aria-label="Bring to front"
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.14] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4l-4 4h3v8h2V8h3l-4-4z" />
            </svg>
            Front
          </button>
          <button
            type="button"
            onClick={onSendToBack}
            title="Send to Back"
            aria-label="Send to back"
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.14] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20l4-4h-3V8h-2v8H8l4 4z" />
            </svg>
            Back
          </button>
        </div>
      )}

      {/* Color picker */}
      {selectedColorableId && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/50">Color:</span>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              aria-label={`Set color ${color}`}
              className="w-6 h-6 rounded-lg border-2 border-white/40 cursor-pointer hover:opacity-90 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus:outline-none"
              style={{ background: color }}
            />
          ))}
        </div>
      )}

      {/* Size controls (single selection only) */}
      {isResizable && selectedObject && selectedIds.length === 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/50">{isCircle ? 'Size:' : 'W × H:'}</span>
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
            className="w-14 px-1.5 py-1 text-sm border border-white/10 bg-white/[0.08] text-white rounded-lg focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none"
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
              className="w-14 px-1.5 py-1 text-sm border border-white/10 bg-white/[0.08] text-white rounded-lg focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus:outline-none"
            />
          )}
        </div>
      )}
    </div>
  )
}
