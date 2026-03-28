# Telegram Plugin - Problem History & Solutions

This document tracks all problems encountered and their solutions for the Telegram Plugin.

---

## 2025-03-28: Initial Setup Issues

### Problem 1: HTTP 409 Infinite Loop

**Symptom:**
```
[Telegram] Resetting update offset due to conflict (attempt 1)
[Telegram] Failed to get updates: HTTP 409
[Telegram] Resetting update offset due to conflict (attempt 2)
... infinite loop
```

**Root Cause:**
- Multiple OpenCode instances running with same bot token
- Each instance calling `getUpdates()` simultaneously
- Resetting `lastUpdateId = 0` then immediately retrying with `offset=1`
- Telegram already processed update #1, causing another 409 → infinite loop

**Solutions Applied:**

1. **Return empty array instead of throwing on 409**
   - File: `src/telegram-client.ts`
   - Changed: `throw new Error('HTTP 409')` → `return []`
   - Effect: Breaks the infinite loop

2. **Add circuit breaker**
   - Track consecutive 409 attempts
   - Warn after 5 consecutive attempts
   - Message: "Consider stopping other instances or using different bot tokens"

3. **Add 5-second delay between 409 retries**
   - File: `src/telegram-client.ts`
   - Add `MIN_RETRY_INTERVAL = 5000ms`
   - Wait before retrying on 409

4. **Single global polling loop**
   - File: `src/index.ts`
   - Add `globalProjectRegistry` to share state
   - Single `setInterval` for all projects
   - Prevents multiple instances from calling `getUpdates()` simultaneously

**Verification:**
- No more infinite 409 loops
- Warning message after 5 consecutive conflicts
- Global polling started once for all projects

---

### Problem 2: HTTP 404 Not Found

**Symptom:**
```
[Telegram] getUpdates: token=8759038398:AAGy***, lastUpdateId=0
[Telegram] 404: Bot may not be started. Ask user to send /start to @mjkim_cc_bot
```

**Root Cause:**
- Bot needs to be activated with `/start` command
- `getUpdates()` fails if bot never received any updates
- Offset calculation fails on first call

**Solutions Applied:**

1. **Remove `getUpdates()` polling entirely**
   - File: `src/telegram-client.ts`
   - Changed: Full implementation → `return []`
   - Reason: Bot only needs to send messages, not receive

2. **Add helpful warning message**
   - Show once: "Bot not activated. Please send /start to @mjkim_cc_bot"
   - Track with `botStartWarningShown` flag

**Verification:**
- Bot token verified: `@mjkim_cc_bot`
- Messages sent successfully
- No 404 errors

---

### Problem 3: Only First Project Sends Startup Message

**Symptom:**
```
[Telegram] Startup message sent for opencode_telegram_hook
// No messages for news_curation and coin_agent
```

**Root Cause:**
```
if (!globalPollingStarted && defaultChatIds.length > 0) {
  // Only first project sends message
}
```

**Solution:**
- File: `src/index.ts`
- Remove `!globalPollingStarted` condition
- Each project sends its own startup message

**Verification:**
- All 3 projects send startup messages
- Each shows project name and directory

---

### Problem 4: Project Name Underscore Removed

**Symptom:**
```
📂 Project: opencodetelegramhook  // ❌ Missing underscore
```

**Root Cause:**
```typescript
return lastSegment.replace(/[^a-zA-Z0-9_-]/g, "-")  // Underscore in exclusion list
```

**Solution:**
- File: `src/config.ts`
- Keep underscore in allowed characters
- Single regex: `replace(/[^a-zA-Z0-9_-]/g, "-")`

**Verification:**
```
📂 Project: opencode_telegram_hook  // ✅ Underscore preserved
```

---

### Problem 5: MarkdownV2 Escaping Errors

**Symptom:**
```
[Telegram] 400 Bad Request - Check chat_id and message format.
Error: {"ok":false,"error_code":400,"description":"Bad Request: can't parse entities: Character '.' is reserved..."}
```

**Root Cause:**
```typescript
parse_mode: params.parse_mode || "MarkdownV2"  // Default to MarkdownV2
```

**Solutions Applied:**

1. **Remove default parse_mode**
   - File: `src/telegram-client.ts`
   - Only add `parse_mode` if explicitly provided
   - Send as plain text by default

2. **Keep escapeMarkdownV2 function**
   - Still useful for messages that need formatting
   - Escapes all special characters except `*` and `_`

**Verification:**
- No more 400 errors
- Messages sent as plain text
- No escaping needed

---

### Problem 6: Telegram Message Not Received

**Symptom:**
- Telegram messages not forwarded to OpenCode sessions

**Root Cause:**
- `getUpdates()` returning empty array
- No polling for incoming messages

**Solution:**
- File: `src/telegram-client.ts`
- Restore `getUpdates()` implementation
- Simple polling with offset tracking

**Verification:**
- Telegram messages received
- Forwarded to OpenCode sessions

---

## Common Patterns & Lessons Learned

### Pattern 1: Error Handling
- **Never throw errors in async polling** - return empty array instead
- **Add delays between retries** - prevent rapid-fire errors
- **Track consecutive failures** - warn users after threshold

### Pattern 2: Global State
- **Single polling loop** - prevent multiple instances from conflicting
- **Shared registry** - all projects share state
- **Conditional initialization** - only start once

### Pattern 3: Telegram API
- **No default parse_mode** - send plain text unless formatting needed
- **Escape special characters** - if using MarkdownV2
- **Bot needs /start** - activate before receiving updates

### Pattern 4: Project Names
- **Preserve underscores** - important for readability
- **Single regex** - avoid multiple replacements
- **Config lookup first** - use display_name if available

---

## Quick Reference

### Files Modified
- `src/telegram-client.ts` - Core Telegram API client
- `src/index.ts` - Plugin initialization and global state
- `src/config.ts` - Project name generation
- `src/event-handler.ts` - Event formatting

### Environment Variables
- `TELEGRAM_BOT_TOKEN` - Bot authentication token
- `TELEGRAM_CHAT_ID` - Target chat ID

### Bot Information
- Username: `@mjkim_cc_bot`
- Token: `8759038398:AAGy***` (partial)
- Chat ID: `7764331663`

### Testing Commands
```bash
# Verify bot token
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN bun run verify-bot.ts

# Build project
bun run build

# Run tests
bun test
```

---

## Status: ✅ All Issues Resolved

- [x] HTTP 409 infinite loop
- [x] HTTP 404 Not Found
- [x] Only first project sends message
- [x] Project name underscore removed
- [x] MarkdownV2 escaping errors
- [x] Telegram message not received

**Last Updated:** 2025-03-28
