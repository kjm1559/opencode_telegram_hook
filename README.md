# OpenCode Telegram Plugin (Apache-2.0)

Telegram integration plugin for [OpenCode](https://opencode.ai) — receive AI agent work updates via Telegram and get final work summaries.

## Overview

This plugin integrates OpenCode agent work with Telegram with **project-based organization**:
- **Multiple projects, single chat**: One Telegram channel for multiple OpenCode projects
- **Dynamic project tags**: Every notification shows project origin
- **Enhanced event tracking**: Real-time updates with improved session ID extraction
- **Startup notification**: Telegram message on plugin initialization

## ⚠️ Communication Status

- ✅ **OpenCode → Telegram**: Working (event-driven, real-time)
- ✅ **Telegram → OpenCode**: Working (single polling thread with routing)

**Architecture**: Single shared TelegramClient for all projects:
- **OpenCode → Telegram**: Event-driven notifications (all projects share client)
- **Telegram → OpenCode**: Single polling thread routes messages by project name
- **No 409 conflicts**: Singleton pattern ensures one instance only

**Commands**:
- `/project <name> <message>` - Send message to specific project's session
- `/new_session <name>` - Create new session for project

## Architecture

### N:1 Project-to-Telegram Model (Bidirectional)

**Architecture**: Single shared TelegramClient for all projects.

```
┌──┬───────┬─────┬────────────────────────────────────────────────────┐
│   │       │     │              OpenCode Projects                    │
│   │  /a   │  /b │  ┌────────┐  ┌────────┐  ┌────────┐              │
│   │       │     │  │Proj A  │  │Proj B  │  │Proj C  │              │
│   │       │     │  │  /a    │  │  /b    │  │  /c    │              │
│   │       │     │  └───┬───┘  └───┬───┘  └───┬───┘              │
│   │       │     │      │          │          │                   │
│   │       │     │      └────┬─────┴───┬──────┘                   │
│   │       │     │           │         │                          │
│   │       │     │     Events & Notifications                     │
│   │       │     │           │         │                          │
└──┴───────┴────┴───────────┬─┴───┴───┘                   │
                            │                            │
                            ▼ (Bidirectional)            │
┌─────────────────────────────────────────────────────────────────┤
│                        Telegram Chat                            │
│  ┌───────────────────────────────────────────────────────┐       │
│  │ [Project A] 🤖 Agent: Understanding requirements...   │       │
│  │ [Project B] ✅ Tests: 8/8 passed                      │       │
│  │ [Project C] 🔧 Edited src/auth.ts                     │       │
│  │ 👤 User: /project A deploy to prod                    │       │
│  │ [Project A] ✅ Deployed successfully                  │       │
│  └───────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

**Key Changes**:
- **Single TelegramClient**: All projects share one client instance
- **One polling loop**: Receives messages, routes by `/project <name>` command
- **No 409 conflicts**: Singleton pattern prevents multiple instances
┌──┬───────┬─────┬────────────────────────────────────────────────────┐
│   │       │     │              OpenCode Projects                    │
│   │  /a   │  /b │  ┌────────┐  ┌────────┐  ┌────────┐              │
│   │       │     │  │Proj A  │  │Proj B  │  │Proj C  │              │
│   │       │     │  │  /a    │  │  /b    │  │  /c    │              │
│   │       │     │  └───┬───┘  └───┬───┘  └───┬───┘              │
│   │       │     │      │          │          │                   │
│   │       │     │      └────┬─────┴───┬──────┘                   │
│   │       │     │           │         │                          │
│   │       │     │     Events & Notifications                     │
│   │       │     │           │         │                          │
└──┴───────┴────┴───────────┬─┴───┴───┘                   │
                            │                            │
                            ▼ (One-Way Only)             │
┌─────────────────────────────────────────────────────────────────┤
│                        Telegram Chat                            │
│  ┌───────────────────────────────────────────────────────┐       │
│  │ [Project A] 🤖 Agent: Understanding requirements...   │       │
│  │ [Project B] ✅ Tests: 8/8 passed                      │       │
│  │ [Project C] 🔧 Edited src/auth.ts                     │       │
│  └───────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Message Flow (Bidirectional)

```
OpenCode Events          Plugin Processing              Telegram Output
─────────────           ───────────────────             ────────────────
Agent works ──────────▶  Extract session_id ────────────▶
                            │                           │
                            ▼ Format message            │
                     [Proj A] thinking...               │
                            │                           │
                            ▼ Add project tag           │
                     [Project A] thinking...            │
                            │                           │
                            ▼ Send to Telegram ◀────────┤
                            │                           │
                            ▼ Display in Chat           │
                     [Project A] thinking...            │
                            │                           │
                            │                           │
User message ◀───◀───◀───◀──┤                           │
                            │                           │
                            ▼ Parse /project command    │
                     Target: Project A                  │
                            │                           │
                            ▼ Route to session          │
                     Forward to OpenCode                │
                            │                           │
                            ▼ Agent processes           │
                     [Project A] Received command...    │
```

## Key Features

### 1. Project-Based Organization

- **Multiple projects tracked**: Monitor 3+ projects in one Telegram chat
- **Project tags**: Automatic `[Project Name]` prefix on all notifications
- **Auto-discovery**: Projects registered via `directory` hook parameter

### 2. Event Tracking (Enhanced)

- **Real-time agent work updates**: See every action as it happens
- **Tool usage monitoring**: Track `edit`, `write`, `bash`, test execution
- **Session lifecycle**: Start, progress, completion notifications
- **Completion summaries**: Final reports with actions, files, test results
- **Robust session ID extraction**: Enhanced detection across event types (message, tool, command, session)
- **Event filtering**: Configurable tracking with case-insensitive event type matching
- **Debug logging**: Comprehensive logging for troubleshooting

### 3. Real-Time Updates

- **Streaming output**: See agent thinking, tool calls, file edits as they happen
- **Completion summaries**: Final reports with actions, files, test results
- **Error handling**: Immediate notification of failures

**Formatting**: Messages use Telegram MarkdownV2 for rich text formatting:
- Code snippets displayed with proper inline code formatting
- Bold/italic text for emphasis
- Proper escaping of special characters in dynamic content
- Emojis and icons for visual clarity

### 4. Session Management

- **Automatic activation**: Each project maintains "last active" session
- **Multi-project control**: `/status` shows all active projects
- **Cancellation**: `/cancel [project-name]` stops specific project

## Installation

### Setup

```bash
git clone https://github.com/kjm1559/opencode_telegram_hook.git
cd opencode_telegram_hook
bun install
bun run build
```

### Environment Configuration

```bash
# Required
export TELEGRAM_BOT_TOKEN="your-bot-token-here"

# Optional
export TELEGRAM_CHAT_ID="your-telegram-chat-id"  # Target chat ID
export ALLOWED_CHAT_IDS="123456789,987654321"  # Allowed user IDs
export NOTIFICATION_LEVEL="all"  # all, summary-only, errors-only
export MAX_EVENTS_PER_SUMMARY="100"  # Max events in summary
export PROJECTS='{"projects": [{"display_name": "my-api", "directory": "/path/to/project"}]}'  # Project mapping
```

### Register with OpenCode

Add to your `~/.config/opencode/opencode.json` or project-specific `opencode.json`:

```json
{
  "plugin": [
    "oh-my-opencode@latest",
    "file:///path/to/opencode_telegram_hook/dist/index.js"
  ]
}
```

**Build the plugin first:**
```bash
cd opencode_telegram_hook
bun run build
```

## Usage

### Receiving Notifications

You will receive real-time notifications from OpenCode:

**Project-Specific Updates**:
```
[opencode_telegram_hook] 🤖 Agent: Understanding requirements...
[opencode_telegram_hook] 🔧 Edited src/index.ts
[opencode_telegram_hook] ✅ Tests: 8/8 passed
```

**Multiple Projects**:
```
[news_curation] 🤖 Fetching latest news...
[coin_agent] 📊 Analyzing market data...
[opencode_telegram_hook] 🔧 Creating test file...
```

### Sending Messages to OpenCode

**Send to specific project**:
```
/project opencode_telegram_hook hello agent
```

**Create new session**:
```
/new_session news_curation
```

**Response**:
```
✅ New session created for news_curation
Session ID: ses_abc123

Send your task request.
│
✅ Created new session for "my-new-feature"
   Session: ses_abc123
   Directory: /home/project/my-new-feature
   
Send your task request.
```

#### Status Check

```
/status
│
📊 Active Projects:
  • backend-api (ses_abc12) — Active
  • frontend-app (ses_def45) — Idle
  • data-pipeline (ses_ghi78) — Completed
  
Total: 3 projects, 2 active sessions
```

## Development

```bash
# Start development
bun run dev

# Run tests
bun test

# Type check
bun typecheck
```

### Debug Mode

```bash
DEBUG=opencode-telegram bun run dev
```

## Testing Strategy

Tests cover:

- **Message routing**: Project tag parsing and session resolution
- **State management**: Multiple projects with different session states
- **Event formatting**: Project prefix applied to all notifications
- **Session lifecycle**: Create, link, update, cancel sessions

```bash
bun test src/project-routing.test.ts
```

## API Reference

### MessageRelay Methods

```typescript
// Forward message to project session
await relay.forwardToProject({
  chatId: string,
  projectName: string,  // or undefined for last active
  message: string
})

// Create new session for project
await relay.createNewSession({
  chatId: string,
  directory: string  // Absolute path
})
```

### EventHandler Integration

```typescript
// Automatically adds project prefix
await eventHandler.handle(event, {
  directory: event.payload.directory,
  chatId: string
})
```

## Recent Changes

### v1.0.2 - Event Tracking Improvements

- **Fixed fs compatibility**: Dynamic import for bundling compatibility across environments
- **Enhanced session ID extraction**: Robust detection across multiple event types:
  - Message events (message.created, message.part.updated, etc.)
  - Tool execution events (tool.execute.before, tool.execute.after)
  - Command events (command.executed)
  - Session lifecycle events (session.started, session.completed, etc.)
- **Improved error handling**: Better validation and null checks for event properties
- **Startup notification**: Telegram message sent when plugin loads successfully
- **Debug logging**: Comprehensive console output for troubleshooting

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/improvement`)
3. Commit changes (`git commit -m 'Add improvement'`)
4. Push to branch (`git push origin feature/improvement`)
5. Open Pull Request

## Documentation

### Event & Message Structure

Understand how OpenCode events and messages are structured:

- [Message Structure Guide](./doc/message-structure.md) — Complete guide on event types, message/Part structures, field paths
- [Event Types Reference](./doc/event-types-reference.md) — All event types with field mappings and examples

**Key Concepts**:
- Messages stored with metadata in `message.updated.events.properties.info`
- Actual content in `message.part.updated.events.properties.part`
- Text content accessible via `part.text` (for `text` type parts)
- Tool outputs in `part.state.output` (for `tool` type parts)

---

## Resources

- [OpenCode Documentation](https://opencode.ai/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OpenCode Plugin Guide](https://opencode.ai/docs/plugins)
- [Project Source Code](./src/)
- [Type Definitions](./opencode/packages/sdk/js/src/v2/gen/types.gen.ts) — OpenCode SDK types

## External Webhook Server for Bidirectional Communication

**Why needed**: Multiple OpenCode plugin instances cause HTTP 409 conflicts when calling Telegram `getUpdates()`. To enable bidirectional communication (Telegram → OpenCode), use an external webhook server.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Webhook Server                  │
│                    (Node.js/Python/etc.)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. Set Telegram webhook:                            │    │
│  │    POST /setWebhook                                 │    │
│  │    url: https://your-server.com/telegram/webhook    │    │
│  │                                                     │    │
│  │ 2. Receive Telegram messages:                       │    │
│  │    POST /telegram/webhook                           │    │
│  │    ← Telegram sends updates                         │    │
│  │                                                     │    │
│  │ 3. Parse commands:                                  │    │
│  │    /project <name> <message>                        │    │
│  │    /new_session <name>                             │    │
│  │                                                     │    │
│  │ 4. Forward to OpenCode:                             │    │
│  │    POST http://localhost:4096/session/<id>/message  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      OpenCode Session                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Agent processes message                             │    │
│  │ → Events flow to Telegram plugin                    │    │
│  │ → Plugin sends notifications to Telegram            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Example

```typescript
// webhook-server.ts
import express from 'express'

const app = express()
app.use(express.json())

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const PROJECTS = {
  'opencode_telegram_hook': { directory: '/home/mj/project/opencode_telegram_hook' },
  'news_curation': { directory: '/home/mj/project/news_curation' },
  'coin_agent': { directory: '/home/mj/project/Opencodebot/workspace/coin_agent' }
}

// Set webhook
app.post('/set-webhook', async (req, res) => {
  const webhookUrl = process.env.WEBHOOK_URL // e.g., https://your-server.com/telegram/webhook
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    body: JSON.stringify({ url: webhookUrl })
  })
  res.json({ success: true })
})

// Receive Telegram updates
app.post('/telegram/webhook', async (req, res) => {
  const update = req.body
  
  if (!update.message?.text) {
    res.status(200).send('OK')
    return
  }
  
  const text = update.message.text
  const chatId = update.message.chat.id
  
  // Parse command
  if (text.startsWith('/project ')) {
    const parts = text.slice(9).split(' ')
    const projectName = parts[0]
    const message = parts.slice(1).join(' ')
    
    await forwardToProject(projectName, message, chatId)
  } else if (text.startsWith('/new_session ')) {
    const projectName = text.slice(13).trim()
    await createNewSession(projectName, chatId)
  }
  
  res.status(200).send('OK')
})

async function forwardToProject(projectName: string, message: string, chatId: string) {
  const project = PROJECTS[projectName]
  if (!project) {
    await sendTelegramMessage(chatId, `❌ Project not found: ${projectName}`)
    return
  }
  
  // Get last session for project
  const sessions = await fetch(`http://localhost:4096/session?directory=${project.directory}`).then(r => r.json())
  const lastSession = sessions.result[0]
  
  if (!lastSession) {
    await sendTelegramMessage(chatId, `❌ No active session for ${projectName}`)
    return
  }
  
  // Forward message to OpenCode
  await fetch(`http://localhost:4096/session/${lastSession.id}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text: message }] })
  })
  
  await sendTelegramMessage(chatId, `✅ Message sent to ${projectName}`)
}

async function createNewSession(projectName: string, chatId: string) {
  const project = PROJECTS[projectName]
  if (!project) {
    await sendTelegramMessage(chatId, `❌ Project not found: ${projectName}`)
    return
  }
  
  const result = await fetch('http://localhost:4096/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory: project.directory })
  }).then(r => r.json())
  
  await sendTelegramMessage(chatId, `✅ New session created for ${projectName}\nSession ID: ${result.id}`)
}

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
}

app.listen(3000, () => console.log('Webhook server running on port 3000'))
```

### Deployment

1. **Deploy to VPS/Cloud**:
   ```bash
   npm install express
   node webhook-server.ts
   ```

2. **Set webhook** (using ngrok for localhost):
   ```bash
   ngrok http 3000
   curl -X POST https://your-ngrok-url/set-webhook
   ```

3. **Test**:
   ```
   Send /project opencode_telegram_hook hello
   ```

### Benefits

- ✅ **No 409 conflicts**: External server handles Telegram API
- ✅ **Bidirectional communication**: Telegram ↔ OpenCode
- ✅ **Scalable**: Can handle multiple projects
- ✅ **Reliable**: Persistent server outside OpenCode

---

**Note:** Community-maintained plugin, not officially affiliated with OpenCode team.
