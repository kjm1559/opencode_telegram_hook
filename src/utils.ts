// Constants
export const POLL_INTERVAL_MS = 3000
export const THROTTLE_MS = 1000
export const MAX_TEXT_LENGTH = 500
export const MAX_ERROR_LENGTH = 200
export const MAX_OUTPUT_LENGTH = 256
export const MAX_DIR_LENGTH = 50
export const MAX_WORKTREE_LENGTH = 30
export const MAX_REQUEST_LENGTH = 200
export const MAX_DIFF_LENGTH = 256
export const MAX_MESSAGE_LENGTH = 800
export const UPDATE_TIMEOUT = 30
export const HTTP_CONFLICT = 409

// Utility functions
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Event types for tracking
export const TRACKED_EVENTS = [
  "message.created",
  "message.part.updated",
  "tool.execute.before",
  "tool.execute.after",
  "command.executed",
  "lsp.client.diagnostics",
  "session.started",
  "session.status",
  "session.diff",
  "session.updated",
  "session.completed",
  "session.finished",
] as const
