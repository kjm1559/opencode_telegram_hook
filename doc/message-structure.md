# OpenCode Event & Message Structure

OpenCode 의 이벤트와 메시지 데이터 구조에 대한 완전한 가이드입니다. 이 문서는 opencode_telegram_hook 플러그인 개발 및 디버깅에 필요한 정보를 제공합니다.

---

## 📑 목차

- [이벤트 구조 개요](#이벤트-구조-개요)
- [메시지 데이터 구조](#메시지-데이터-구조)
- [Part Types (메시지 내용)](#part-types-메시지-내용)
- [세션 이벤트 구조](#세션-이벤트-구조)
- [이벤트 접근 패턴](#이벤트-접근-패턴)
- [실무 예시](#실무-예시)
- [참고 자료](#참고-자료)

---

## 이벤트 구조 개요

OpenCode 는 모든 작업을 **이벤트**로 스트리밍합니다. 각 이벤트는 다음 구조를 가집니다:

```typescript
Event {
  type: string                    // 이벤트 타입 (예: "message.updated")
  properties: {                   // 실제 데이터
    info?: Message | Session      // 메타데이터 (이벤트 타입에 따라 다름)
    part?: Part                   // 메시지 내용 조각
    delta?: string                // 스트리밍 조각
    [custom fields]: any          // 이벤트별 커스텀 필드
  }
}
```

### 이벤트 타입 분류

| 카테고리 | 이벤트 타입 | 설명 |
|---------|----------|------|
| **메시지** | `message.updated` | 메시지 완료 시점 |
| | `message.part.updated` | 메시지 내용 (텍스트, 툴, 파일 등) |
| | `message.part.delta` | 실시간 스트리밍 조각 |
| | `message.removed` | 메시지 삭제 |
| **세션** | `session.updated` | 세션 정보 변경 |
| | `session.created` | 새 세션 생성 |
| | `session.deleted` | 세션 삭제 |
| **파일** | `file.edited` | 파일 편집 |
| **툴** | `tool.execute.before` | 툴 실행 전 |
| | `tool.execute.after` | 툴 실행 후 |
| **명령** | `command.executed` | 명령 실행 |

---

## 메시지 데이터 구조

메시지는 **메타데이터**와 **내용 (Parts)**으로 분리되어 있습니다.

### 1️⃣ Message (메타데이터)

**이벤트**: `message.updated`

```typescript
export type EventMessageUpdated = {
  type: "message.updated"
  properties: {
    info: Message  // UserMessage 또는 AssistantMessage
  }
}
```

#### UserMessage 구조

```typescript
export type UserMessage = {
  id: string              // 메시지 ID (예: "msg_abc123")
  sessionID: string       // 세션 ID
  role: "user"
  time: { created: number }           // 생성 타임스탬프 (ms)
  
  // 요약 정보 (요약된 버전)
  summary?: {
    title?: string        // 요약 제목
    body?: string         // 요약 본문
    diffs: Array<FileDiff> // 파일 변경 내역
  }
  
  // 에이전트 및 모델 설정
  agent: string           // 에이전트 이름 (예: "build")
  model: {               
    providerID: string    // 모델 제공자 (예: "anthropic")
    modelID: string       // 모델 ID (예: "claude-3-5-sonnet")
  }
  
  // 출력 포맷
  format?: {
    type: "text" | "json_schema"
    schema?: object
    retryCount?: number
  }
  
  // 기타
  system?: string         // 시스템 프롬트
  tools?: {              // 사용할 툴列表
    [key: string]: boolean
  }
  variant?: string        // 변형 ID
}
```

**주요 필드**:
- `id`: 메시지 고유 ID
- `summary.title`: 사용자 요청의 자동 요약 제목
- `summary.body`: 요약 본문
- `summary.diffs`: 변경된 파일 목록
- `agent`: 사용할 에이전트
- `model.providerID` / `modelID`: 모델 정보

---

#### AssistantMessage 구조

```typescript
export type AssistantMessage = {
  id: string              // 메시지 ID
  sessionID: string       // 세션 ID
  role: "assistant"
  time: {
    created: number        // 생성 타임스탬프
    completed?: number     // 완료 타임스탬프
  }
  
  // 오류 (발생 시)
  error?: 
    | ProviderAuthError
    | UnknownError
    | MessageOutputLengthError
    | MessageAbortedError
    | StructuredOutputError
    | ContextOverflowError
    | ApiError
    
  // 부모 메시지 (스레드 구조)
  parentID: string        // 부모 메시지 ID
  
  // 모델 정보
  modelID: string
  providerID: string
  mode: string           
  agent: string
  
  // 작업 경로
  path: {
    cwd: string          // 현재 작업 디렉토리
    root: string         // 루트 디렉토리
  }
  
  // 요약 여부 (true = 요약 필요)
  summary?: boolean
  
  // 비용 및 토큰
  cost: number           // 비용 (달러)
  tokens: {
    total?: number       // 총 토큰 수
    input: number        // 입력 토큰
    output: number       // 출력 토큰
    reasoning: number    // 추론 토큰
    cache: {
      read: number       // 캐시 읽기 토큰
      write: number      // 캐시 쓰기 토큰
    }
  }
  
  // 구조화된 출력
  structured?: unknown
  
  // 기타
  variant?: string
  finish?: string        // 종료 원인
}
```

**주요 필드**:
- `parentID`: 부모 메시지 ID (스레드 추적)
- `cost`: 이 메시지의 비용
- `.tokens`: 세부 토큰 정보
- `error`: 오류 발생 시 상세 정보
- `path.cwd`: 작업 디렉토리

---

#### FileDiff 구조

```typescript
export type FileDiff = {
  file: string           // 파일 경로
  before: string         // 변경 전 내용
  after: string          // 변경 후 내용
  additions: number      // 추가된 라인 수
  deletions: number      // 삭제된 라인 수
  status?: "added" | "deleted" | "modified"
}
```

---

### 2️⃣ Part (메시지 실제 내용)

**중요**: 메시지의 실제 텍스트, 툴 호출, 파일 등은 **Part** 객체로 나뉩니다.

**이벤트**: `message.part.updated`

```typescript
export type EventMessagePartUpdated = {
  type: "message.part.updated"
  properties: {
    part: Part  // Part 타입의 유니온
  }
}
```

---

## Part Types (메시지 내용)

Part 는 메시지 내용을 구성하는 여러 타입의 유니온입니다:

```typescript
export type Part =
  | TextPart           // 일반 텍스트
  | SubtaskPart        // 서브태스크
  | ReasoningPart      // 추론 과정
  | FilePart           // 첨부 파일
  | ToolPart           // 툴 호출
  | StepStartPart      // 단계 시작
  | StepFinishPart     // 단계 종료
  | SnapshotPart       // 스냅샷
  | PatchPart          // 패치
  | AgentPart          // 에이전트 정보
  | RetryPart          // 재시도
  | CompactionPart     // 컴팩트
```

### TextPart (가장 중요!)

```typescript
export type TextPart = {
  id: string           // Part ID
  sessionID: string    // 세션 ID
  messageID: string    // 메시지 ID
  type: "text"
  
  text: string         // ⭐ 실제 텍스트 내용 ⭐
  
  synthetic?: boolean  // AI 가 자동 생성했는가
  ignored?: boolean    // 무시할지 여부
  time?: {
    start: number      // 시작 시간
    end?: number       // 끝 시간
  }
  metadata?: {
    [key: string]: unknown
  }
}
```

**사용법**:
```typescript
if (event.type === "message.part.updated") {
  const part = event.properties.part
  
  if (part.type === "text") {
    const actualMessage = part.text  // 실제 메시지 내용
    console.log("메시지:", actualMessage)
  }
}
```

---

### ReasoningPart (추론 과정)

```typescript
export type ReasoningPart = {
  id: string
  sessionID: string
  messageID: string
  type: "reasoning"
  
  text: string         // 추론 내용
  metadata?: object
  time: {
    start: number
    end?: number
  }
}
```

**예시 출력**:
```
[Reasoning] Analyzing the codebase structure...
[Reasoning] Found auth.ts in src/ directory
[Reasoning] JWT implementation requires crypto library
```

---

### ToolPart (툴 호출)

```typescript
export type ToolPart = {
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  
  callID: string       // 툴 호출 ID
  tool: string         // 툴 이름 ("edit", "bash", "write" 등)
  state: ToolState     // 상태 (pending → running → completed | error)
  metadata?: object
}
```

#### ToolState (상태 머신)

**1. pending 상태**
```typescript
export type ToolStatePending = {
  status: "pending"
  input: { [key: string]: unknown }  // 툴 입력 파라미터
  raw: string                        // 원본 스트링
}
```

**2. running 상태**
```typescript
export type ToolStateRunning = {
  status: "running"
  input: { [key: string]: unknown }
  title?: string                     // 제목
  metadata?: object
  time: { start: number }
}
```

**3. completed 상태**
```typescript
export type ToolStateCompleted = {
  status: "completed"
  input: { [key: string]: unknown }   // 입력
  output: string                      // ⭐ 실행 결과 ⭐
  title: string
  metadata: object
  time: {
    start: number
    end: number
    compacted?: number
  }
  attachments?: Array<FilePart>       // 출력 파일들
}
```

**4. error 상태**
```typescript
export type ToolStateError = {
  status: "error"
  input: { [key: string]: unknown }
  error: string                      // ⭐ 오류 메시지 ⭐
  metadata?: object
  time: {
    start: number
    end: number
  }
}
```

**사용법**:
```typescript
if (part.type === "tool") {
  console.log(`툴: ${part.tool}`)
  
  const state = part.state
  
  if (state.status === "running") {
    console.log("실행 중...")
  } else if (state.status === "completed") {
    console.log("결과:", state.output)
  } else if (state.status === "error") {
    console.log("오류:", state.error)
  }
}
```

---

### FilePart (첨부 파일)

```typescript
export type FilePart = {
  id: string
  sessionID: string
  messageID: string
  type: "file"
  
  mime: string         // MIME 타입 (예: "image/png")
  url: string          // 데이터 URL (base64)
  filename?: string    // 파일명
  source?: FilePartSource  // 소스 정보
}
```

**사용법**:
```typescript
if (part.type === "file") {
  const filename = part.filename
  const content = part.url  // data:image/png;base64,...
  
  console.log(`파일: ${filename} (${part.mime})`)
}
```

---

### StepFinishPart (단계 완료)

```typescript
export type StepFinishPart = {
  id: string
  sessionID: string
  messageID: string
  type: "step-finish"
  
  reason: string       // 완료 이유
  snapshot?: string    // 스냅샷
  cost: number        // 단계 비용
  tokens: {
    total?: number
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
}
```

**사용법**:
```typescript
if (part.type === "step-finish") {
  console.log(`단계 완료: $${part.cost}, ${part.tokens.output} 토큰`)
}
```

---

## 세션 이벤트 구조

### session.updated

세션信息이 변경될 때 발생하는 이벤트:

```typescript
export type EventSessionUpdated = {
  type: "session.updated"
  properties: {
    info: Session
  }
}
```

#### Session 구조

```typescript
export type Session = {
  id: string              // 세션 ID (예: "ses_abc123")
  slug: string           // URL 슬러그
  projectID: string      // 프로젝트 ID
  workspaceID?: string   // 워크스페이스 ID (옵션)
  directory: string      // 절대 경로
  parentID?: string      // 부모 세션 ID (옵션)
  
  title: string          // 세션 제목
  version: string        // 스키마 버전
  
  // 요약 정보
  summary?: {
    additions: number    // 추가된 라인 수
    deletions: number    // 삭제된 라인 수
    files: number        // 변경된 파일 수
    diffs?: Array<FileDiff>  // 상세 diff
  }
  
  // 공유 (옵션)
  share?: {
    url: string         // 공유 URL
  }
  
  // 타임스탬프
  time: {
    created: number     // 생성 타임스탬프
    updated: number     //最后 업데이트
    compacting?: number  // 컴팩트 시작
    archived?: number   // 아카이브
  }
  
  // 권한 (옵션)
  permission?: PermissionRuleset
  
  // 되돌림 정보 (옵션)
  revert?: {
    messageID: string
    partID?: string
    snapshot?: string
    diff?: string
  }
}
```

**주요 필드**:
- `directory`: 프로젝트 절대 경로
- `id`: 세션 ID
- `title`: 세션 제목
- `summary.additions` / `deletions`: 총 변경 라인
- `summary.files`: 변경된 파일 수
- `summary.diffs`: 각 파일의 상세 변경 내역
- `time.updated`:最后 업데이트 시간
- `parentID`: 부모 세션 (하위 세션 판단)

---

## 이벤트 접근 패턴

### 1️⃣ 메시지 메타데이터 접근

```typescript
// message.updated 이벤트
if (event.type === "message.updated") {
  const messageInfo = event.properties.info
  
  // 사용자 메시지인지 확인
  if (messageInfo.role === "user") {
    const summaryTitle = messageInfo.summary?.title
    const summaryBody = messageInfo.summary?.body
    console.log("사용자 요청:", summaryTitle, summaryBody)
  }
  
  // 어시스턴트 메시지
  if (messageInfo.role === "assistant") {
    const cost = messageInfo.cost
    const tokens = messageInfo.tokens?.total
    console.log("비용:", cost, "토큰:", tokens)
  }
}
```

### 2️⃣ 메시지 내용 접근

```typescript
// message.part.updated 이벤트
if (event.type === "message.part.updated") {
  const part = event.properties.part
  
  // 텍스트 내용
  if (part.type === "text") {
    const text = part.text
    console.log("메시지 내용:", text)
  }
  
  // 툴 호출
  if (part.type === "tool") {
    const toolName = part.tool
    const state = part.state
    
    if (state.status === "completed") {
      const output = state.output
      console.log("툴 결과:", output)
    }
  }
  
  // 첨부 파일
  if (part.type === "file") {
    console.log("파일:", part.filename, part.url)
  }
}
```

### 3️⃣ 실시간 스트리밍

```typescript
// message.part.delta 이벤트 (실시간 조각)
if (event.type === "message.part.delta") {
  const partID = event.properties.partID
  const field = event.properties.field  // "text" 등
  const delta = event.properties.delta  // 조각
  
  if (field === "text") {
    appendToStream(delta)  // 스트림에 추가
  }
}
```

### 4️⃣ 세션 정보 접근

```typescript
// session.updated 이벤트
if (event.type === "session.updated") {
  const sessionInfo = event.properties.info
  
  console.log("세션:", sessionInfo.id)
  console.log("제목:", sessionInfo.title)
  console.log("경로:", sessionInfo.directory)
  
  // 변경 사항
  if (sessionInfo.summary) {
    console.log(
      `파일: ${sessionInfo.summary.files}, 
      추가: ${sessionInfo.summary.additions}, 
      삭제: ${sessionInfo.summary.deletions}`
    )
  }
  
  // 파일별 상세
  if (sessionInfo.summary?.diffs) {
    sessionInfo.summary.diffs.forEach(d => {
      console.log(`📄 ${d.file}: +${d.additions} -${d.deletions}`)
    })
  }
}
```

---

## 실무 예시

### 사용자 입력 처리

```typescript
// 1. message.updated (메타데이터)
if (event.type === "message.updated" && event.properties.info.role === "user") {
  const info = event.properties.info
  
  const title = info.summary?.title
  const body = info.summary?.body
  
  await sendTelegram(`📝 요청: ${title || body}`)
}

// 2. message.part.updated (실제 내용)
if (event.type === "message.part.updated") {
  const part = event.properties.part
  
  if (part.type === "text" && !part.synthetic) {
    await sendTelegram(`👤 사용자: ${part.text}`)
  }
}
```

---

### AI 응답 모니터링

```typescript
// AI 응답 시작
if (event.type === "message.part.updated") {
  const part = event.properties.part
  
  if (part.type === "reasoning") {
    await sendTelegram(`🤔 생각하는 중: ${part.text}`)
  }
  
  if (part.type === "tool" && part.state.status === "running") {
    await sendTelegram(`⚙️ 툴 실행: ${part.tool}`)
  }
}

// 툴 결과
if (part.type === "tool" && part.state.status === "completed") {
  const output = part.state.output
  await sendTelegram(`✅ 툴 완료: ${output.substring(0, 100)}`)
}

// 툴 오류
if (part.type === "tool" && part.state.status === "error") {
  await sendTelegram(`❌ 툴 오류: ${part.state.error}`)
}
```

---

### 파일 편집 추적

```typescript
// session.updated 로 총 변경 사항 확인
if (event.type === "session.updated") {
  const info = event.properties.info
  
  if (info.summary?.files > 0) {
    let message = `📊 작업 완료\n`
    message += `파일: ${info.summary.files}\n`
    message += `추가: +${info.summary.additions}\n`
    message += `삭제: -${info.summary.deletions}\n\n`
    
    // 각 파일 상세
    if (info.summary.diffs) {
      message += `**변경 파일:**\n`
      info.summary.diffs.forEach(d => {
        message += `- ${d.file}\n`
        message += `  ${d.status || 'modified'}`
      })
    }
    
    await sendTelegram(message)
  }
}
```

---

## 참고 자료

### 원천 파일 위치

- **타입 정의**: `/opencode/packages/sdk/js/src/v2/gen/types.gen.ts`
- **메시지/Part 스키마**: `/opencode/packages/opencode/src/session/message-v2.ts`
- **SQL 스키마**: `/opencode/packages/opencode/src/session/session.sql.ts`

### 관련 문서

- [Event Types Reference](./event-types-reference.md) - 모든 이벤트 타입 목록
- [README.md](../README.md) - 플러그인 사용법

---

## 변경 로그

### v0.1.0 (2026-03-27)

- 초기 버전 생성
- `message.updated`, `message.part.updated` 구조 문서화
- 세션 이벤트 구조 추가
- 실무 예시 제공

---

**최종 업데이트**: 2026-03-27
