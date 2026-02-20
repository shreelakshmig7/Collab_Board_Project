import { describe, it, expect } from 'vitest'
import {
  validateBoardName,
  sanitizeBoardName,
  validateInviteEmail,
  sanitizeInviteEmail,
  validateAIPrompt,
  sanitizeAIPrompt,
  validateObjectText,
  sanitizeObjectText,
  clampDimension,
  validateDimensions,
  MAX_BOARD_NAME_LENGTH,
  MAX_AI_PROMPT_LENGTH,
  MAX_OBJECT_TEXT_LENGTH,
} from './inputValidation'

describe('inputValidation', () => {
  describe('validateBoardName', () => {
    it('rejects empty or whitespace', () => {
      expect(validateBoardName('').valid).toBe(false)
      expect(validateBoardName('   ').valid).toBe(false)
    })
    it('rejects name shorter than min length', () => {
      expect(validateBoardName('A').valid).toBe(false)
      expect(validateBoardName('x').valid).toBe(false)
    })
    it('accepts name at min length', () => {
      expect(validateBoardName('ab').valid).toBe(true)
      expect(validateBoardName('  xy  ').valid).toBe(true)
    })
    it('accepts non-empty trimmed name', () => {
      expect(validateBoardName('My Board').valid).toBe(true)
      expect(validateBoardName('  My Board  ').valid).toBe(true)
    })
    it('rejects name over max length', () => {
      expect(validateBoardName('a'.repeat(MAX_BOARD_NAME_LENGTH + 1)).valid).toBe(false)
    })
    it('accepts name at max length', () => {
      expect(validateBoardName('a'.repeat(MAX_BOARD_NAME_LENGTH)).valid).toBe(true)
    })
    it('rejects name with only symbols or spaces', () => {
      expect(validateBoardName('!!!').valid).toBe(false)
      expect(validateBoardName('---').valid).toBe(false)
      expect(validateBoardName('   ...   ').valid).toBe(false)
    })
    it('accepts name with at least one letter or number', () => {
      expect(validateBoardName('My Board').valid).toBe(true)
      expect(validateBoardName('123').valid).toBe(true)
      expect(validateBoardName('Board!').valid).toBe(true)
    })
  })

  describe('sanitizeBoardName', () => {
    it('trims and truncates', () => {
      expect(sanitizeBoardName('  abc  ')).toBe('abc')
      expect(sanitizeBoardName('a'.repeat(150)).length).toBe(MAX_BOARD_NAME_LENGTH)
    })
  })

  describe('validateInviteEmail', () => {
    it('rejects empty', () => {
      expect(validateInviteEmail('').valid).toBe(false)
      expect(validateInviteEmail('   ').valid).toBe(false)
    })
    it('rejects email shorter than min length', () => {
      expect(validateInviteEmail('a@b.c').valid).toBe(false)
      expect(validateInviteEmail('a@b').valid).toBe(false)
    })
    it('accepts valid email at or above min length', () => {
      expect(validateInviteEmail('a@b.co').valid).toBe(true)
    })
    it('accepts valid email', () => {
      expect(validateInviteEmail('a@b.co').valid).toBe(true)
      expect(validateInviteEmail('  user@example.com  ').valid).toBe(true)
    })
    it('rejects invalid format', () => {
      expect(validateInviteEmail('notanemail').valid).toBe(false)
      expect(validateInviteEmail('@nodomain.com').valid).toBe(false)
      expect(validateInviteEmail('noatsign.com').valid).toBe(false)
    })
    it('rejects over max length', () => {
      expect(validateInviteEmail('a'.repeat(260) + '@b.co').valid).toBe(false)
    })
  })

  describe('sanitizeInviteEmail', () => {
    it('trims, lowercases, truncates', () => {
      expect(sanitizeInviteEmail('  User@Example.COM  ')).toBe('user@example.com')
    })
  })

  describe('validateAIPrompt', () => {
    it('rejects empty', () => {
      expect(validateAIPrompt('').valid).toBe(false)
      expect(validateAIPrompt('   ').valid).toBe(false)
    })
    it('accepts at min length (1 character)', () => {
      expect(validateAIPrompt('x').valid).toBe(true)
    })
    it('accepts non-empty', () => {
      expect(validateAIPrompt('Add a sticky').valid).toBe(true)
    })
    it('rejects over max length', () => {
      expect(validateAIPrompt('a'.repeat(MAX_AI_PROMPT_LENGTH + 1)).valid).toBe(false)
    })
  })

  describe('sanitizeAIPrompt', () => {
    it('trims and truncates', () => {
      expect(sanitizeAIPrompt('  hello  ')).toBe('hello')
      expect(sanitizeAIPrompt('a'.repeat(5000)).length).toBe(MAX_AI_PROMPT_LENGTH)
    })
  })

  describe('validateObjectText', () => {
    it('accepts short text', () => {
      expect(validateObjectText('hello').valid).toBe(true)
      expect(validateObjectText('').valid).toBe(true)
    })
    it('rejects over max length', () => {
      expect(validateObjectText('a'.repeat(MAX_OBJECT_TEXT_LENGTH + 1)).valid).toBe(false)
    })
  })

  describe('sanitizeObjectText', () => {
    it('truncates and trims', () => {
      expect(sanitizeObjectText('a'.repeat(15000)).length).toBe(MAX_OBJECT_TEXT_LENGTH)
    })
  })

  describe('clampDimension', () => {
    it('clamps to 20–800', () => {
      expect(clampDimension(10)).toBe(20)
      expect(clampDimension(1000)).toBe(800)
      expect(clampDimension(100)).toBe(100)
    })
    it('rounds and handles non-finite', () => {
      expect(clampDimension(50.7)).toBe(51)
      expect(clampDimension(NaN)).toBe(20)
    })
  })

  describe('validateDimensions', () => {
    it('accepts valid range', () => {
      expect(validateDimensions(100, 100).valid).toBe(true)
    })
    it('rejects out of range or non-finite', () => {
      expect(validateDimensions(10, 100).valid).toBe(false)
      expect(validateDimensions(100, 900).valid).toBe(false)
      expect(validateDimensions(NaN, 100).valid).toBe(false)
    })
  })
})
