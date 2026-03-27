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
