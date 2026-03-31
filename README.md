# OpenCode Telegram Plugin

OpenCode 작업 완료 시 Telegram 으로 알림을 전송하는 플러그인입니다.

## Features

### 작업 완료 알림

작업이 완료되면 사용된 도구 목록과 변경 파일을 전송합니다:

```
[project-name] 작업 완료

🔧 사용된 도구 (5개):
  1. edit — src/index.ts
  2. bash — bun run build
  3. read — README.md
  4. edit — README.md
  5. bash — git push

📝 변경 파일 (2개):
• src/index.ts
• README.md

✅ 작업이 완료되었습니다.
```

### 선택 필요 알림

사용자 선택이 필요할 때 알림을 전송합니다:

```
[project-name] 선택 필요

⚠️ 작업을 계속하기 위해 선택이 필요합니다.
```

## Installation

### 1. 환경 변수 설정

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

### 2. 빌드

```bash
cd opencode_telegram_hook
bun install
bun run build
```

### 3. OpenCode 에 등록

`opencode.json` 또는 설정 파일에 플러그인 경로를 추가합니다:

```json
{
  "plugin": [
    "file:///path/to/opencode_telegram_hook/dist/index.js"
  ]
}
```

## Events & Hooks

### Events (via `event` handler)

| 이벤트 | 동작 |
|--------|------|
| `session.status (busy)` | 대기 중인 타이머 취소 (리포트는 누적 유지) |
| `session.status (idle)` | 완료 타이머 예약 (8초 debounce) |
| `session.idle` | 완료 타이머 예약 (fallback) |
| `session.updated` | 변경 파일 수집 (`info.summary.diffs`) |
| `permission.asked` / `question.asked` | 선택 필요 알림 |

### Hooks (별도 등록)

| 훅 | 동작 |
|----|------|
| `tool.execute.before` | 툴 사용 기록 |
| `config` | 연결 확인 알림 |

## Architecture

- 이벤트 기반 (폴링 없음)
- 단일 파일 구현
- 각 인스턴스 독립 동작
- `tool.execute.before`는 별도 훅으로 등록 (이벤트 아님)
- `session.updated`는 OpenCode 가 계산한 파일 diff 를 직접 수신 (`info.summary.diffs`)

### 작업 완료 감지 (Debounce)

도구 실행 사이사이에 `idle` 이벤트가 빈번히 발생하므로, 즉시 전송하지 않고 **8초 debounce**를 적용합니다:

1. **busy** → 타이머 취소 (리포트는 누적 유지 — 도구/파일 기록 계속)
2. **idle** → 8초 타이머 예약 (아직 보내지 않음)
3. idle 중에도 파일/툴 수집 계속됨
4. 8초 안에 다시 busy 오면 → 타이머 취소, 리포트는 그대로 유지 (다음 도구 기록 누적)
5. 8초 동안 idle 유지 → 최종 모아서 한 번에 전송 후 리포트 초기화

즉, 도구들이 연달아 실행되는 동안에는 타이머가 매번 리셋되고 리포트는 계속 누적되며, 진짜 완료(8초 이상 idle)될 때만 작업 내역을 한 번에 보냅니다.

### 세션 ID 필터링

OpenCode 이벤트의 `event.properties.info.id`는 세션 ID(`ses_xxx`) 뿐만 아니라 메시지 ID(`msg_xxx`)도 포함합니다. 메시지 ID를 세션으로 오인식하면 리포트가 매 이벤트마다 초기화되는 문제가 발생하므로, `ses_` 접두사로 시작하는 ID만 실제 세션으로 간주합니다.

```typescript
// ✅ Correct: ses_로 시작하는 ID만 세션으로 인식
if (rawID?.startsWith("ses_")) resetForSession(rawID)

// ❌ Wrong: msg_xxx도 세션으로 간주하여 리포트 초기화
if (sessionID) resetForSession(sessionID)
```

`tool.execute.before` 훅의 `input.sessionID`는 항상 `ses_` 형식이므로 추가 세션 추적에 활용합니다.

### 도구 입력값 요약

`tool.execute.before` 훅의 `output.args`에서 도구별 의미 있는 입력값을 추출하여 메시지에 포함합니다:

| 도구 | 표시 내용 |
|------|----------|
| `edit` / `write` / `read` | 파일 경로 |
| `bash` | 명령어 (80자 제한) |
| `glob` / `grep` | 검색 패턴 |
| `task` | 서브태스크 설명 |
| 기타 | 주요 인자 키 또는 첫 3개 필드명 |

### 파일 변경 추적

`session.diff`는 세션 전체의 누적 diff를 반환하므로 증분 변경이 아닙니다. 대신 `session.updated` 이벤트의 `info.summary.diffs`를 사용하여 파일 변경을 추적합니다.

## Troubleshooting

**알림이 안 오나요?**

1. `TELEGRAM_BOT_TOKEN` 과 `TELEGRAM_CHAT_ID` 가 설정되었는지 확인
2. `bun run build` 로 빌드가 되었는지 확인
3. 플러그인 경로가 올바른지 확인
