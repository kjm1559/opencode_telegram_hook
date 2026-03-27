# Event Types Reference

OpenCode 의 모든 이벤트 타입과 필드 매핑에 대한 완전한 참조 문서입니다.

---

## 📑 목차

- [이벤트 구조 패턴](#이벤트-구조-패턴)
- [메시지 이벤트](#메시지-이벤트)
- [세션 이벤트](#세션-이벤트)
- [파일 이벤트](#파일-이벤트)
- [툴 이벤트](#툴-이벤트)
- [명령 이벤트](#명령-이벤트)
- [전용 필드 매핑](#전용-필드-매핑)

---

## 이벤트 구조 패턴

모든 이벤트는 다음 패턴을 따릅니다:

```typescript
type Event = {
  type: string              // 이벤트 타입 (고정 문자열)
  properties: {             // 이벤트별 데이터
    [key: string]: any      // 타입에 따라 다른 필드
  }
}
```

**접근 방법**:
```typescript
// 이벤트 타입 확인
if (event.type === "message.updated") {
  // 타입 안전한 접근
  const info = event.properties.info
}
```

---

## 메시지 이벤트

### message.updated

**목적**: 메시지가 완료되었을 때 발생

**타입**:
```typescript
type EventMessageUpdated = {
  type: "message.updated"
  properties: {
    info: Message  // UserMessage | AssistantMessage
  }
}
```

**필드**:
| 필드 | 타입 | 설명 | 예시 |
|-----|------|----|-----|
| `info.id` | string | 메시지 ID | `msg_abc123` |
| `info.sessionID` | string | 세션 ID | `ses_xyz789` |
| `info.role` | "user" \| "assistant" | 역할 | `"user"` |
| `info.time.created` | number | 생성 시간 (ms) | `1711234567890` |

#### UserMessage 전용 필드

| 필드 | 타입 | 설명 | 예시 |
|-----|------|----|-----|
| `info.summary?.title` | string | 요약 제목 | `"JWT 인증 추가"` |
| `info.summary?.body` | string | 요약 본문 | `"src/auth.ts 수정"` |
| `info.summary?.diffs` | FileDiff[] | 변경 파일 | `[...]` |
| `info.agent` | string | 에이전트 | `"build"` |
| `info.model.providerID` | string | 모델 제공자 | `"anthropic"` |
| `info.model.modelID` | string | 모델 ID | `"claude-3-5-sonnet"` |

#### AssistantMessage 전용 필드

| 필드 | 타입 | 설명 | 예시 |
|-----|------|----|-----|
| `info.parentID` | string | 부모 메시지 ID | `msg_parent123` |
| `info.cost` | number | 비용 (달러) | `0.05` |
| `info.tokens.total` | number | 총 토큰 | `1500` |
| `info.tokens.input` | number | 입력 토큰 | `1200` |
| `info.tokens.output` | number | 출력 토큰 | `300` |
| `info.tokens.reasoning` | number | 추론 토큰 | `200` |
| `info.path.cwd` | string | 작업 디렉토리 | `/home/project` |
| `info.error` | Error | 오류 (선택적) | `{...}` |

---

### message.part.updated

**목적**: 메시지 내용 (Part) 이 업데이트되었을 때 발생

**타입**:
```typescript
type EventMessagePartUpdated = {
  type: "message.part.updated"
  properties: {
    part: Part  // Part 타입의 유니온
  }
}
```

**Part 유형**: 
- `text` - 일반 텍스트
- `reasoning` - 추론 과정
- `tool` - 툴 호출
- `file` - 첨부 파일
- `step-start` / `step-finish` - 단계 마커
- `agent` - 에이전트 정보
- 기타

**텍스트 내용 접근**:
```typescript
if (event.properties.part.type === "text") {
  const text = event.properties.part.text
}
```

---

### message.part.delta

**목적**: 실시간 스트리밍 조각 전송

**타입**:
```typescript
type EventMessagePartDelta = {
  type: "message.part.delta"
  properties: {
    sessionID: string
    messageID: string
    partID: string
    field: string       // 변경된 필드 (예: "text")
    delta: string       // 조각 내용
  }
}
```

**예시**:
```json
{
  "type": "message.part.delta",
  "properties": {
    "sessionID": "ses_abc123",
    "messageID": "msg_xyz789",
    "partID": "part_001",
    "field": "text",
    "delta": "Hello"
  }
}
```

---

### message.removed

**목적**: 메시지가 삭제되었을 때

**타입**:
```typescript
type EventMessageRemoved = {
  type: "message.removed"
  properties: {
    sessionID: string
    messageID: string
  }
}
```

---

### message.voted

**목적**: 메시지에 투표

**타입**:
```typescript
type EventMessageVoted = {
  type: "message.voted"
  properties: {
    sessionID: string
    messageID: string
    vote: "up" | "down"
  }
}
```

---

### message.compacted

**목적**: 메시지가 압축되었을 때

**타입**:
```typescript
type EventMessageCompacted = {
  type: "message.compacted"
  properties: {
    sessionID: string
    messageID: string
    parts: {
      id: string
      type: string
    }[]
  }
}
```

---

### message.archived

**목적**: 메시지가 아카이브되었을 때

**타입**:
```typescript
type EventMessageArchived = {
  type: "message.archived"
  properties: {
    sessionID: string
    messageID: string
  }
}
```

---

## 세션 이벤트

### session.updated

**목적**: 세션 정보 변경

**타입**:
```typescript
type EventSessionUpdated = {
  type: "session.updated"
  properties: {
    info: Session
  }
}
```

**필드**: 
| 필드 | 타입 | 설명 | 예시 |
|-----|------|----|-----|
| `info.id` | string | 세션 ID | `ses_abc123` |
| `info.slug` | string | URL 슬러그 | `abc123-def456` |
| `info.directory` | string | 작업 디렉토리 | `/home/project` |
| `info.title` | string | 세션 제목 | `"JWT 인증 추가"` |
| `info.parentID` | string? | 부모 세션 | `ses_parent` |
| `info.summary.files` | number | 변경 파일 수 | `5` |
| `info.summary.additions` | number | 추가 라인 | `120` |
| `info.summary.deletions` | number | 삭제 라인 | `30` |
| `info.summary.diffs` | FileDiff[] | 상세 diff | `[...]` |
| `info.share.url` | string? | 공유 URL | `https://...` |
| `info.time.created` | number | 생성 시간 | `1711234567890` |
| `info.time.updated` | number | 업데이트 시간 | `1711234999999` |

---

### session.created

**목적**: 새 세션 생성

**타입**:
```typescript
type EventSessionCreated = {
  type: "session.created"
  properties: {
    info: Session
  }
}
```

---

### session.deleted

**목적**: 세션 삭제

**타입**:
```typescript
type EventSessionDeleted = {
  type: "session.deleted"
  properties: {
    id: string
  }
}
```

---

### session.completed

**목적**: 세션 완료

**타입**:
```typescript
type EventSessionCompleted = {
  type: "session.completed"
  properties: {
    id: string
  }
}
```

---

### session.started

**목적**: 세션 시작

**타입**:
```typescript
type EventSessionStarted = {
  type: "session.started"
  properties: {
    id: string
  }
}
```

---

## 파일 이벤트

### file.edited

**목적**: 파일 편집

**타입**:
```typescript
type EventFileEdited = {
  type: "file.edited"
  properties: {
    file: string  // 파일 경로
  }
}
```

**예시**:
```json
{
  "type": "file.edited",
  "properties": {
    "file": "src/auth.ts"
  }
}
```

---

## 툴 이벤트

### tool.execute.before

**목적**: 툴 실행 전

**타입**:
```typescript
type EventToolExecuteBefore = {
  type: "tool.execute.before"
  properties: {
    callID: string
    tool: string
    description: string
    input: Record<string, any>
  }
}
```

---

### tool.execute.after

**목적**: 툴 실행 후

**타입**:
```typescript
type EventToolExecuteAfter = {
  type: "tool.execute.after"
  properties: {
    callID: string
    tool: string
    description: string
    output: string      // 실행 결과
    input: Record<string, any>
  }
}
```

---

## 명령 이벤트

### command.executed

**목적**: 명령 실행

**타입**:
```typescript
type EventCommandExecuted = {
  type: "command.executed"
  properties: {
    command: string
    input: Record<string, any>
    output: string
    error?: string
  }
}
```

---

## 전용 필드 매핑

### FileDiff 구조

```typescript
type FileDiff = {
  file: string          // 파일 경로
  before: string        // 변경 전
  after: string         // 변경 후
  additions: number     // 추가 라인
  deletions: number     // 삭제 라인
  status?: "added" | "deleted" | "modified"
}
```

---

### Part Type별 필드

#### TextPart

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string          // ⭐ 실제 텍스트
  synthetic?: boolean
  ignored?: boolean
  time?: { start: number, end: number }
}
```

---

#### ToolPart

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string
  tool: string          // 툴 이름
  state: {              // 상태 머신
    status: "pending" | "running" | "completed" | "error"
    input: object       // 입력
    output?: string     // 결과 (completed)
    error?: string      // 오류 (error)
    time: { start: number, end?: number }
  }
}
```

**상태별 접근**:
```typescript
const state = part.state

if (state.status === "running") {
  console.log("실행 중")
}

if (state.status === "completed") {
  console.log("결과:", state.output)
}

if (state.status === "error") {
  console.log("오류:", state.error)
}
```

---

#### FilePart

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "file"
  mime: string          // MIME 타입
  url: string           // data URL (base64)
  filename?: string
  source?: { ... }
}
```

---

## 이벤트 처리 예시

### 필터로 특정 이벤트만 처리

```typescript
function handleEvent(event: Event) {
  switch (event.type) {
    case "message.updated":
      handleMessageUpdated(event.properties.info)
      break
    
    case "message.part.updated":
      handleMessagePartUpdated(event.properties.part)
      break
    
    case "session.updated":
      handleSessionUpdated(event.properties.info)
      break
    
    case "file.edited":
      handleFileEdited(event.properties.file)
      break
    
    // 기타 이벤트...
  }
}
```

---

### 이벤트 타입 필터링

```typescript
const interestedEvents = [
  "message.updated",
  "message.part.updated",
  "session.updated",
  "file.edited"
]

if (interestedEvents.includes(event.type)) {
  processEvent(event)
}
```

---

## 참고

### 원천 타입 정의

`/opencode/packages/sdk/js/src/v2/gen/types.gen.ts`

```bash
grep "export type Event" /path/to/types.gen.ts
```

### 이벤트 생성 위치

`/opencode/packages/opencode/src/session/` - 메시지/세션 로직

---

## 변경 로그

### v0.1.0 (2026-03-27)

- 기본 이벤트 타입 목록 추가
- 필드 매핑 정리

---

**최종 업데이트**: 2026-03-27

**관련 문서**:
- [메시지 구조 가이드](./message-structure.md)
- [README](../README.md)
