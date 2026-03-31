/**
 * Message formatter utilities for Telegram notifications.
 * Formats work summaries into Telegram-ready HTML messages.
 */

import { WorkSummary } from './summary-accessor'

/**
 * Escapes HTML special characters for safe HTML rendering.
 * @param text - Text to escape
 * @returns Escaped text safe for HTML
 */
export function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Formats a work completion summary into a Telegram HTML message.
 * @param summary - Work summary to format
 * @param projectName - Name of the project
 * @returns HTML-formatted message for Telegram
 */
export function formatCompletionMessage(summary: WorkSummary, projectName: string): string {
  const escapedProjectName = escapeHtml(projectName)
  const escapedBody = escapeHtml(summary.body || '')

  const bodySection = escapedBody ? `\n${escapedBody}\n` : ''

  return `<b>[${escapedProjectName}] 작업 완료</b>

${bodySection}
✅ 작업이 완료되었습니다.`
}

/**
 * Formats a choice required summary into a Telegram HTML message.
 * @param summary - Work summary to format
 * @param projectName - Name of the project
 * @returns HTML-formatted message for Telegram
 */
export function formatChoiceMessage(summary: WorkSummary, projectName: string): string {
  const escapedProjectName = escapeHtml(projectName)
  const escapedBody = escapeHtml(summary.body || '')

  const bodySection = escapedBody ? `\n${escapedBody}\n` : ''

  return `<b>[${escapedProjectName}] 선택 필요</b>

${bodySection}
⚠️ 작업을 계속하기 위해 선택이 필요합니다.`
}
