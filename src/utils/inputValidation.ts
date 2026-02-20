/** Shared validation and sanitization for app inputs (board names, invite email, AI prompt, object text, dimensions). */

export const MIN_BOARD_NAME_LENGTH = 2
export const MAX_BOARD_NAME_LENGTH = 100
export const MIN_INVITE_EMAIL_LENGTH = 6
export const MAX_INVITE_EMAIL_LENGTH = 255
export const MIN_AI_PROMPT_LENGTH = 1
export const MAX_AI_PROMPT_LENGTH = 4000
export const MIN_OBJECT_TEXT_LENGTH = 0
export const MAX_OBJECT_TEXT_LENGTH = 10000
const DIMENSION_MIN = 20
const DIMENSION_MAX = 800

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ValidationResult = { valid: true } | { valid: false; error: string }

/** At least one letter or digit (so names that are only symbols/spaces are rejected). */
const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u

export function validateBoardName(value: string): ValidationResult {
  const s = value.trim()
  if (!s) return { valid: false, error: 'Board name is required' }
  if (s.length < MIN_BOARD_NAME_LENGTH)
    return { valid: false, error: `Board name must be at least ${MIN_BOARD_NAME_LENGTH} characters` }
  if (s.length > MAX_BOARD_NAME_LENGTH)
    return { valid: false, error: `Board name must be ${MAX_BOARD_NAME_LENGTH} characters or less` }
  if (!HAS_ALPHANUMERIC.test(s))
    return { valid: false, error: 'Board name must contain at least one letter or number' }
  return { valid: true }
}

export function sanitizeBoardName(value: string): string {
  return value.trim().slice(0, MAX_BOARD_NAME_LENGTH)
}

export function validateInviteEmail(value: string): ValidationResult {
  const s = value.trim().toLowerCase()
  if (!s) return { valid: false, error: 'Email is required' }
  if (s.length < MIN_INVITE_EMAIL_LENGTH)
    return { valid: false, error: `Email must be at least ${MIN_INVITE_EMAIL_LENGTH} characters` }
  if (s.length > MAX_INVITE_EMAIL_LENGTH)
    return { valid: false, error: `Email must be ${MAX_INVITE_EMAIL_LENGTH} characters or less` }
  if (!EMAIL_RE.test(s)) return { valid: false, error: 'Enter a valid email address' }
  return { valid: true }
}

export function sanitizeInviteEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, MAX_INVITE_EMAIL_LENGTH)
}

export function validateAIPrompt(value: string): ValidationResult {
  const s = value.trim()
  if (!s) return { valid: false, error: 'Enter a message' }
  if (s.length < MIN_AI_PROMPT_LENGTH)
    return { valid: false, error: `Message must be at least ${MIN_AI_PROMPT_LENGTH} character` + (MIN_AI_PROMPT_LENGTH === 1 ? '' : 's') }
  if (s.length > MAX_AI_PROMPT_LENGTH)
    return { valid: false, error: `Message must be ${MAX_AI_PROMPT_LENGTH} characters or less` }
  return { valid: true }
}


export function sanitizeAIPrompt(value: string): string {
  return value.trim().slice(0, MAX_AI_PROMPT_LENGTH)
}

export function validateObjectText(value: string): ValidationResult {
  if (value.length > MAX_OBJECT_TEXT_LENGTH)
    return { valid: false, error: `Text must be ${MAX_OBJECT_TEXT_LENGTH} characters or less` }
  return { valid: true }
}

export function sanitizeObjectText(value: string): string {
  return value.slice(0, MAX_OBJECT_TEXT_LENGTH).trim()
}

export function clampDimension(n: number): number {
  const num = Number(n)
  if (!Number.isFinite(num)) return DIMENSION_MIN
  return Math.min(DIMENSION_MAX, Math.max(DIMENSION_MIN, Math.round(num)))
}

export function validateDimensions(width: number, height: number): ValidationResult {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h))
    return { valid: false, error: 'Width and height must be numbers' }
  if (w < DIMENSION_MIN || w > DIMENSION_MAX || h < DIMENSION_MIN || h > DIMENSION_MAX)
    return { valid: false, error: `Width and height must be between ${DIMENSION_MIN} and ${DIMENSION_MAX}` }
  return { valid: true }
}
