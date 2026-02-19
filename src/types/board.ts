export type ConnectorStyle = 'arrow' | 'line' | 'dashed' | 'dotted'

export type BoardObject = {
  id: string
  type: 'sticky' | 'rect' | 'circle' | 'line' | 'frame' | 'connector' | 'text'
  x: number
  y: number
  width: number
  height: number
  text?: string
  /** Frame body text (editable separately from header) */
  body_text?: string
  color?: string
  /** Rotation in degrees */
  rotation?: number
  /** Parent frame id (for objects inside a frame) */
  parent_id?: string
  /** Font size for standalone text objects */
  font_size?: number
  /** Font color for standalone text objects */
  font_color?: string
  /** Source object id for connector type */
  from_id?: string
  /** Target object id for connector type */
  to_id?: string
  /** Connector style: 'arrow' | 'line' | 'dashed' (stored as string from DB) */
  style?: string
  /** Override for connector tail (when user drags endpoint). If set, used instead of computed from object edge. */
  from_x?: number
  /** @see from_x */
  from_y?: number
  /** Override for connector head (when user drags endpoint). */
  to_x?: number
  /** @see to_x */
  to_y?: number
}
