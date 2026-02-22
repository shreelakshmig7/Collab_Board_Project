export type AiCommandMode = 'simple' | 'compound' | 'complex'

export type AiCommandPolicy = {
  mode: AiCommandMode
  maxTurns: number
  maxTokens: number
  allowGetBoardState: boolean
  forcedToolName?: string
}

const CREATION_RE = /\b(add|create|new|put|place|draw|make)\b/i
const CONNECTOR_RE = /\b(connect|connector|arrow)\b/i
const MULTI_STEP_RE = /\b(and|then|also)\b/i
const ARRANGE_RE = /\b(arrange|space|align|distribute)\b/i

const CLEAR_RE = /\b(clear|wipe|reset|start\s+fresh|delete\s+all|remove\s+all|erase\s+all)\b/i
const QUADRANT_RE = /\b(swot|quadrant|2x2|four[\s-]quadrant|matrix\s+diagram)\b/i
const COLUMN_RE = /\b(retro|retrospective|kanban|user[\s-]journey|journey[\s-]map|column[\s-]layout)\b/i

// Bulk creation classifiers — sync with supabase/functions/ai-command/policy.ts
const BULK_QUANTITY_RE = /\b([3-9]|\d{2,}|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozen|several|many|multiple|bunch)\b/i
const BULK_OBJECT_TYPE_RE = /\b(sticky|stickies|note|notes|rect|rectangles?|squares?|circles?|shape|shapes|frame|frames|text)\b/i

const STICKY_RE = /\b(sticky|sticky-note|post-it)\b/i
const FRAME_RE = /\bframe\b/i
const TEXT_RE = /\btext\b/i
const SHAPE_RE = /\b(rect|rectangle|square|circle|line)\b/i

/**
 * Client-side policy mirror — kept in sync with the edge function policy.ts.
 * Used for UI decisions (e.g. which board state to send) before the request.
 */
export const getAiCommandPolicy = (userMessage: string): AiCommandPolicy => {
  const msg = userMessage.trim()
  const msgLc = msg.toLowerCase()

  if (CLEAR_RE.test(msg)) {
    return { mode: 'compound', maxTurns: 1, maxTokens: 512, allowGetBoardState: false, forcedToolName: 'clearBoard' }
  }

  if (QUADRANT_RE.test(msg)) {
    return { mode: 'compound', maxTurns: 1, maxTokens: 1024, allowGetBoardState: false, forcedToolName: 'createQuadrant' }
  }

  if (COLUMN_RE.test(msg)) {
    return { mode: 'compound', maxTurns: 1, maxTokens: 1024, allowGetBoardState: false, forcedToolName: 'createColumnLayout' }
  }

  // Bulk creation: 3+ objects of the same type — server batch-inserts all in one call.
  const isBulk = CREATION_RE.test(msg) && BULK_QUANTITY_RE.test(msg) && BULK_OBJECT_TYPE_RE.test(msg)
  if (isBulk) {
    return { mode: 'compound', maxTurns: 1, maxTokens: 1024, allowGetBoardState: false, forcedToolName: 'createBulkObjects' }
  }

  const looksComplex =
    ARRANGE_RE.test(msg) ||
    CONNECTOR_RE.test(msg) ||
    MULTI_STEP_RE.test(msg) ||
    /\btemplate\b/i.test(msg) ||
    /\bgrid\b/i.test(msg)

  if (looksComplex) {
    return { mode: 'complex', maxTurns: 8, maxTokens: 2048, allowGetBoardState: true }
  }

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

    return { mode: 'simple', maxTurns: 1, maxTokens: 512, allowGetBoardState: false, forcedToolName }
  }

  const isOp =
    /\b(move|drag|delete|remove|resize|rotate|change|update|rename)\b/i.test(msgLc) ||
    /\bcolor\b/i.test(msgLc)

  if (isOp) {
    return { mode: 'complex', maxTurns: 3, maxTokens: 1024, allowGetBoardState: true }
  }

  return { mode: 'complex', maxTurns: 8, maxTokens: 2048, allowGetBoardState: true }
}
