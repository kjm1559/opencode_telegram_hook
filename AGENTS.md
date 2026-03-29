# Project Knowledge Base

## Current Architecture Status

### Communication Status
- ✅ **OpenCode → Telegram**: Working (sends events, notifications)
- ❌ **Telegram → OpenCode**: Disabled (polling disabled due to 409 conflicts)

**Reason**: Multiple plugin instances cause HTTP 409 conflicts when calling Telegram `getUpdates()`.

**Solution**: Use external webhook server for bidirectional communication (see README.md).

## Event Structure Reference

**OpenCode 레포itori 위치**: `../opencode/`
- 실제 OpenCode 이벤트 구조 확인
- `message.created`, `session.updated` 등 이벤트 패턴 분석

## Plugin Configuration

- **Telegram Chat ID**: 환경 변수 `TELEGRAM_CHAT_ID` 또는 `config.json` 에서 설정
- **Bot Token**: `config.json` 의 `telegram_bot_token`
- **Projects**: `config.json` 의 `projects` 배열

## Event Data Location

실제 이벤트 데이터는 `event.properties.info` 안에 있습니다:
```typescript
// ✅ 올바른 접근
const content = event.properties.info.request.content;
const status = event.properties.info.status;

// ❌ 잘못된 접근 (비어있음)
const content = event.payload.request.content;
```

## Git Workflow

**AGENTS.md 수정 후 반드시 커밋 & 푸시**:
- 이 파일에 변경사항이 있으면 즉시 `git add && git commit && git push`
- Git 히스토리를 **메모리처럼 사용** — 과거 작업 내용, 결정 사항, 이슈 해결 과정을 커밋 메시지와 히스토리에서 추적
- `git log --oneline -20` 또는 `git log -p AGENTS.md` 로 변경 이력 확인 가능

### 📝 Documentation Update Rule

**설계 변경 시 README.md 동시 업데이트**:
1. **AGENTS.md 수정 → README.md 업데이트 → 커밋 → 푸시** 순서로 진행
2. README.md 는 사용자를 위한 문서이므로 설계 변경과 항상 일치해야 함
3. 커밋 메시지에는 `docs:` 접두사 사용
4. 푸시 전에 반드시 두 파일 모두 확인

**예시**:
```bash
# 1. AGENTS.md 수정 완료
# 2. README.md 업데이트
# 3. 커밋
git add AGENTS.md README.md
git commit -m "docs: Update architecture documentation\n\n- Update AGENTS.md with new design\n- Sync README.md to match current architecture\n- Add external webhook server section"

# 4. 푸시 전에 확인
git show --stat

# 5. 푸시
git push
```

### ⚠️ **보안 경고: 민감한 정보 절대 커밋 금지**

**절대 Git 에 커밋하지 말 것**:
- ❌ Bot Token (`TELEGRAM_BOT_TOKEN`)
- ❌ API Keys, Secrets
- ❌ Passwords, Credentials
- ❌ Chat IDs (개인 정보일 수 있음)
- ❌ `.env` 파일
- ❌ `config.json` (토큰 포함 시)

**올바른 방법**:
- ✅ 환경 변수로 관리 (`process.env.TELEGRAM_BOT_TOKEN`)
- ✅ `.gitignore` 에 `.env`, `*.json` 추가
- ✅ 테스트 파일에 토큰 하드코딩 금지
- ✅ 실수하면 즉시 `git filter-repo` 로 히스토리 정화

**토큰이 노출되었을 때**:
1. `git filter-repo --invert-paths --path <파일명>` 로 히스토리 정화
2. `git push --force` 로 원격지 업데이트
3. Telegram BotFather 에서 새 토큰 재발행
4. 기존 토큰은 자동으로 무효화됨

## Debugging

콘솔 로그 확인:
```bash
[EventHandler] properties.info structure: {
  id: "...",
  sessionId: "...",
  hasRequest: true,
  requestContent: "...",
}
```

## Current Implementation Details

### Core Files
- `src/telegram-client.ts` - Telegram API 클라이언트 (BunShell 사용)
- `src/index.ts` - 플러그인 초기화 및 전역 상태 관리
- `src/config.ts` - 프로젝트명 생성
- `src/event-handler.ts` - 이벤트 포매팅 및 전송

### Key Components

**Global Registry**:
```typescript
const globalProjectRegistry = new Map<string, {
  projectName: string
  directory: string
  telegramClient: TelegramClient
  config: Config
  input: PluginInput
  chatIds: string[]
  latestSessionId: string | null
  projectContext: Map<string, any>
}>>()
```

**Polling Status**: DISABLED
- Multiple instances cause 409 conflicts
- Only first instance should poll (but currently disabled entirely)

**Event Handling**:
- Extract session_id from `event.properties.info`
- Format messages with project tags
- Send to Telegram via `telegramClient.sendMessage()`

## Problem History & Solutions

**문서 위치**: `HISTORY.md`

모든 문제와 해결 방법을 문서화했습니다:

### 주요 문제들

1. **HTTP 409 Infinite Loop** - 무한 충돌 루프
2. **HTTP 404 Not Found** - Bot 활성화 문제
3. **Only First Project Sends Message** - 모든 프로젝트 메시지 전송
4. **Project Name Underscore Removed** - 밑줄 보존
5. **MarkdownV2 Escaping Errors** - 이스케이프 에러
6. **Telegram Message Not Received** - 메시지 수신 복원
7. **BunShell .json() Parsing** - JSON 파싱 오류
8. **Multiple Instances Polling** - 409 충돌

### 빠른 참조

**환경 변수**:
- `TELEGRAM_BOT_TOKEN` - Bot 인증 토큰
- `TELEGRAM_CHAT_ID` - 대상 채팅 ID

**Bot 정보**:
- Username: `@mjkim_cc_bot`
- Chat ID: `7764331663`

**테스트 명령**:
```bash
# Bot 토큰 검증
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN bun run verify-bot.ts

# 빌드
bun run build

# 테스트
bun test
```

**현재 상태**:
- ✅ OpenCode → Telegram: Working
- ❌ Telegram → OpenCode: Disabled
- ✅ 409 에러: 해결 (polling 비활성화)

상세한 문제 증상, 근본 원인, 해결책은 `HISTORY.md` 를 참조하세요.

## Next Steps

### For Users
- Use plugin for **notifications only** (OpenCode → Telegram)
- For bidirectional communication, see **README.md → External Webhook Server**

### For Developers
- Fix multiple instance issue (share state across instances)
- Or implement external webhook server
- Update documentation when design changes
