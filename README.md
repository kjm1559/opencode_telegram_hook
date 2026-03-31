# OpenCode Telegram Plugin

Sends Telegram notifications when OpenCode sessions complete.

## Features

### Session Completion Notification

Sends a summary of tools used and files changed when work is done:

```
[project-name] Session Complete

🔧 Tools Used (5):
  1. edit — src/index.ts
  2. bash — bun run build
  3. read — README.md
  4. edit — README.md
  5. bash — git push

📝 Changed Files (2):
• src/index.ts
• README.md

✅ Session complete.
```

### Choice Required Notification

Alerts when user input is needed:

```
[project-name] Choice Required

⚠️ A choice is required to continue working.
```

## Installation

### 1. Set Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

### 2. Build

```bash
cd opencode_telegram_hook
bun install
bun run build
```

### 3. Register with OpenCode

Add the plugin path to `opencode.json` or your config file:

```json
{
  "plugin": [
    "file:///path/to/opencode_telegram_hook/dist/index.js"
  ]
}
```

## Events & Hooks

### Events (via `event` handler)

| Event | Action |
|-------|--------|
| `session.status (busy)` | Cancel pending timer (report preserved) |
| `session.status (idle)` | Schedule completion timer (8s debounce) |
| `session.idle` | Schedule completion timer (fallback) |
| `permission.asked` / `question.asked` | Send choice required alert |

### Hooks (registered separately)

| Hook | Action |
|------|--------|
| `tool.execute.before` | Record tool usage + summarize input |
| `tool.execute.after` | Track changed files (`metadata.filediff`) |
| `config` | Send connection confirmation |

## Architecture

- Event-driven (no polling)
- Single-file implementation
- Each instance operates independently
- `tool.execute.before` is a separate hook (not an event)
- Changed files tracked via `tool.execute.after`'s `metadata.filediff`

### Completion Detection (Debounce)

Since `idle` events fire frequently between tool executions, an **8-second debounce** is applied instead of immediate sending:

1. **busy** → Cancel timer (report preserved — tool/file recording continues)
2. **idle** → Schedule 8-second timer (not sent yet)
3. File/tool collection continues during idle
4. If busy returns within 8s → Cancel timer, report preserved (next tool recording accumulates)
5. 8s of sustained idle → Send accumulated report, then reset

Tools executing in rapid succession keep resetting the timer while accumulating the report. Only when idle persists for 8+ seconds is the full work summary sent.

### Session ID Filtering

OpenCode events' `event.properties.info.id` can contain both session IDs (`ses_xxx`) and message IDs (`msg_xxx`). Mistaking a message ID for a session would reset the report on every event, so only IDs starting with `ses_` are treated as sessions.

```typescript
// ✅ Correct: only ses_ prefixed IDs are sessions
if (rawID?.startsWith("ses_")) resetForSession(rawID)

// ❌ Wrong: msg_xxx also treated as session, resetting report
if (sessionID) resetForSession(sessionID)
```

The `tool.execute.before` hook's `input.sessionID` is always in `ses_` format and is used for additional session tracking.

### Tool Input Summarization

Meaningful input values are extracted from the `tool.execute.before` hook's `output.args` and included in messages:

| Tool | Display |
|------|---------|
| `edit` | Filename + replaced text preview (first line, 40 chars) |
| `read` | Filename + line offset/limit (e.g. `README.md L10 +50`) |
| `write` | File path |
| `bash` | Command (80 char limit) |
| `glob` / `grep` | Search pattern |
| `task` | Subtask description |
| Other | Primary arg keys or first 3 field names |

### Completion Message Example

```
[project-name] Session Complete

🔧 Tools Used (5):
  1. read — src/index.ts L1 +200
  2. edit — src/index.ts — "export const TelegramPlugin"
  3. bash — bun run build
  4. edit — README.md — "## Events & Hooks"
  5. bash — git add . && git commit -m "..."

📝 Changed Files (2):
• src/index.ts
• README.md

✅ Session complete.
```

### File Change Tracking

Uses `output.metadata.filediff` from the `tool.execute.after` hook. Since edit/write tools include precise diff metadata when modifying files, only actually changed files are tracked.

## Troubleshooting

**Not receiving notifications?**

1. Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set
2. Ensure `bun run build` has been run
3. Check the plugin path is correct
