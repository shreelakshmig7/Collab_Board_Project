export type BoardObject = {
  id: string
  type: 'sticky' | 'rect' | 'circle' | 'line'
  x: number
  y: number
  width: number
  height: number
  text?: string
  color?: string
}
