export const MVP_BOARD_ID = 'mvp-board-1'

/** How often (ms) we refresh last_seen_at for the current user. */
export const HEARTBEAT_MS = 25_000

/**
 * Grace window (ms) for considering a user "online".
 * Any presence row older than this is treated as stale/offline.
 * Must be > HEARTBEAT_MS to avoid false negatives during normal use.
 */
export const PRESENCE_TIMEOUT_MS = HEARTBEAT_MS * 3

export const DEFAULT_STICKY_COLOR = '#FEF08A'
export const DEFAULT_SHAPE_COLOR = '#93C5FD'
export const DEFAULT_FRAME_COLOR = '#6366f1'
export const DEFAULT_TEXT_COLOR = '#1a1a1a'
export const DEFAULT_CONNECTOR_COLOR = '#6b7280'

export const STICKY_WIDTH = 180
export const STICKY_HEIGHT = 120
export const CIRCLE_DIAMETER = 80
export const LINE_DEFAULT_WIDTH = 120
export const LINE_DEFAULT_HEIGHT = 60
export const FRAME_DEFAULT_WIDTH = 400
export const FRAME_DEFAULT_HEIGHT = 300
export const TEXT_DEFAULT_FONT_SIZE = 18

/** Minimum width/height for resizable objects to prevent invisible/crashed renders. */
export const MIN_OBJECT_SIZE = 8
