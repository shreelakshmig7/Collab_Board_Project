export type AiCommandMode = 'simple' | 'complex'

export type AiCommandPolicy = {
  mode: AiCommandMode
  maxTurns: number
  maxTokens: number
  allowGetBoardState: boolean
  forcedToolName?: string
}

const CREATION_RE = /\b(add|create|new|put|place|draw|make)\b/i
const COMPLEX_RE = /\b(arrange|grid|swot|journey|retro|template)\b/i
const MULTI_STEP_RE = /\b(and|then|also)\b/i

const STICKY_RE = /\b(sticky|sticky-note|post-it)\b/i
const FRAME_RE = /\bframe\b/i
const TEXT_RE = /\btext\b/i
const SHAPE_RE = /\b(rect|rectangle|square|circle|line)\b/i

/**
 * Heuristic policy for the Edge Function.
 * Goal: keep "simple" commands single-turn and avoid tool loops.
 */
export const getAiCommandPolicy = (userMessage: string): AiCommandPolicy => {
  const msg = userMessage.trim()
  const msgLc = msg.toLowerCase()

  const looksComplex =
    COMPLEX_RE.test(msg) ||
    MULTI_STEP_RE.test(msg) ||
    // Common multi-action patterns that imply multiple tool calls
    /\b(connect|connector|arrow)\b/i.test(msg)

  if (looksComplex) {
    return {
      mode: 'complex',
      maxTurns: 8,
      maxTokens: 2048,
      allowGetBoardState: true,
    }
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

    return {
      mode: 'simple',
      maxTurns: 1,
      maxTokens: 512,
      allowGetBoardState: false,
      forcedToolName,
    }
  }

  // Non-template transforms/ops (move/delete/resize/rotate/etc.) should also be single-turn.
  // They should be resolvable from the provided board state (client sends it for relevant commands).
  const isOp =
    /\b(move|drag|delete|remove|resize|rotate|change|update)\b/i.test(msgLc) ||
    /\bcolor\b/i.test(msgLc)

  if (isOp) {
    return {
      mode: 'simple',
      maxTurns: 1,
      maxTokens: 512,
      allowGetBoardState: false,
    }
  }

  // Default to complex (safer).
  return {
    mode: 'complex',
    maxTurns: 8,
    maxTokens: 2048,
    allowGetBoardState: true,
  }
}

