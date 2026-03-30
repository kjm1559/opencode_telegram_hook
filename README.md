# OpenCode Telegram Plugin

A plugin that sends notifications with work summaries to Telegram when OpenCode work is completed or when a choice is required.

## Features

### Work Completion Notification (with Summary)
```
[project-name] Work Completed

Project: project-name
Work Started
Title: work title
• Work step 1
• Work step 2

✅ Work has been completed.
```

### Choice Required Notification (with Summary)
```
[project-name] Choice Required

Project: project-name
Work Started
Title: work title
• Work step 1

⚠️ A choice is needed to proceed with work.
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
