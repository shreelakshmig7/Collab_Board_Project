/**
 * Supabase Edge Function: AI command proxy.
 * Keeps ANTHROPIC_API_KEY server-side. Validates JWT before calling Claude.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'claude-sonnet-4-20250514'
const TABLE = 'board_objects'

// Inlined from constants (Deno can't import Vite modules)
const STICKY_WIDTH = 180
const STICKY_HEIGHT = 120
const CIRCLE_DIAMETER = 80
const LINE_DEFAULT_WIDTH = 120
const LINE_DEFAULT_HEIGHT = 60
const FRAME_DEFAULT_WIDTH = 400
const FRAME_DEFAULT_HEIGHT = 300
const TEXT_DEFAULT_FONT_SIZE = 18
const DEFAULT_STICKY_COLOR = '#FEF08A'
const DEFAULT_SHAPE_COLOR = '#93C5FD'
const DEFAULT_FRAME_COLOR = '#6366f1'
const DEFAULT_TEXT_COLOR = '#1a1a1a'
const DEFAULT_CONNECTOR_COLOR = '#6b7280'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TOOLS = [
  { name: 'getBoardState', description: 'Returns all objects on the board.', input_schema: { type: 'object' as const, properties: {}, required: [] } },
  { name: 'createStickyNote', description: 'Create a sticky note.', input_schema: { type: 'object' as const, properties: { text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, color: { type: 'string' } }, required: ['text', 'x', 'y'] } },
  { name: 'createShape', description: 'Create rect, circle, or line.', input_schema: { type: 'object' as const, properties: { type: { type: 'string', enum: ['rect', 'circle', 'line'] }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, color: { type: 'string' } }, required: ['type', 'x', 'y'] } },
  { name: 'createFrame', description: 'Create a frame (labeled container).', input_schema: { type: 'object' as const, properties: { title: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, color: { type: 'string' } }, required: ['title', 'x', 'y'] } },
  { name: 'createConnector', description: 'Create connector between two objects.', input_schema: { type: 'object' as const, properties: { fromId: { type: 'string' }, toId: { type: 'string' }, style: { type: 'string', enum: ['arrow', 'line'] }, color: { type: 'string' } }, required: ['fromId', 'toId'] } },
  { name: 'createText', description: 'Create standalone text.', input_schema: { type: 'object' as const, properties: { text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, fontSize: { type: 'number' }, fontColor: { type: 'string' } }, required: ['text', 'x', 'y'] } },
  { name: 'moveObject', description: 'Move object by id.', input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['objectId', 'x', 'y'] } },
  { name: 'resizeObject', description: 'Resize object.', input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } }, required: ['objectId', 'width', 'height'] } },
  { name: 'rotateObject', description: 'Rotate object.', input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, rotation: { type: 'number' } }, required: ['objectId', 'rotation'] } },
  { name: 'updateText', description: 'Update text content.', input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, newText: { type: 'string' } }, required: ['objectId', 'newText'] } },
  { name: 'changeColor', description: 'Change object color.', input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, color: { type: 'string' } }, required: ['objectId', 'color'] } },
  { name: 'deleteObject', description: 'Delete object.', input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' } }, required: ['objectId'] } },
  { name: 'arrangeInGrid', description: 'Arrange objects in grid.', input_schema: { type: 'object' as const, properties: { objectIds: { type: 'array', items: { type: 'string' } }, columns: { type: 'number' }, startX: { type: 'number' }, startY: { type: 'number' }, spacing: { type: 'number' } }, required: ['objectIds', 'columns'] } },
]

const SYSTEM_PROMPT = `You are an AI assistant that helps users modify a collaborative whiteboard in real time.

Object types: sticky, rect, circle, line, frame, connector, text.
Use domain-appropriate labels for templates (SWOT: Strengths/Weaknesses/etc; Journey: Awareness/Consideration/etc).
Positioning: x 100-1500, y 100-1000. Call getBoardState first, then execute changes. Make changes immediately.`

type BoardObject = { id: string; type: string; x: number; y: number; width: number; height: number; text?: string; color?: string; rotation?: number; parent_id?: string; from_id?: string; to_id?: string; style?: string; font_size?: number; font_color?: string }

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const cols = 'id,type,x,y,width,height,text,color,rotation,parent_id,from_id,to_id,style,font_size,font_color'
  try {
    switch (name) {
      case 'getBoardState': {
        const { data, error } = await supabase.from(TABLE).select(cols).eq('board_id', boardId)
        if (error) throw error
        return JSON.stringify(data ?? [], null, 2)
      }
      case 'createStickyNote': {
        const id = crypto.randomUUID()
        await supabase.from(TABLE).insert({ board_id: boardId, id, type: 'sticky', x: input.x, y: input.y, width: STICKY_WIDTH, height: STICKY_HEIGHT, text: input.text ?? '', color: input.color ?? DEFAULT_STICKY_COLOR })
        return `Created sticky note with id ${id}`
      }
      case 'createShape': {
        const id = crypto.randomUUID()
        const t = input.type as string
        const w = t === 'circle' ? (input.width ?? CIRCLE_DIAMETER) : t === 'line' ? (input.width ?? LINE_DEFAULT_WIDTH) : (input.width ?? STICKY_WIDTH)
        const h = t === 'circle' ? w : t === 'line' ? (input.height ?? LINE_DEFAULT_HEIGHT) : (input.height ?? STICKY_HEIGHT)
        await supabase.from(TABLE).insert({ board_id: boardId, id, type: t, x: input.x, y: input.y, width: w, height: h, color: input.color ?? DEFAULT_SHAPE_COLOR })
        return `Created ${t} with id ${id}`
      }
      case 'createFrame': {
        const id = crypto.randomUUID()
        await supabase.from(TABLE).insert({ board_id: boardId, id, type: 'frame', x: input.x, y: input.y, width: input.width ?? FRAME_DEFAULT_WIDTH, height: input.height ?? FRAME_DEFAULT_HEIGHT, text: input.title ?? 'Frame', color: input.color ?? DEFAULT_FRAME_COLOR })
        return `Created frame with id ${id}`
      }
      case 'createConnector': {
        const id = crypto.randomUUID()
        await supabase.from(TABLE).insert({ board_id: boardId, id, type: 'connector', from_id: input.fromId, to_id: input.toId, style: input.style ?? 'arrow', color: input.color ?? DEFAULT_CONNECTOR_COLOR, x: 0, y: 0, width: 0, height: 0 })
        return `Created connector with id ${id}`
      }
      case 'createText': {
        const id = crypto.randomUUID()
        await supabase.from(TABLE).insert({ board_id: boardId, id, type: 'text', x: input.x, y: input.y, width: 200, height: 80, text: input.text ?? '', font_size: input.fontSize ?? TEXT_DEFAULT_FONT_SIZE, font_color: input.fontColor ?? DEFAULT_TEXT_COLOR })
        return `Created text with id ${id}`
      }
      case 'moveObject':
        await supabase.from(TABLE).update({ x: input.x, y: input.y, updated_at: new Date().toISOString() }).eq('board_id', boardId).eq('id', input.objectId)
        return 'Moved'
      case 'resizeObject':
        await supabase.from(TABLE).update({ width: input.width, height: input.height, updated_at: new Date().toISOString() }).eq('board_id', boardId).eq('id', input.objectId)
        return 'Resized'
      case 'rotateObject':
        await supabase.from(TABLE).update({ rotation: input.rotation ?? 0, updated_at: new Date().toISOString() }).eq('board_id', boardId).eq('id', input.objectId)
        return `Rotated to ${input.rotation}°`
      case 'updateText':
        await supabase.from(TABLE).update({ text: input.newText ?? '', updated_at: new Date().toISOString() }).eq('board_id', boardId).eq('id', input.objectId)
        return 'Updated text'
      case 'changeColor':
        await supabase.from(TABLE).update({ color: input.color ?? '', updated_at: new Date().toISOString() }).eq('board_id', boardId).eq('id', input.objectId)
        return 'Changed color'
      case 'deleteObject':
        await supabase.from(TABLE).delete().eq('board_id', boardId).eq('id', input.objectId)
        return 'Deleted'
      case 'arrangeInGrid': {
        const ids = Array.isArray(input.objectIds) ? input.objectIds as string[] : []
        const colsCount = Number(input.columns) || 3
        const startX = Number(input.startX ?? 100)
        const startY = Number(input.startY ?? 100)
        const spacing = Number(input.spacing ?? 20)
        const { data: objs } = await supabase.from(TABLE).select(cols).eq('board_id', boardId).in('id', ids)
        if (!objs?.length) return 'No objects found'
        const cellW = Math.max(...objs.map((o: BoardObject) => o.width))
        const cellH = Math.max(...objs.map((o: BoardObject) => o.height))
        for (let i = 0; i < objs.length; i++) {
          const col = i % colsCount
          const row = Math.floor(i / colsCount)
          await supabase.from(TABLE).update({ x: startX + col * (cellW + spacing), y: startY + row * (cellH + spacing), updated_at: new Date().toISOString() }).eq('board_id', boardId).eq('id', objs[i].id)
        }
        return `Arranged ${objs.length} objects in grid`
      }
      default:
        return `Unknown tool: ${name}`
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing or invalid Authorization header' }, { status: 401, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500, headers: corsHeaders })
  }

  let body: { userMessage: string; currentObjects: BoardObject[]; boardId: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const { userMessage, currentObjects, boardId } = body
  if (!userMessage || !boardId) {
    return Response.json({ error: 'userMessage and boardId required' }, { status: 400, headers: corsHeaders })
  }

  const boardStateJson = JSON.stringify(currentObjects ?? [], null, 2)
  const messages: { role: string; content: string | unknown[] }[] = [
    { role: 'user', content: `Current board state:\n${boardStateJson}\n\nUser request: ${userMessage}` },
  ]

  const maxTurns = 8
  for (let turn = 0; turn < maxTurns; turn++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return Response.json({ error: `Claude API error: ${resp.status} ${errText}` }, { status: 502, headers: corsHeaders })
    }

    const data = await resp.json() as { content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] }
    const content = data.content ?? []
    const textParts: string[] = []
    const toolUseBlocks: { id: string; name: string; input: unknown }[] = []

    for (const block of content) {
      if (block.type === 'text' && block.text) textParts.push(block.text)
      if (block.type === 'tool_use' && block.id) {
        toolUseBlocks.push({ id: block.id, name: block.name ?? '', input: block.input ?? {} })
      }
    }

    if (toolUseBlocks.length === 0) {
      return Response.json({
        text: textParts.join('\n').trim() || 'Done.',
      }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    messages.push({ role: 'assistant', content })
    const toolResults = toolUseBlocks.map((tb) => ({
      type: 'tool_result' as const,
      tool_use_id: tb.id,
      content: '',
    }))

    for (let i = 0; i < toolUseBlocks.length; i++) {
      toolResults[i].content = await executeTool(supabase, boardId, toolUseBlocks[i].name, (toolUseBlocks[i].input as Record<string, unknown>) ?? {})
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return Response.json({ text: 'Reached max tool turns.', error: 'Max turns exceeded' }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
