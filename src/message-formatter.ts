/**
 * Message formatter utilities for Telegram notifications.
 * Formats work summaries into Telegram-ready HTML messages.
 */

import { WorkSummary } from './summary-accessor'

const TELEGRAM_MAX_LENGTH = 4000

export function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return text.slice(0, limit) + '\n\n...(잘림)'
}

export function formatCompletionMessage(summary: WorkSummary, projectName: string): string {
  const escapedProjectName = escapeHtml(projectName)
  const escapedBody = truncate(escapeHtml(summary.body || ''), TELEGRAM_MAX_LENGTH - 80)

  const bodySection = escapedBody ? `\n${escapedBody}\n` : ''

  return `<b>[${escapedProjectName}] 작업 완료</b>

${bodySection}
✅ 작업이 완료되었습니다.`
}

export function formatChoiceMessage(summary: WorkSummary, projectName: string): string {
  const escapedProjectName = escapeHtml(projectName)
  const escapedBody = truncate(escapeHtml(summary.body || ''), TELEGRAM_MAX_LENGTH - 80)

  const bodySection = escapedBody ? `\n${escapedBody}\n` : ''

  return `<b>[${escapedProjectName}] 선택 필요</b>

${bodySection}
⚠️ 작업을 계속하기 위해 선택이 필요합니다.`
}
