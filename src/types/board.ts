export type BoardObject = {
  id: string
  type: 'sticky' | 'rect' | 'circle' | 'line' | 'frame' | 'connector' | 'text'
  x: number
  y: number
  width: number
  height: number
  text?: string
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
  /** Connector style: 'line' | 'arrow' */
  style?: string
}
