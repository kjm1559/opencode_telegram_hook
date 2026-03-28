# Project Knowledge Base

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

**수정된 파일**:
- `src/telegram-client.ts` - 핵심 Telegram API 클라이언트
- `src/index.ts` - 플러그인 초기화 및 전역 상태
- `src/config.ts` - 프로젝트명 생성
- `src/event-handler.ts` - 이벤트 포매팅

상세한 문제 증상, 근본 원인, 해결책은 `HISTORY.md` 를 참조하세요.
