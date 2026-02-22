export type AiModelTier = 'fast' | 'smart'

export type AiPolicy = {
  modelTier: AiModelTier
  maxTurns: number
  maxTokens: number
  allowGetBoardState: boolean
  forcedToolName?: string
  returnAfterToolExecution: boolean
}

const CREATION_RE = /\b(add|create|new|put|place|draw|make)\b/i
const CONNECTOR_RE = /\b(connect|connector|arrow)\b/i
const MULTI_STEP_RE = /\b(and|then|also)\b/i
const ARRANGE_RE = /\b(arrange|space|align|distribute)\b/i

// Compound tool classifiers — checked before generic complex
const CLEAR_RE = /\b(clear|wipe|reset|start\s+fresh|delete\s+all|remove\s+all|erase\s+all)\b/i
const QUADRANT_RE = /\b(swot|quadrant|2x2|four[\s-]quadrant|matrix\s+diagram)\b/i
const COLUMN_RE = /\b(retro|retrospective|kanban|user[\s-]journey|journey[\s-]map|column[\s-]layout)\b/i

// Bulk creation classifiers — sync with src/ai/aiCommandPolicy.ts
const BULK_QUANTITY_RE = /\b([3-9]|\d{2,}|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozen|several|many|multiple|bunch)\b/i
const BULK_OBJECT_TYPE_RE = /\b(sticky|stickies|note|notes|rect|rectangles?|squares?|circles?|shape|shapes|frame|frames|text)\b/i

const STICKY_RE = /\b(sticky|sticky-note|post-it)\b/i
const FRAME_RE = /\bframe\b/i
const TEXT_RE = /\btext\b/i
const SHAPE_RE = /\b(rect|rectangle|square|circle|line)\b/i

export const getPolicyForMessage = (userMessage: string): AiPolicy => {
  const msg = userMessage.trim()
  const msgLc = msg.toLowerCase()

  // Compound: clear board — server fetches all IDs and deletes, no LLM round-trips
  if (CLEAR_RE.test(msg)) {
    return {
      modelTier: 'smart',
      maxTurns: 1,
      maxTokens: 512,
      allowGetBoardState: false,
      forcedToolName: 'clearBoard',
      returnAfterToolExecution: true,
    }
  }

  // Compound: quadrant / SWOT — server builds full 2×2 layout in one tool call
  if (QUADRANT_RE.test(msg)) {
    return {
      modelTier: 'smart',
      maxTurns: 1,
      maxTokens: 1024,
      allowGetBoardState: false,
      forcedToolName: 'createQuadrant',
      returnAfterToolExecution: true,
    }
  }

  // Compound: column layout — retro, kanban, journey map
  if (COLUMN_RE.test(msg)) {
    return {
      modelTier: 'smart',
      maxTurns: 1,
      maxTokens: 1024,
      allowGetBoardState: false,
      forcedToolName: 'createColumnLayout',
      returnAfterToolExecution: true,
    }
  }

  // Bulk creation: 3+ objects of the same type — server batch-inserts all in one call.
  // Checked before simple creation so "create 50 stickies" never hits the singular forced-tool path.
  const isBulk = CREATION_RE.test(msg) && BULK_QUANTITY_RE.test(msg) && BULK_OBJECT_TYPE_RE.test(msg)
  if (isBulk) {
    return {
      modelTier: 'fast',
      maxTurns: 1,
      maxTokens: 1024,
      allowGetBoardState: false,
      forcedToolName: 'createBulkObjects',
      returnAfterToolExecution: true,
    }
  }

  // Generic complex: arrange, connectors, multi-step, vague templates
  const looksComplex =
    ARRANGE_RE.test(msg) ||
    CONNECTOR_RE.test(msg) ||
    MULTI_STEP_RE.test(msg) ||
    /\btemplate\b/i.test(msg) ||
    /\bgrid\b/i.test(msg)

  if (looksComplex) {
    return {
      modelTier: 'smart',
      maxTurns: 8,
      maxTokens: 2048,
      allowGetBoardState: true,
      returnAfterToolExecution: false,
    }
  }

  // Simple creation — Haiku, 1 turn, forced tool, no board state needed
  const isCreation = CREATION_RE.test(msg)
  if (isCreation) {
    const forcedToolName =
      STICKY_RE.test(msg)
        ? 'createStickyNote'
        : FRAME_RE.test(msg)
          ? 'createFrame'
          : TEXT_RE.test(msg)
            ? 'createText'
            : SHAPE_RE.test(msg)
              ? 'createShape'
              : undefined

    return {
      modelTier: 'fast',
      maxTurns: 1,
      maxTokens: 512,
      allowGetBoardState: false,
      forcedToolName,
      returnAfterToolExecution: true,
    }
  }

  // Ops: move, resize, change color, delete specific, rotate, update text
  // Need board state to identify object IDs — route to Sonnet with getBoardState
  const isOp =
    /\b(move|drag|delete|remove|resize|rotate|change|update|rename)\b/i.test(msgLc) ||
    /\bcolor\b/i.test(msgLc)

  if (isOp) {
    return {
      modelTier: 'smart',
      maxTurns: 3,
      maxTokens: 1024,
      allowGetBoardState: true,
      returnAfterToolExecution: false,
    }
  }

  // Default: smart with board state
  return {
    modelTier: 'smart',
    maxTurns: 8,
    maxTokens: 2048,
    allowGetBoardState: true,
    returnAfterToolExecution: false,
  }
}
