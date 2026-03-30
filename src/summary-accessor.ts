/**
 * Work summary extracted from OpenCode events.
 * Contains information about completed work including title, description, and file changes.
 */
export interface WorkSummary {
  /** Work title or description (from message.updated) */
  title?: string
  /** Detailed work description or body (from message.updated) */
  body?: string
  /** Array of file diffs (from both events) */
  diffs?: Array<{ file: string; changes?: string }>
  /** Number of lines added (from session.updated) */
  additions?: number
  /** Number of lines deleted (from session.updated) */
  deletions?: number
  /** Number of files changed (from session.updated) OR array of file paths (from message.updated) */
  files?: number | string[]
}

/**
 * Extracts work summary from OpenCode events.
 *
 * Handles the following event types:
 * - `message.updated`: Extracts summary from event.properties.info.summary
 * - `session.updated`: Extracts summary from event.properties.info.summary
 *
 * @param event - OpenCode event object
 * @returns WorkSummary if available, null otherwise
 *
 * @example
 * ```typescript
 * const summary = getSummaryFromEvent(event)
 * if (summary) {
 *   console.log(`Work: ${summary.title}`)
 *   console.log(`Files changed: ${summary.files?.length || 0}`)
 * }
 * ```
 */
export function getSummaryFromEvent(event: any): WorkSummary | null {
  // Handle message.updated events (has title, body, diffs)
  if (event.type === 'message.updated') {
    const info = event.properties?.info
    if (info) {
      // Try to extract from message summary
      if (info.summary) {
        return extractSummaryFromMessage(info.summary)
      }
      // Fallback: use message title/body if available
      if (info.title || info.body) {
        return {
          title: info.title,
          body: info.body
        }
      }
    }
  }

  // Handle session.updated events (has additions, deletions, files, diffs)
  if (event.type === 'session.updated') {
    const info = event.properties?.info
    if (info) {
      // Try to extract from session summary
      if (info.summary) {
        return extractSummaryFromSession(info.summary)
      }
      // Fallback: use session title if available
      if (info.title) {
        return {
          title: info.title
        }
      }
    }
  }

  return null
}

/**
 * Type guard to check if event has a summary available.
 * @param event - OpenCode event object
 * @returns true if event contains a summary
 */
export function hasSummary(event: any): event is { properties: { info: { summary: any } } } {
  return (
    event.properties?.info?.summary != null &&
    (event.type === 'message.updated' || event.type === 'session.updated')
  )
}

/**
 * Extract summary from message.updated event (has title, body, diffs).
 * @param summary - Raw summary from message.updated
 * @returns Normalized WorkSummary
 */
function extractSummaryFromMessage(summary: any): WorkSummary {
  return {
    title: summary.title,
    body: summary.body,
    diffs: summary.diffs,
    files: summary.diffs?.map((d: any) => d.file) || []
  }
}

/**
 * Extract summary from session.updated event (has additions, deletions, files, diffs).
 * @param summary - Raw summary from session.updated
 * @returns Normalized WorkSummary
 */
function extractSummaryFromSession(summary: any): WorkSummary {
  return {
    additions: summary.additions,
    deletions: summary.deletions,
    files: summary.files,
    diffs: summary.diffs
  }
}
