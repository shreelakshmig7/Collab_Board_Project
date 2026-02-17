/**
 * Claude API integration with tool use for board commands.
 * Uses VITE_ANTHROPIC_API_KEY (for production, call via a backend to keep key server-side).
 */
import Anthropic from '@anthropic-ai/sdk'
import type { BoardObject } from '../types/board'
import * as boardTools from './boardTools'

const MODEL = 'claude-sonnet-4-20250514'

function getApiKey(): string {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to .env for AI commands.')
  return key
}

type ToolDef = { name: string; description: string; input_schema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] } }

const TOOLS: ToolDef[] = [
  {
    name: 'getBoardState',
    description: 'Returns the current list of all objects on the board (stickies, shapes, etc.) with their id, type, x, y, width, height, text, color. Use this to see what is on the board before making changes.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'createStickyNote',
    description: 'Create a new sticky note on the board at the given position.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text content of the sticky' },
        x: { type: 'number', description: 'X position on canvas' },
        y: { type: 'number', description: 'Y position on canvas' },
        color: { type: 'string', description: 'Hex color e.g. #FEF08A (yellow)' },
      },
      required: ['text', 'x', 'y'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a rectangle, circle, or line. For line, width/height are the delta from (x,y) to the other end.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['rect', 'circle', 'line'], description: 'Shape type' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        color: { type: 'string' },
      },
      required: ['type', 'x', 'y'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object by id to a new position.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'Id of the object' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['objectId', 'x', 'y'],
    },
  },
  {
    name: 'resizeObject',
    description: 'Change width and height of an object.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['objectId', 'width', 'height'],
    },
  },
  {
    name: 'updateText',
    description: 'Update the text of a sticky note.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        newText: { type: 'string' },
      },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'changeColor',
    description: 'Change the color of an object (hex e.g. #FEF08A).',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        color: { type: 'string' },
      },
      required: ['objectId', 'color'],
    },
  },
]

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'getBoardState': {
        const state = await boardTools.getBoardState()
        return JSON.stringify(state, null, 2)
      }
      case 'createStickyNote': {
        const id = await boardTools.createStickyNote(
          String(input.text ?? ''),
          Number(input.x),
          Number(input.y),
          input.color ? String(input.color) : undefined
        )
        return `Created sticky note with id ${id}`
      }
      case 'createShape': {
        const id = await boardTools.createShape(
          input.type as 'rect' | 'circle' | 'line',
          Number(input.x),
          Number(input.y),
          input.width != null ? Number(input.width) : 120,
          input.height != null ? Number(input.height) : 80,
          input.color ? String(input.color) : undefined
        )
        return `Created ${input.type} with id ${id}`
      }
      case 'moveObject':
        await boardTools.moveObject(
          String(input.objectId),
          Number(input.x),
          Number(input.y)
        )
        return 'Moved'
      case 'resizeObject':
        await boardTools.resizeObject(
          String(input.objectId),
          Number(input.width) || 100,
          Number(input.height) || 100
        )
        return 'Resized'
      case 'updateText':
        await boardTools.updateText(String(input.objectId), String(input.newText ?? ''))
        return 'Updated text'
      case 'changeColor':
        await boardTools.changeColor(String(input.objectId), String(input.color ?? ''))
        return 'Changed color'
      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}

export type RunAIResult = { text: string; error?: string }

/**
 * Run an AI command: send user message + current board state to Claude,
 * execute any tool calls, and return the final reply (or error).
 */
export async function runAICommand(
  userMessage: string,
  currentObjects: BoardObject[]
): Promise<RunAIResult> {
  const apiKey = getApiKey()
  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are an AI assistant that helps users modify a collaborative whiteboard. You have tools to get the board state, create sticky notes and shapes (rect, circle, line), move objects, resize them, update sticky text, and change colors. All changes appear in real time for all users. When the user asks you to do something, use the tools to accomplish it. Prefer using the tools over just describing steps. Coordinates are in canvas space (x, y).`

  const boardStateJson = JSON.stringify(currentObjects, null, 2)

  const messages: { role: 'user' | 'assistant'; content: string | unknown[] }[] = [
    {
      role: 'user',
      content: `Current board state (array of objects):\n${boardStateJson}\n\nUser request: ${userMessage}`,
    },
  ]

  const maxTurns = 5
  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
      tools: TOOLS as Anthropic.Tool[],
    })

    const content = response.content
    const textParts: string[] = []
    const toolUseBlocks: { id: string; name: string; input: unknown }[] = []

    for (const block of content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      }
      if (block.type === 'tool_use') {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input,
        })
      }
    }

    if (toolUseBlocks.length === 0) {
      return { text: textParts.join('\n').trim() || 'Done.' }
    }

    messages.push({
      role: 'assistant',
      content: response.content as unknown[],
    })

    const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = toolUseBlocks.map(
      (tb) => ({
        type: 'tool_result',
        tool_use_id: tb.id,
        content: '', // we'll set below
      })
    )

    for (let i = 0; i < toolUseBlocks.length; i++) {
      const result = await executeTool(
        toolUseBlocks[i].name,
        (toolUseBlocks[i].input as Record<string, unknown>) ?? {}
      )
      toolResults[i].content = result
    }

    messages.push({
      role: 'user',
      content: toolResults,
    })
  }

  return { text: 'Reached max tool turns.', error: 'Max turns exceeded' }
}
