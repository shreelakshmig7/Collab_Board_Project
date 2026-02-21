// @ts-nocheck
/**
 * Supabase Edge Function: AI command proxy.
 * Keeps ANTHROPIC_API_KEY server-side. Validates JWT before calling Claude.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getPolicyForMessage } from './policy.ts'

const COMPLEX_MODEL = Deno.env.get('ANTHROPIC_MODEL_COMPLEX') ?? 'claude-sonnet-4-20250514'
const SIMPLE_MODEL = Deno.env.get('ANTHROPIC_MODEL_SIMPLE') ?? 'claude-haiku-4-5-20251001'
const TABLE = 'board_objects'

// Standard element sizes (Deno can't import Vite modules)
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

// Compound layout constants — quadrant (SWOT / 2×2 matrix)
// Uses nested frames as quadrant containers so the canvas renders colored headers automatically.
const QUAD_OUTER_W = 800
const QUAD_OUTER_TITLE_H = 40   // outer frame title bar (rendered by canvas)
const QUAD_INNER_W = 400         // QUAD_OUTER_W / 2
const QUAD_INNER_H = 320         // half of content area
const QUAD_OUTER_H = QUAD_OUTER_TITLE_H + 2 * QUAD_INNER_H  // 680
const QUAD_INNER_TITLE_H = 40   // inner frame title bar (rendered by canvas)
const QUAD_S_PAD = 12
const QUAD_S_W = 160
const QUAD_S_H = 85
const QUAD_S_GAP = 8

const QUAD_FRAME_COLORS: Record<string, string> = {
  topLeft: '#16a34a',
  topRight: '#dc2626',
  bottomLeft: '#2563eb',
  bottomRight: '#d97706',
}
const QUAD_STICKY_COLORS: Record<string, string> = {
  topLeft: '#86efac',
  topRight: '#fca5a5',
  bottomLeft: '#93c5fd',
  bottomRight: '#fdba74',
}

// Compound layout constants — column layout (retro / kanban / journey map)
const COL_INNER_W = 210
const COL_GAP = 12
const COL_OUTER_PAD = 12
const COL_OUTER_TITLE_H = 40
const COL_INNER_TITLE_H = 40    // inner frame title bar (rendered by canvas)
const COL_S_PAD = 10
const COL_S_W = COL_INNER_W - 2 * COL_S_PAD
const COL_S_H = 85
const COL_S_GAP = 8
const COL_MIN_INNER_H = 380

const COL_FRAME_COLORS = ['#16a34a', '#dc2626', '#2563eb', '#d97706', '#7c3aed', '#b45309']
const COL_STICKY_COLORS = ['#86efac', '#fca5a5', '#93c5fd', '#fdba74', '#c4b5fd', '#fde68a']

const BOARD_STATE_OBJECT_CAP = 200

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TOOLS = [
  {
    name: 'getBoardState',
    description: 'Returns all objects currently on the board. Use only when you need to identify specific existing objects by their id.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'createStickyNote',
    description: 'Create a sticky note.',
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, color: { type: 'string' } }, required: ['text', 'x', 'y'] },
  },
  {
    name: 'createShape',
    description: 'Create rect, circle, or line.',
    input_schema: { type: 'object' as const, properties: { type: { type: 'string', enum: ['rect', 'circle', 'line'] }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, color: { type: 'string' } }, required: ['type', 'x', 'y'] },
  },
  {
    name: 'createFrame',
    description: 'Create a frame (labeled container).',
    input_schema: { type: 'object' as const, properties: { title: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, color: { type: 'string' } }, required: ['title', 'x', 'y'] },
  },
  {
    name: 'createConnector',
    description: 'Create connector between two objects.',
    input_schema: { type: 'object' as const, properties: { fromId: { type: 'string' }, toId: { type: 'string' }, style: { type: 'string', enum: ['arrow', 'line', 'dashed', 'dotted'] }, color: { type: 'string' } }, required: ['fromId', 'toId'] },
  },
  {
    name: 'createText',
    description: 'Create standalone text.',
    input_schema: { type: 'object' as const, properties: { text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, fontSize: { type: 'number' }, fontColor: { type: 'string' } }, required: ['text', 'x', 'y'] },
  },
  {
    name: 'moveObject',
    description: 'Move object by id.',
    input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['objectId', 'x', 'y'] },
  },
  {
    name: 'resizeObject',
    description: 'Resize object.',
    input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } }, required: ['objectId', 'width', 'height'] },
  },
  {
    name: 'rotateObject',
    description: 'Rotate object.',
    input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, rotation: { type: 'number' } }, required: ['objectId', 'rotation'] },
  },
  {
    name: 'updateText',
    description: 'Update text content.',
    input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, newText: { type: 'string' } }, required: ['objectId', 'newText'] },
  },
  {
    name: 'changeColor',
    description: 'Change object color.',
    input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' }, color: { type: 'string' } }, required: ['objectId', 'color'] },
  },
  {
    name: 'deleteObject',
    description: 'Delete a single object by id.',
    input_schema: { type: 'object' as const, properties: { objectId: { type: 'string' } }, required: ['objectId'] },
  },
  {
    name: 'arrangeInGrid',
    description: 'Arrange objects in a grid.',
    input_schema: { type: 'object' as const, properties: { objectIds: { type: 'array', items: { type: 'string' } }, columns: { type: 'number' }, startX: { type: 'number' }, startY: { type: 'number' }, spacing: { type: 'number' } }, required: ['objectIds', 'columns'] },
  },
  // ── Compound tools ────────────────────────────────────────────────────────
  {
    name: 'createQuadrant',
    description: 'Create a complete 2×2 quadrant diagram (SWOT analysis, matrix). The server builds the full layout — frame, axis lines, quadrant labels, and sticky notes — in a single operation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        quadrantLabels: {
          type: 'object',
          properties: {
            topLeft: { type: 'string' },
            topRight: { type: 'string' },
            bottomLeft: { type: 'string' },
            bottomRight: { type: 'string' },
          },
        },
        items: {
          type: 'object',
          properties: {
            topLeft: { type: 'array', items: { type: 'string' } },
            topRight: { type: 'array', items: { type: 'string' } },
            bottomLeft: { type: 'array', items: { type: 'string' } },
            bottomRight: { type: 'array', items: { type: 'string' } },
          },
        },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['title', 'quadrantLabels'],
    },
  },
  {
    name: 'createColumnLayout',
    description: 'Create a complete column-based layout (retrospective, kanban, user journey map). The server builds the full layout — frame, column headers, and sticky notes — in a single operation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              items: { type: 'array', items: { type: 'string' } },
              color: { type: 'string' },
            },
            required: ['name'],
          },
        },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['title', 'columns'],
    },
  },
  {
    name: 'clearBoard',
    description: 'Remove every object from the board. Use when the user wants to clear, wipe, or reset the board.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
]

const SYSTEM_PROMPT = `You are an AI assistant that helps users modify a collaborative whiteboard in real time. You always act directly with tools — never ask the user for information.

CRITICAL RULES:
- Never ask the user for object IDs, coordinates, dimensions, or any other values. Always find them yourself using getBoardState or the inline board state.
- If the user asks to modify existing objects (move, resize, change color, delete, arrange, space evenly) and the inline board state is empty or missing, call getBoardState first to get the current objects.
- When size or position is not specified, make a reasonable choice (e.g. 1.5× current size for resize, place near x=100 y=100 for new objects).

Object types: sticky, rect, circle, line, frame, connector, text.
Positioning: x 100-1500, y 100-1000.

Use domain-appropriate content for templates:
- SWOT: Strengths / Weaknesses / Opportunities / Threats
- Journey map: Awareness / Consideration / Purchase / Retention / Advocacy
- Retrospective: What Went Well / What Didn't / Action Items

Compound tools (createQuadrant, createColumnLayout, clearBoard) build the full layout server-side in one call. Prefer them for templates and board resets — do not try to recreate their output with multiple individual tool calls.

For simple commands, make the change in a single tool call. Only call getBoardState when you need to identify specific existing objects by their id.`

type BoardObject = {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  color?: string
  rotation?: number
  parent_id?: string
  from_id?: string
  to_id?: string
  style?: string
  font_size?: number
  font_color?: string
}

// ── Compound tool helpers ───────────────────────────────────────────────────

// Each quadrant is a nested frame — the canvas automatically renders the colored header bar.
// World positions are stored; the canvas converts to relative coords (child.x - parent.x).
async function executeCreateQuadrant(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  input: Record<string, unknown>
): Promise<string> {
  const title = String(input.title ?? 'Quadrant Diagram')
  const startX = Number(input.x ?? 100)
  const startY = Number(input.y ?? 100)
  const labels = (input.quadrantLabels ?? {}) as Record<string, string>
  const items = (input.items ?? {}) as Record<string, string[]>

  const created: string[] = []

  // Outer frame
  const frameId = crypto.randomUUID()
  await supabase.from(TABLE).insert({
    board_id: boardId, id: frameId, type: 'frame',
    x: startX, y: startY, width: QUAD_OUTER_W, height: QUAD_OUTER_H,
    text: title, color: DEFAULT_FRAME_COLOR,
  })
  created.push(frameId)

  const quadrants = [
    { key: 'topLeft',     col: 0, row: 0, label: labels.topLeft     ?? 'Top Left' },
    { key: 'topRight',    col: 1, row: 0, label: labels.topRight     ?? 'Top Right' },
    { key: 'bottomLeft',  col: 0, row: 1, label: labels.bottomLeft   ?? 'Bottom Left' },
    { key: 'bottomRight', col: 1, row: 1, label: labels.bottomRight  ?? 'Bottom Right' },
  ]

  for (const q of quadrants) {
    const innerX = startX + q.col * QUAD_INNER_W
    const innerY = startY + QUAD_OUTER_TITLE_H + q.row * QUAD_INNER_H
    const frameColor = QUAD_FRAME_COLORS[q.key]
    const stickyColor = QUAD_STICKY_COLORS[q.key]

    // Inner frame — canvas renders colored header + dashed border automatically
    const innerId = crypto.randomUUID()
    await supabase.from(TABLE).insert({
      board_id: boardId, id: innerId, type: 'frame',
      x: innerX, y: innerY, width: QUAD_INNER_W, height: QUAD_INNER_H,
      text: q.label, color: frameColor, parent_id: frameId,
    })
    created.push(innerId)

    // Stickies inside inner frame (grandchildren of outer frame)
    const qItems = Array.isArray(items[q.key]) ? (items[q.key] as string[]) : []
    for (let i = 0; i < qItems.length; i++) {
      const sCol = i % 2
      const sRow = Math.floor(i / 2)
      const sx = innerX + QUAD_S_PAD + sCol * (QUAD_S_W + QUAD_S_GAP)
      const sy = innerY + QUAD_INNER_TITLE_H + QUAD_S_PAD + sRow * (QUAD_S_H + QUAD_S_GAP)

      if (sy + QUAD_S_H > innerY + QUAD_INNER_H - QUAD_S_PAD) break

      const sId = crypto.randomUUID()
      await supabase.from(TABLE).insert({
        board_id: boardId, id: sId, type: 'sticky',
        x: sx, y: sy, width: QUAD_S_W, height: QUAD_S_H,
        text: qItems[i], color: stickyColor, parent_id: innerId,
      })
      created.push(sId)
    }
  }

  return `Created quadrant diagram "${title}" with ${created.length} elements`
}

// Each column is a nested frame — the canvas automatically renders the colored header bar.
async function executeCreateColumnLayout(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  input: Record<string, unknown>
): Promise<string> {
  const title = String(input.title ?? 'Column Layout')
  const startX = Number(input.x ?? 100)
  const startY = Number(input.y ?? 100)
  const columns = Array.isArray(input.columns)
    ? (input.columns as Array<{ name: string; items?: string[]; color?: string }>)
    : []

  if (columns.length === 0) return 'No columns provided'

  const maxItems = Math.max(...columns.map((c) => (c.items ?? []).length), 0)
  const innerH = Math.max(
    COL_MIN_INNER_H,
    COL_INNER_TITLE_H + COL_S_PAD + maxItems * (COL_S_H + COL_S_GAP) + COL_S_PAD
  )
  const outerW = columns.length * COL_INNER_W + (columns.length - 1) * COL_GAP + 2 * COL_OUTER_PAD
  const outerH = COL_OUTER_TITLE_H + COL_OUTER_PAD + innerH + COL_OUTER_PAD

  const created: string[] = []

  // Outer frame
  const frameId = crypto.randomUUID()
  await supabase.from(TABLE).insert({
    board_id: boardId, id: frameId, type: 'frame',
    x: startX, y: startY, width: outerW, height: outerH,
    text: title, color: DEFAULT_FRAME_COLOR,
  })
  created.push(frameId)

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const frameColor = col.color ?? COL_FRAME_COLORS[i % COL_FRAME_COLORS.length]
    const stickyColor = COL_STICKY_COLORS[i % COL_STICKY_COLORS.length]
    const innerX = startX + COL_OUTER_PAD + i * (COL_INNER_W + COL_GAP)
    const innerY = startY + COL_OUTER_TITLE_H + COL_OUTER_PAD

    // Inner frame (column) — canvas renders colored header + dashed border automatically
    const innerId = crypto.randomUUID()
    await supabase.from(TABLE).insert({
      board_id: boardId, id: innerId, type: 'frame',
      x: innerX, y: innerY, width: COL_INNER_W, height: innerH,
      text: col.name, color: frameColor, parent_id: frameId,
    })
    created.push(innerId)

    // Stickies inside column (grandchildren of outer frame)
    const colItems = col.items ?? []
    for (let j = 0; j < colItems.length; j++) {
      const sx = innerX + COL_S_PAD
      const sy = innerY + COL_INNER_TITLE_H + COL_S_PAD + j * (COL_S_H + COL_S_GAP)

      if (sy + COL_S_H > innerY + innerH - COL_S_PAD) break

      const sId = crypto.randomUUID()
      await supabase.from(TABLE).insert({
        board_id: boardId, id: sId, type: 'sticky',
        x: sx, y: sy, width: COL_S_W, height: COL_S_H,
        text: colItems[j], color: stickyColor, parent_id: innerId,
      })
      created.push(sId)
    }
  }

  return `Created column layout "${title}" with ${created.length} elements`
}

// ── Tool executor ───────────────────────────────────────────────────────────

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
        const objects = data ?? []
        // Cap: return only frames + summary when board is large to protect context window
        if (objects.length > BOARD_STATE_OBJECT_CAP) {
          const frames = objects.filter((o: BoardObject) => o.type === 'frame')
          return JSON.stringify({
            summary: `Board has ${objects.length} objects total. Only frames are shown to keep context manageable.`,
            frames,
          }, null, 2)
        }
        return JSON.stringify(objects, null, 2)
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

      // ── Compound tools ────────────────────────────────────────────────────
      case 'createQuadrant':
        return await executeCreateQuadrant(supabase, boardId, input)

      case 'createColumnLayout':
        return await executeCreateColumnLayout(supabase, boardId, input)

      case 'clearBoard': {
        const { error } = await supabase.from(TABLE).delete().eq('board_id', boardId)
        if (error) throw error
        return 'Board cleared'
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (e) {
    console.error(`executeTool error [${name}]`, e)
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

// ── Request handler ─────────────────────────────────────────────────────────

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

  const policy = getPolicyForMessage(userMessage)
  const modelForRequest = policy.modelTier === 'fast' ? SIMPLE_MODEL : COMPLEX_MODEL
  const toolsForRequest = policy.allowGetBoardState ? TOOLS : TOOLS.filter((t) => t.name !== 'getBoardState')

  const boardStateJson = JSON.stringify(currentObjects ?? [])
  const messages: { role: string; content: string | unknown[] }[] = [
    { role: 'user', content: `Current board state:\n${boardStateJson}\n\nUser request: ${userMessage}` },
  ]

  for (let turn = 0; turn < policy.maxTurns; turn++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelForRequest,
        max_tokens: policy.maxTokens,
        system: SYSTEM_PROMPT,
        messages,
        tools: toolsForRequest,
        ...(policy.forcedToolName ? { tool_choice: { type: 'tool', name: policy.forcedToolName } } : {}),
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
      return Response.json(
        { text: textParts.join('\n').trim() || 'Done.' },
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    if (policy.returnAfterToolExecution) {
      const summary = toolResults.map((tr) => tr.content).filter(Boolean).join('\n').trim()
      return Response.json(
        { text: summary || 'Done.' },
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return Response.json(
    { text: 'Reached max tool turns.', error: 'Max turns exceeded' },
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
