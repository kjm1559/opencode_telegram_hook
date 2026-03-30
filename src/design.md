# Telegram Plugin: TypeScript Interfaces & Message Templates

## Overview

Design document for the OpenCode Telegram plugin's summary extraction and message formatting.

---

## 1. TypeScript Interfaces

### 1.1 WorkSummary

Represents the summary data extracted from OpenCode events (`message.updated`, `session.updated`).

```typescript
export interface DiffInfo {
  /** File path that was modified */
  file: string;
  /** Number of lines added */
  additions?: number;
  /** Number of lines removed */
  deletions?: number;
  /** Optional: brief description of changes */
  description?: string;
}

export interface WorkSummary {
  /** Summary title (e.g., "Add user authentication") */
  title?: string;
  
  /** Detailed summary body describing what was done */
  body?: string;
  
  /** Array of file changes */
  diffs?: DiffInfo[];
  
  /** Total lines added across all files */
  additions?: number;
  
  /** Total lines removed across all files */
  deletions?: number;
  
  /** Number of files modified */
  files?: number;
  
  /** Optional: agent name that performed the work */
  agent?: string;
  
  /** Optional: timestamp of completion */
  timestamp?: string;
}
```

### 1.2 TelegramMessage

Represents a formatted message ready to send to Telegram.

```typescript
export interface TelegramMessage {
  /** Message title (bold header) */
  title: string;
  
  /** Message body (can include HTML formatting) */
  body: string;
  
  /** Optional footer (e.g., project name, timestamp) */
  footer?: string;
  
  /** Optional: parse mode for Telegram (default: "HTML") */
  parseMode?: "HTML" | "MarkdownV2";
  
  /** Optional: inline keyboard for interactive messages */
  replyMarkup?: string;
}
```

### 1.3 MessageContext

Context information for message formatting.

```typescript
export interface MessageContext {
  /** Project name from config */
  projectName: string;
  
  /** Message type: "completion" or "choice_required" */
  messageType: "completion" | "choice_required";
  
  /** Optional: additional context for choice messages */
  choiceContext?: {
    /** What choice is needed */
    question: string;
    /** Available options */
    options: string[];
  };
}
```

---

## 2. Message Templates

### 2.1 Work Completion Template

Sent when a task completes successfully.

```typescript
/**
 * Formats a work completion message
 * 
 * @param summary - WorkSummary from OpenCode event
 * @param context - MessageContext with project info
 * @returns Formatted Telegram message
 */
function formatCompletionMessage(
  summary: WorkSummary,
  context: MessageContext
): TelegramMessage {
  const { projectName } = context;
  
  // Build title
  const title = `<b>[${projectName}] ✅ 작업 완료</b>`;
  
  // Build body with summary details
  const bodyParts: string[] = [];
  
  // Title
  if (summary.title) {
    bodyParts.push(`<b>제목:</b> ${escapeHtml(summary.title)}`);
  }
  
  // Body
  if (summary.body) {
    bodyParts.push(`<i>${escapeHtml(summary.body)}</i>`);
  }
  
  // File changes
  if (summary.diffs && summary.diffs.length > 0) {
    const fileList = summary.diffs
      .map(diff => {
        const changes = [];
        if (diff.additions) changes.push(`<span style="color: #4CAF50">+${diff.additions}</span>`);
        if (diff.deletions) changes.push(`<span style="color: #f44336">-${diff.deletions}</span>`);
        const changeInfo = changes.length > 0 ? ` (${changes.join(', ')})` : '';
        return `• <code>${escapeHtml(diff.file)}</code>${changeInfo}`;
      })
      .join('<br>');
    bodyParts.push(`<b>📝 변경 사항:</b><br>${fileList}`);
  }
  
  // Stats
  if (summary.additions || summary.deletions || summary.files) {
    const stats = [];
    if (summary.files) stats.push(`${summary.files} 파일`);
    if (summary.additions) stats.push(`<span style="color: #4CAF50">+${summary.additions}</span>`);
    if (summary.deletions) stats.push(`<span style="color: #f44336">-${summary.deletions}</span>`);
    bodyParts.push(`<b>📊 통계:</b> ${stats.join(', ')}`);
  }
  
  // Agent info
  if (summary.agent) {
    bodyParts.push(`<b>🤖 Agent:</b> ${escapeHtml(summary.agent)}`);
  }
  
  const body = bodyParts.length > 0 
    ? bodyParts.join('<br><br>') + '<br><br>✅ <i>작업이 완료되었습니다.</i>'
    : '✅ <i>작업이 완료되었습니다.</i>';
  
  // Footer
  const footer = summary.timestamp 
    ? `<small>${new Date(summary.timestamp).toLocaleString('ko-KR')}</small>`
    : '';
  
  return {
    title,
    body,
    footer: footer || undefined,
    parseMode: 'HTML'
  };
}
```

**Example Output:**

```
[opencode_telegram_hook] ✅ 작업 완료

제목: Add user authentication feature

Implemented JWT-based authentication with login/logout endpoints

📝 변경 사항:
• src/auth/jwt.ts (+45)
• src/routes/auth.ts (+32)
• src/types/auth.ts (+18)

📊 통계: 3 파일, +95

🤖 Agent: Sisyphus-Junior

✅ 작업이 완료되었습니다.

2026-03-30 14:30:00
```

---

### 2.2 Choice Required Template

Sent when user input is needed to proceed.

```typescript
/**
 * Formats a choice required message
 * 
 * @param summary - WorkSummary from OpenCode event
 * @param context - MessageContext with choice details
 * @returns Formatted Telegram message with inline keyboard
 */
function formatChoiceMessage(
  summary: WorkSummary,
  context: MessageContext
): TelegramMessage {
  const { projectName, choiceContext } = context;
  
  // Build title
  const title = `<b>[${projectName}] ❓ 선택 필요</b>`;
  
  // Build body
  const bodyParts: string[] = [];
  
  // Summary title
  if (summary.title) {
    bodyParts.push(`<b>제목:</b> ${escapeHtml(summary.title)}`);
  }
  
  // Summary body
  if (summary.body) {
    bodyParts.push(`<i>${escapeHtml(summary.body)}</i>`);
  }
  
  // Choice question
  if (choiceContext?.question) {
    bodyParts.push(`<b>❓ 질문:</b><br>${escapeHtml(choiceContext.question)}`);
  }
  
  // Options
  if (choiceContext?.options && choiceContext.options.length > 0) {
    const optionsList = choiceContext.options
      .map((opt, idx) => `<b>${String.fromCharCode(65 + idx)}.</b> ${escapeHtml(opt)}`)
      .join('<br>');
    bodyParts.push(`<b>📋 옵션:</b><br>${optionsList}`);
  }
  
  const body = bodyParts.join('<br><br>');
  
  // Build inline keyboard (JSON string for Telegram API)
  let replyMarkup: string | undefined;
  if (choiceContext?.options && choiceContext.options.length > 0) {
    const keyboard = choiceContext.options.slice(0, 4).map(option => [
      { callback_data: `choice_${option.replace(/\s+/g, '_').toLowerCase()}`, text: option }
    ]);
    replyMarkup = JSON.stringify({ inline_keyboard: keyboard });
  }
  
  return {
    title,
    body,
    replyMarkup: replyMarkup || undefined,
    parseMode: 'HTML'
  };
}
```

**Example Output:**

```
[opencode_telegram_hook] ❓ 선택 필요

제목: Database migration approach

Multiple migration strategies available for the user table

❓ 질문:
Which migration approach should be used?

📋 옵션:
A. Create new columns with backfill
B. Drop and recreate table
C. Use view-based migration
D. Skip migration for now

[Option A] [Option B]
[Option C] [Option D]
```

---

## 3. Fallback Messages

### 3.1 No Summary Available

When `event.properties.info.summary` is missing or empty:

```typescript
function formatFallbackMessage(
  context: MessageContext
): TelegramMessage {
  const { projectName, messageType } = context;
  
  if (messageType === 'completion') {
    return {
      title: `<b>[${projectName}] ✅ 작업 완료</b>`,
      body: `<i>요약 정보가 사용 불가능합니다.</i><br><br>✅ 작업이 완료되었습니다.`,
      parseMode: 'HTML'
    };
  } else {
    return {
      title: `<b>[${projectName}] ❓ 선택 필요</b>`,
      body: `<i>요약 정보가 사용 불가능합니다.</i><br><br>추가 정보가 필요합니다.`,
      parseMode: 'HTML'
    };
  }
}
```

### 3.2 Partial Summary

When only some summary fields are available:

```typescript
function formatPartialSummary(
  summary: WorkSummary,
  context: MessageContext
): TelegramMessage {
  const { projectName } = context;
  
  const availableFields = [];
  if (summary.title) availableFields.push('제목');
  if (summary.body) availableFields.push('본문');
  if (summary.diffs?.length) availableFields.push('변경 사항');
  
  const fallbackNote = availableFields.length > 0
    ? `<small>일부 정보만 사용 가능합니다: ${availableFields.join(', ')}</small>`
    : '';
  
  // Reuse formatCompletionMessage or formatChoiceMessage
  // They already handle optional fields gracefully
  const message = context.messageType === 'completion'
    ? formatCompletionMessage(summary, context)
    : formatChoiceMessage(summary, context);
  
  if (fallbackNote) {
    message.footer = `${message.footer || ''} ${fallbackNote}`;
  }
  
  return message;
}
```

---

## 4. Utility Functions

### 4.1 HTML Escape

Telegram requires proper HTML escaping:

```typescript
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"]/g, char => htmlEscapes[char]);
}
```

### 4.2 Truncate Long Text

Telegram has a 4096 character limit:

```typescript
function truncateText(text: string, maxLength: number = 4000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
```

---

## 5. Usage Example

```typescript
// Extract summary from OpenCode event
const summary: WorkSummary = event.properties.info.summary;

// Create message context
const context: MessageContext = {
  projectName: config.projects[0].name,
  messageType: 'completion'
};

// Format message
const message = summary.title || summary.body
  ? formatCompletionMessage(summary, context)
  : formatFallbackMessage(context);

// Send to Telegram
await sendTelegramMessage({
  chat_id: config.telegramChatId,
  text: message.title + '\n\n' + message.body + (message.footer ? '\n\n' + message.footer : ''),
  parse_mode: message.parseMode,
  reply_markup: message.replyMarkup
});
```

---

## 6. Telegram HTML Reference

Supported HTML tags in Telegram:

| Tag | Description | Example |
|-----|-------------|---------|
| `<b>` | Bold | `<b>bold text</b>` |
| `<i>` | Italic | `<i>italic text</i>` |
| `<u>` | Underlined | `<u>underlined text</u>` |
| `<s>` | Strikethrough | `<s>strikethrough</s>` |
| `<code>` | Inline code | `<code>code()</code>` |
| `<pre>` | Pre-formatted code | `<pre>code block</pre>` |
| `<a>` | Hyperlink | `<a href="url">link</a>` |
| `<>` | Monospace | `<>monospace</>` |

**Note:** Color styling via `<span style="color: #...">` is supported in some clients but not guaranteed.

---

## 7. Event Structure Reference

OpenCode event summary location:

```typescript
// Correct access pattern
event.properties.info.summary = {
  title: string | undefined,
  body: string | undefined,
  diffs: Array<{
    file: string,
    additions?: number,
    deletions?: number,
    description?: string
  }> | undefined,
  additions: number | undefined,
  deletions: number | undefined,
  files: number | undefined,
  agent: string | undefined,
  timestamp: string | undefined
};
```

---

*Design document version: 1.0*
*Created: 2026-03-30*
