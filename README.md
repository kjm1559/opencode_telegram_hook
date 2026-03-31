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
| `session.status (busy)` | 상태 초기화 |
| `session.status (idle)` | 완료 감지 → 메시지 전송 |
| `session.idle` | 완료 감지 (fallback) |
| `session.diff` | 변경 파일 수집 |
| `file.edited` | 개별 파일 변경 추적 (fallback) |
| `permission.asked` / `question.asked` | 선택 필요 알림 |

### Hooks (별도 등록)

| 훅 | 동작 |
|----|------|
| `tool.execute.before` | 툴 사용 기록 |
| `config` | 연결 확인 알림 |

## Architecture

- 이벤트 기반 (폴링 없음)
- 단일 파일 구현 (4.82 KB)
- 각 인스턴스 독립 동작
- `tool.execute.before`는 별도 훅으로 등록 (이벤트 아님)
- `session.diff`는 OpenCore 가 계산한 파일 diff 를 직접 수신

## Troubleshooting

**알림이 안 오나요?**

1. `TELEGRAM_BOT_TOKEN` 과 `TELEGRAM_CHAT_ID` 가 설정되었는지 확인
2. `bun run build` 로 빌드가 되었는지 확인
3. 플러그인 경로가 올바른지 확인
