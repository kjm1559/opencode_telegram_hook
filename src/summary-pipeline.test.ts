import { describe, test, expect, mock } from 'bun:test'
import { getSummaryFromEvent, type WorkSummary } from './summary-accessor'
import { formatCompletionMessage, formatChoiceMessage } from './message-formatter'

describe('summary pipeline: event → extract → format', () => {
  test('message.updated with diffs → completion message', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: 'Fix README',
            body: 'Updated installation instructions',
            diffs: [{ file: 'README.md', changes: '+5 -2' }]
          }
        }
      }
    }

    const summary = getSummaryFromEvent(event)
    expect(summary).not.toBeNull()
    expect(summary!.body).toBe('Updated installation instructions')

    const message = formatCompletionMessage(summary!, 'my-project')
    expect(message).toContain('[my-project] 작업 완료')
    expect(message).toContain('Updated installation instructions')
    expect(message).toContain('✅ 작업이 완료되었습니다.')
  })

  test('message.updated without body → fallback to diffs list', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: 'Refactor',
            diffs: [
              { file: 'src/index.ts' },
              { file: 'src/utils.ts' },
              { file: 'src/types.ts' }
            ]
          }
        }
      }
    }

    const summary = getSummaryFromEvent(event)
    expect(summary).not.toBeNull()
    expect(summary!.body).toBeUndefined()

    // Simulate index.ts fallback logic
    if (!summary!.body && summary!.diffs?.length) {
      summary!.body = `변경 파일 ${summary!.diffs.length}개:\n${summary!.diffs.map((d: any) => `- ${d.file}`).join('\n')}`
    }
    expect(summary!.body).toContain('변경 파일 3개')
    expect(summary!.body).toContain('src/index.ts')
    expect(summary!.body).toContain('src/utils.ts')
    expect(summary!.body).toContain('src/types.ts')

    const message = formatCompletionMessage(summary!, 'my-project')
    expect(message).toContain('[my-project] 작업 완료')
    expect(message).toContain('변경 파일 3개')
    expect(message).toContain('✅ 작업이 완료되었습니다.')
  })

  test('session.updated with stats → completion message', () => {
    const event = {
      type: 'session.updated',
      properties: {
        info: {
          summary: {
            additions: 150,
            deletions: 30,
            files: 5,
            diffs: [
              { file: 'src/a.ts' },
              { file: 'src/b.ts' }
            ]
          }
        }
      }
    }

    const summary = getSummaryFromEvent(event)
    expect(summary).not.toBeNull()
    expect(summary!.additions).toBe(150)
    expect(summary!.deletions).toBe(30)
    expect(summary!.files).toBe(5)

    // Simulate fallback
    if (!summary!.body && summary!.diffs?.length) {
      summary!.body = `변경 파일 ${summary!.diffs.length}개:\n${summary!.diffs.map((d: any) => `- ${d.file}`).join('\n')}`
    }

    const message = formatCompletionMessage(summary!, 'my-project')
    expect(message).toContain('[my-project] 작업 완료')
    expect(message).toContain('변경 파일 2개')
    expect(message).toContain('✅ 작업이 완료되었습니다.')
  })

  test('event with no summary → fallback completion message', () => {
    const event = {
      type: 'message.updated',
      properties: { info: {} }
    }

    const summary = getSummaryFromEvent(event)
    expect(summary).toBeNull()

    const message = formatCompletionMessage({} as WorkSummary, 'my-project')
    expect(message).toBe(`<b>[my-project] 작업 완료</b>\n\n\n✅ 작업이 완료되었습니다.`)
  })

  test('choice required with summary → formatted message', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: 'Decision',
            body: 'Choose between option A and B',
            diffs: [{ file: 'src/config.ts' }]
          }
        }
      }
    }

    const summary = getSummaryFromEvent(event)
    expect(summary).not.toBeNull()

    const message = formatChoiceMessage(summary!, 'my-project')
    expect(message).toContain('[my-project] 선택 필요')
    expect(message).toContain('Choose between option A and B')
    expect(message).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('choice required without summary → fallback message', () => {
    const message = formatChoiceMessage({} as WorkSummary, 'my-project')
    expect(message).toBe(`<b>[my-project] 선택 필요</b>\n\n\n⚠️ 작업을 계속하기 위해 선택이 필요합니다.`)
  })

  test('HTML escaping in summary body', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            body: 'Fixed <script> injection in handler',
            diffs: [{ file: '<evil>.ts' }]
          }
        }
      }
    }

    const summary = getSummaryFromEvent(event)
    const message = formatCompletionMessage(summary!, 'test')
    expect(message).not.toContain('<script>')
    expect(message).toContain('&lt;script&gt;')
  })

  test('full pipeline: extract → fallback → format', () => {
    // Simulate real event flow from index.ts
    let workSummary: WorkSummary | null = null
    let pendingCompletion = false

    // Step 1: session.status (idle)
    pendingCompletion = true

    // Step 2: message.updated arrives with diffs but no body
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            diffs: [{ file: 'src/main.ts' }, { file: 'src/helper.ts' }]
          }
        }
      }
    }

    const summary = getSummaryFromEvent(event)
    if (summary) {
      if (!summary.body && summary.diffs?.length) {
        summary.body = `변경 파일 ${summary.diffs.length}개:\n${summary.diffs.map((d: any) => `- ${d.file}`).join('\n')}`
      }
      workSummary = summary
    }

    // Step 3: pendingCompletion + workSummary → send
    expect(pendingCompletion).toBe(true)
    expect(workSummary).not.toBeNull()
    expect(workSummary!.body).toContain('변경 파일 2개')

    const message = formatCompletionMessage(workSummary!, 'test-project')
    expect(message).toContain('[test-project] 작업 완료')
    expect(message).toContain('변경 파일 2개')
    expect(message).toContain('src/main.ts')
    expect(message).toContain('src/helper.ts')
    expect(message).toContain('✅ 작업이 완료되었습니다.')
  })
})
