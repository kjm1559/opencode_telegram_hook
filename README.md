# opencode_telegram_hook

Telegram integration plugin for [OpenCode](https://opencode.ai) — receive AI agent work updates via Telegram, send messages to control agents, and get final work summaries.

## Overview

This project adds Telegram chat functionality to OpenCode, enabling:

- **Real-time notifications**: Receive streaming text output from agent work as it happens
- **Work completion summaries**: Get organized final reports when agent tasks finish
- **Bidirectional control**: Send commands from Telegram to OpenCode agents
- **Agent orchestration**: Leverage OpenCode's agent system (build, plan, specialized subagents) for task execution

## Features

### 1. Agent Work Notifications

When OpenCode agents perform work, the plugin hooks into the ACP (Agent Client Protocol) and forwards:

- Text output from agent thinking and tool usage
- File operations and command execution results
- Error states and recovery attempts

### 2. Completion Summaries

When agent work completes:

- Consolidated work summary with key actions taken
- Files modified/created list
- Test results and build status (if applicable)
- Clear completion status indicator

### 3. Message Relay

Supports bi-directional communication:

- Send user messages from Telegram → OpenCode session
- Receive responses and contextual follow-ups in Telegram

### 4. Integration with OpenCode

Leverages existing OpenCode infrastructure:

- **ACP integration**: Hooks into `packages/opencode/src/acp/` for agent interface
- **Session management**: Works with `SessionService` and `MessageService`
- **Agent system**: Supports `build`, `plan`, `general`, and custom agents
- **Plugin API**: Follows `packages/plugin` architecture for extensibility

## Architecture

```plaintext
Telegram Bot        OpenCode Plugin        OpenCode Core
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  User Msg   │───>│  MessageParser  │───>│  SessionService  │
│  Updates    │<───│  Notification   │<───│  ACP Stream      │
│  Commands   │───>│  WorkSummarizer │───>│  Agent/Task      │
└─────────────┘    └─────────────────┘    └──────────────────┘
```

### Key Integration Points

1. **ACP Stream** (`packages/opencode/src/acp/agent-interface.ts`)
   - Intercept real-time agent output via ACP events
   - Forward to Telegram as streaming text

2. **Plugin System** (`packages/plugin`)
   - Follows official OpenCode plugin architecture
   - Can be installed via `opencode plugin add` or manual integration

3. **Session Management**
   - Maintains context between Telegram messages and OpenCode sessions
   - Supports multiple concurrent conversations

## Prerequisites

- Node.js 18+ or Bun 1.3+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- OpenCode installation (local or self-hosted)

## Installation

### Option 1: As OpenCode Plugin

```bash
# Clone this repository
git clone https://github.com/your-org/opencode_telegram_hook.git

cd opencode_telegram_hook
bun install

# Build the plugin
bun run build

# Register with OpenCode (if using plugin system)
opencode plugin add ./dist/opencode-telegram-plugin.js
```

### Option 2: Standalone Integration

```bash
bun install
bun run dev
```

## Configuration

Set environment variables:

```bash
# Required
TELEGRAM_BOT_TOKEN=your-bot-token-here

# OpenCode connection
OPENCODE_HOST=localhost          # Default: localhost
OPENCODE_PORT=8082               # Default: 8082
OPENCODE_WS_PORT=8083            # WebSocket port for ACP

# Optional
TELEGRAM_USERIDS="123456789,987654321"  # Allowed user IDs (comma-separated)
NOTIFICATION_LEVEL=all           # all, summary-only, errors-only
SUMMARY_INCLUDE_FILE_LIST=true   # Include modified files in summaries
SUMMARY_INCLUDE_TEST_RESULTS=true  # Include test output
```

## Usage

### Sending Work Requests

Type your task in Telegram:

```
Add a new feature to authenticate users with JWT tokens
```

The plugin will:

1. **Forward** your message to OpenCode's active session
2. **Stream** agent output (thinking, tool calls, results) in real-time
3. **Summarize** work completion with:
   - Actions taken
   - Files modified
   - Test/build status
   - Final confirmation

### Supported Commands

```
/start       Initialize session
/help        Show available commands
/human       Request human confirmation needed
/cancel      Stop current agent work
/status      Check current agent status
```

### Work Flow Example

```
│─ Telegram Chat │
"Create an API endpoint for user profiles"

└────────> OpenCode Agent (via Plugin)

│─ Agent Output Streaming │
[Agent] Understanding task...
[Agent] Found existing patterns in src/routes/users.ts
[Agent] Creating new endpoint handler
[Agent] Running tests...
Agent: ✅ Tests passed

└────────> Telegram Summary

│─ Final Report │
✅ Work Completed!

**Actions:**
- Created src/routes/user-profile.ts
- Added OpenAPI schema for /api/users/:id
- Wrote 8 test cases

**Files Modified:**
- src/routes/user-profile.ts (+45 lines)
- src/openapi/schema.yaml (+12 lines)

**Tests:** 8/8 passed

Ready for next task.
```

## Development

```bash
# Start in development mode
bun run dev

# Run tests
bun test

# Check types
bun typecheck
```

### Debugging

Enable verbose logging to see ACP events and Telegram message flow:

```bash
DEBUG=opencode-telegram bun run dev
```

## Key OpenCode Components

When implementing, reference these core files:

| Component | Path | Purpose |
|-----------|------|---------|
| ACP Interface | `src/acp/agent-interface.ts` | Agent communication protocol |
| Session Service | `src/session/session.ts` | Message/session management |
| Plugin System | `packages/plugin/src/` | Plugin architecture |
| Agent Types | `src/config/agent.ts` | Agent configuration |
| Event Bus | `src/ide/bus.ts` | Internal event handling |

## Testing Strategy

The plugin includes tests for:

- Message parsing and relaying
- ACP event forwarding
- Work summarization logic
- Telegram API integration

```bash
cd tests && bun test telegram-plugin.test.ts
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Resources

- [OpenCode Documentation](https://opencode.ai/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OpenCode Plugin Guide](https://opencode.ai/docs/plugins) (if available)
- [OpenCode ACP Protocol](https://github.com/opencode-ai/agent-client-protocol)

---

**Note:** This plugin is community-maintained and not officially affiliated with the OpenCode team.
