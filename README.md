# OpenCode Telegram Plugin (Apache-2.0)

Telegram integration plugin for [OpenCode](https://opencode.ai) — receive AI agent work updates via Telegram, send messages to control agents, and get final work summaries.

## Overview

This plugin integrates OpenCode agent work with Telegram with **project-based organization**:
- **Multiple projects, single chat**: One Telegram channel for multiple OpenCode projects
- **Automatic project routing**: Messages routed by project name prefix
- **Last active session**: Each project connects to its most recent session
- **Dynamic project tags**: Every notification shows project origin
- **New session creation**: Start fresh sessions per project
- **Enhanced event tracking**: Real-time updates with improved session ID extraction
- **Startup notification**: Telegram message on plugin initialization

## Architecture

### N:1 Project-to-Telegram Model

```
┌───┬───────┬─────┬────────────────────────────────────────────────────┐
│   │       │     │              OpenCode Projects                    │
│   │  /a   │  /b │  ┌────────┐  ┌────────┐  ┌────────┐              │
│   │       │     │  │Proj A  │  │Proj B  │  │Proj C  │              │
│   │       │     │  │  /a    │  │  /b    │  │  /c    │              │
│   │       │     │  └───┬───┘  └───┬───┘  └───┬───┘              │
│   │       │     │      │          │          │                   │
│   │       │     │      └────┬─────┴───┬──────┘                   │
│   │       │     │           │         │                          │
│   │       │     │     Last Active Session                        │
│   │       │     │           │         │                          │
└───┴───────┴─────┴──────────────┬──────┴───────┘                   │
                                │                                  │
                                ▼                                  │
┌──────────────────────────────────────────────────────────────────┤
│                        Telegram Chat                            │
│  ┌───────────────────────────────────────────────────────┐       │
│  │ [Project A] 🤖 Agent: Understanding requirements...   │       │
│  │ [Project B] ✅ Tests: 8/8 passed                      │       │
│  │ [Project C] 🔧 Edited src/auth.ts                     │       │
│  └───────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### Message Flow

```
User Input              Plugin Processing              OpenCode Output
──────────            ───────────────────             ────────────────
"[proj-a] fix bug" ──▶  Parse project tag ────────────▶
                            │                           │
                            ▼ Find project directory    │
                     /home/project/a                    │
                            │                           │
                            ▼ Get last active session   │
                     session_abc123                     │
                            │                           │
                            ▼ Inject message ───────────▶
                                      │                        │
                                      ▼                        │
                              Agent works                   │
                                      │                        │
                                      ▼ Stream events ◀───────┤
                                      │                        │
                            ┌─────────┴──────────┐           │
                            ▼                    ▼           │
                      [Project A]            [Project A]     │
                      thinking...            edited file     │
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

### 2. Message Routing

- **Project-specific**: `/project <name> <message>` → routes to specific project's session
- **Broadcast**: Regular messages → sent to all active projects
- **New sessions**: `/new_session <name>` creates fresh session for project

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

### Sending Work Requests

**To specific project:**
```
/project opencode_telegram_hook show me the code structure
```

**Broadcast to all projects:**
```
Check the status of all projects
```

**Create new session:**
```
/new_session news_curation
```

### Commands

```
/project <name> <message>   Send message to specific project's session
/new_session <name>        Create new session for project
/help                      Show all commands
/status                    Show status
/cancel                    Cancel current session
Regular message            Broadcast to all active projects
```

### Examples

#### Project-Specific Message

```
/project backend-api add rate limiting
│
✅ Message sent to backend-api session
```

#### Broadcast to All Projects

```
Show me the current status
│
✅ Message broadcast to 3 project(s)
```

#### Creating New Session

```
/new_session my-new-feature
│
✅ New session created for my-new-feature
   Session ID: ses_abc123
   Directory: /home/project/my-new-feature
```

#### Error Handling

```
/project wrong-project-name help me
│
❌ Project not found: wrong-project-name

Available projects:
- opencode_telegram_hook
- news_curation
- coin_agent
```

#### No Active Session

```
/project coin_agent show code
│
❌ No active session for project: coin_agent

Use /new_session coin_agent to create a new session.
```
│ Telegram Chat |
├─────────────────────────────
│ [backend-api] Add rate limiter
│   ↓
│ [backend-api] 🤖 Understanding rate limiting requirements...
│ [backend-api] 🔧 Creating src/middleware/rate-limit.ts
│ [backend-api] ✅ Tests: 4/4 passed
│
│ [frontend-app] Update login UI
│   ↓
│ [frontend-app] 🤖 Analyzing current login component...
│ [frontend-app] 🎨 Modifying styles for login form
│ [frontend-app] ✅ Files Modified: 3
```

#### Creating New Session

```
/new my-new-feature
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

## Implementation Details

### Project Identification

Projects are identified by their **absolute directory path**. The plugin:

1. Maps `project-display-name ↔ directory-path` in config
2. Tracks `directory-path ↔ active-session-id` per project
3. Routes messages using project name → directory → session chain

### State Management

```typescript
// Project configuration
projectConfig: Map<string, {
  name: string,
  directory: string,
  display_name: string  // For Telegram tags
}>

// Runtime state
projectSessions: Map<string, {
  sessionId: string
  lastActivity: number
  telegramChatId: string
}>
```

### Event Processing

```
OpenCode Event (with directory) 
    ↓
Find project by directory
    ↓
Get project display name
    ↓
Format: `[project-name] event-details`
    ↓
Send to Telegram
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

---

**Note:** Community-maintained plugin, not officially affiliated with OpenCode team.
