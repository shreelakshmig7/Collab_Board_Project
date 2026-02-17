import { Group, Circle, Text } from 'react-konva'

export type CursorData = {
  uid: string
  x: number
  y: number
  displayName: string | null
  color: string
}

type OtherCursorsProps = {
  cursors: CursorData[]
  currentUid: string | null
}

export default function OtherCursors({ cursors, currentUid }: OtherCursorsProps) {
  const others = cursors.filter((c) => c.uid !== currentUid)

  return (
    <>
      {others.map((c) => (
        <Group key={c.uid} x={c.x} y={c.y}>
          <Circle radius={8} fill={c.color} stroke="#333" strokeWidth={1} />
          <Text
            text={c.displayName || 'Anonymous'}
            fontSize={12}
            y={14}
            x={-20}
            width={40}
            align="center"
            listening={false}
          />
        </Group>
      ))}
    </>
  )
}
