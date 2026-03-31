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

---

## 2025-03-28: Project-Specific Commands

### Problem 7: No Way to Target Specific Projects

**Symptom:**
- Messages sent to Telegram were broadcast to ALL projects
- No way to send message to a specific project
- No way to create sessions for individual projects

**Root Cause:**
- `globalPollingLoop()` only handled `type: "message"`
- All messages broadcast to all projects in registry
- No command parsing for project-specific actions

**Solutions Applied:**

1. **Add `/project <name> <message>` command**
   - File: `src/telegram-client.ts`
   - Parse command: `/project opencode_telegram_hook help me`
   - Extract project name and message
   - Send to specific project's session only

2. **Add `/new_session <name>` command**
   - File: `src/telegram-client.ts`
   - Parse command: `/new_session coin_agent`
   - Create new session for specified project
   - Store session ID in `project.latestSessionId`

3. **Update ParsedMessage type**
   - Added `type: "project_message"` and `type: "new_session"`
   - Added `projectName?: string` field
   - Made `message?: string` optional

4. **Implement command handlers in globalPollingLoop**
   - File: `src/index.ts`
   - Handle `/project` → find project → send to session
   - Handle `/new_session` → create session → store ID
   - Error handling with helpful messages
   - List available projects on error

**Verification:**
```
# Send message to specific project
/project opencode_telegram_hook show me the code

# Create new session
/new_session news_curation

# List available projects (on error)
❌ Project not found: wrong_name
Available projects:
- opencode_telegram_hook
- news_curation
- coin_agent
```

**Command Reference:**
- `/project <name> <message>` - Send message to specific project
- `/new_session <name>` - Create new session for project
- `/help` - Show command list
- `/status` - Check status
- `/cancel` - Cancel current session
- Regular messages - Broadcast to all projects

**Last Updated:** 2025-03-28

---

## 2026-03-31: Completion Message Architecture Redesign

### Problem 8: Completion Messages Sent Prematurely

**Symptom:**
- 작업 완료 메시지가 각 도구 실행마다 개별 전송됨
- 전체 작업이 아닌 일부만 보고됨

**Root Cause:**
- `session.diff`와 `file.edited` 이벤트 핸들러에서 `trySendCompletion()`을 즉시 호출
- `file.edited`는 현재 OpenCode에서 존재하지 않는 이벤트
- `session.diff`는 작업 중간에도 발생하므로 조기 전송 유발

**Solution:**
- `session.diff`에서 수집만 하고 전송은 제거
- `file.edited` 핸들러 완전 제거
- 전송은 오직 `session.status (idle)`에서만 발생

---

### Problem 9: Debounce Needed for True Completion Detection

**Symptom:**
- 도구 실행 사이사이에 `idle → busy → idle`이 빈번히 발생
- 각 idle마다 즉시 전송하면 작업이 분할되어 보고됨

**Root Cause:**
- OpenCode는 각 도구 실행 전후로 busy/idle을 반복함
- idle을 완료로 간주하면 도구 하나당 한 번씩 전송됨

**Solution:**
- **8초 debounce** 도입
- `idle` → 8초 타이머 예약 (전송 아님)
- 8초 내 `busy` 오면 타이머 취소 + 리포트 누적 유지
- 8초 동안 idle 유지 시에만 최종 전송

---

### Problem 10: Report Reset on Every Busy (Data Loss)

**Symptom:**
```
[Telegram] tool.execute.before: edit (1 total)
[Telegram] session.status: busy
[Telegram] tool.execute.before: read (1 total)  // edit 기록 손실
```
- 변경 파일만 보고되고 사용된 도구 목록이 비어있음

**Root Cause:**
- `busy` 이벤트에서 `report = { tools: [], files: [] }`로 초기화
- 도구 실행 사이사이에 busy가 발생하면 이전 도구 기록이 모두 손실

**Solution:**
- `busy`에서 타이머만 취소, 리포트는 초기화하지 않음
- 리포트 초기화는 새 세션 시작 또는 전송 완료 후에만 발생

---

### Problem 11: Message ID Confused with Session ID

**Symptom:**
```
[Telegram] new session: msg_d4274566c001VsG491zNwG8oCa
[Telegram] new session: ses_2bd948ed1ffeVYCjrvnm0ARBwD
```
- 매 이벤트마다 `new session:` 로그, 리포트 계속 초기화됨

**Root Cause:**
- `event.properties?.info?.id`가 세션 ID(`ses_xxx`)와 메시지 ID(`msg_xxx`)를 모두 포함
- `msg_xxx`를 세션으로 오인식하여 `resetForSession()`이 매번 호출됨

**Solution:**
- `ses_` 접두사로 시작하는 ID만 실제 세션으로 간주
- `tool.execute.before` 훅의 `input.sessionID`는 항상 `ses_` 형식이므로 추가 추적으로 활용

```typescript
// Before (bug)
if (sessionID) resetForSession(sessionID)

// After (fixed)
if (rawID?.startsWith("ses_")) resetForSession(rawID)
```

---

## Common Patterns & Lessons Learned (Updated)

### Pattern 5: Session ID Identification
- **Always check prefix**: `ses_` = session, `msg_` = message, `part_` = part
- **Never trust `info.id` blindly**: It can be any entity's ID depending on event type
- **Hook `sessionID` is reliable**: `tool.execute.before` always provides `ses_` format

### Problem 12: session.diff Returns Cumulative Data (Duplicate Files)

**Symptom:**
```
[Telegram] session.diff: files=4
[Telegram] files: HISTORY.md, README.md, doc/event-types-reference.md, src/index.ts
```
- 매번 같은 파일 목록이 반복됨. 전송 후 리포트를 초기화해도 다음 `session.diff`에서 같은 파일들이 다시 들어옴.

**Root Cause:**
- `session.diff`는 **증분(incremental) 변경**이 아니라 **세션 전체의 누적 diff**를 반환
- 리포트 초기화 후에도 OpenCode 측의 세션 diff는 유지되므로, 다음 이벤트에서 같은 파일들이 재누적됨

**Solution:**
- `session.diff` 핸들러 완전 제거
- `session.updated` 이벤트의 `info.summary.diffs`로 파일 변경 추적
- `session.updated`는 세션 상태 변경 시 발생하며, summary.diffs는 더 안정적인 데이터 소스

---

### Problem 13: Tool Input Data Missing from Completion Messages

**Symptom:**
```
🔧 사용된 도구 (3개):
  1. bash
  2. bash
  3. bash
```
- 도구 이름만 표시되고 어떤 작업을 했는지 알 수 없음

**Root Cause:**
- `tool.execute.before` 훅의 `output.args`를 무시하고 빈 문자열 저장

**Solution:**
- `summarizeToolInput` 함수 추가: 도구별 의미 있는 입력값 추출
- `edit/write/read` → 파일명, `bash` → 명령어, `task` → 설명 등

---

## Common Patterns & Lessons Learned (Updated)

### Pattern 5: Session ID Identification
- **Always check prefix**: `ses_` = session, `msg_` = message, `part_` = part
- **Never trust `info.id` blindly**: It can be any entity's ID depending on event type
- **Hook `sessionID` is reliable**: `tool.execute.before` always provides `ses_` format

### Pattern 6: Debounce for Completion
- **Idle ≠ Complete**: Tools fire busy/idle cycles between each execution
- **Use timer-based debounce**: Only send after sustained idle period
- **Preserve state during busy**: Don't reset accumulated data on busy events

### Pattern 7: Cumulative vs Incremental Events
- **`session.diff` is cumulative**: Returns entire session diff, not just new changes
- **Prefer `session.updated`**: `info.summary.diffs` is more reliable for file tracking
- **Always verify event semantics**: Don't assume events are incremental without testing
