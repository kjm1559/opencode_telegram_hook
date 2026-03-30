# OpenCode Telegram Plugin

A plugin that sends notifications with work summaries to Telegram when OpenCode work is completed or when a choice is required.

## Features

### Work Completion Notification (with Summary)

When work is completed, the plugin sends a detailed summary:

```
[project-name] 작업 완료

제목: 작업 제목

작업 내용 요약

📝 변경 사항:
• file1.ts
• file2.ts

✅ 작업이 완료되었습니다.
```

**Summary includes:**
- Work title and description
- File changes (added/modified/deleted)
- Code statistics (additions/deletions)
- Affected files list

### Choice Required Notification (with Summary)

When user choice is needed:

```
[project-name] 선택 필요

제목: 작업 제목

작업 내용 요약

⚠️ 작업을 계속하기 위해 선택이 필요합니다.
```

## Installation

### Configuration

```bash
# Set environment variables
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

### Register with OpenCode

```json
{
  "plugin": [
    "file:///path/to/opencode_telegram_hook/dist/index.js"
  ]
}
```

### Build

```bash
cd opencode_telegram_hook
bun install
bun run build
```

## Usage

1. Set environment variables
2. Build the plugin
3. Register the plugin in OpenCode
4. Start working

Notifications will be sent to Telegram when work is completed or when a choice is required.

## Architecture

- Each instance works independently
- Event-driven (no polling)
- Direct Telegram API calls
- No locks, no state management
- Summary generation via OpenCode's built-in summary agent

### Components

- **summary-accessor.ts**: Extracts summaries from OpenCode events
- **message-formatter.ts**: Formats summaries into Telegram messages
- **index.ts**: Main plugin with event handlers

## Events

### session.status (status.type === "idle")
Sends notification when work is completed

**Note**: OpenCode does NOT emit `session.completed` or `session.finished`. Session completion is signaled by `session.status` event with `status.type === "idle"`.

### session.status (status.type === "busy")
Initializes work summary when work starts

### session.updated
Collects session information (title, directory)

### message.updated / message.part.updated
Updates work summary with progress

## Troubleshooting

**Completion message not sent?**
- Check console logs for `[Telegram Event] type: session.status`
- Verify `status.type === "idle"` is being triggered
- Ensure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set correctly
