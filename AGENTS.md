# Working Guidelines

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
git commit -m "docs: Update architecture documentation\n\n- Update AGENTS.md with new design\n- Sync README.md to match current architecture"

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

## Event Structure Reference

**OpenCode 레포지토리 위치**: `../opencode/`
- 실제 OpenCode 이벤트 구조 확인
- `message.created`, `session.updated` 등 이벤트 패턴 분석

### Event Data Location

실제 이벤트 데이터는 `event.properties.info` 안에 있습니다:
```typescript
// ✅ 올바른 접근
const content = event.properties.info.request.content;
const status = event.properties.info.status;

// ❌ 잘못된 접근 (비어있음)
const content = event.payload.request.content;
```

## Plugin Configuration

- **Telegram Chat ID**: 환경 변수 `TELEGRAM_CHAT_ID` 또는 `config.json` 에서 설정
- **Bot Token**: `config.json` 의 `telegram_bot_token`
- **Projects**: `config.json` 의 `projects` 배열

## Testing

```bash
# Bot 토큰 검증
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN bun run verify-bot.ts

# 빌드
bun run build

# 테스트
bun test
```

## Problem History

상세한 문제 및 해결사는 `HISTORY.md` 를 참조하세요.
