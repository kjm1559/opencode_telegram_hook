# OpenCode Telegram Plugin

OpenCode 작업 완료 및 선택 필요 시 텔레그램으로 작업 요약과 함께 알림을 보내는 플러그인.

## 기능

### 작업 완료 알림 (요약 포함)
```
[project-name] 작업 완료

프로젝트: project-name
작업 시작
제목: 작업 제목
• 작업 단계 1
• 작업 단계 2

✅ 작업이 완료되었습니다.
```

### 선택 필요 알림 (요약 포함)
```
[project-name] 선택 필요

프로젝트: project-name
작업 시작
제목: 작업 제목
• 작업 단계 1

⚠️ 작업 진행을 위해 선택이 필요합니다.
```

## 설치

### 설정

```bash
# 환경 변수 설정
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

### OpenCode 등록

```json
{
  "plugin": [
    "file:///path/to/opencode_telegram_hook/dist/index.js"
  ]
}
```

### 빌드

```bash
cd opencode_telegram_hook
bun install
bun run build
```

## 사용

1. 환경 변수 설정
2. 플러그인 빌드
3. OpenCode 에서 플러그인 등록
4. 작업 시작

작업 완료 시 또는 선택 필요 시 텔레그램으로 알림이 전송됩니다.

## 아키텍처

- 각 인스턴스 독립적 작동
- 이벤트 드리븐 (polling 없음)
- Telegram API 직접 호출
- 락 없음, 상태 관리 없음

## 이벤트

### session.completed / session.finished
작업 완료 시 알림 전송

### permission.ask / command.execute.before
선택 필요 시 알림 전송
