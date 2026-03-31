import { describe, test, expect } from 'bun:test'
import { formatCompletionMessage, formatChoiceMessage, escapeHtml } from './message-formatter'
import type { WorkSummary } from './summary-accessor'

describe('escapeHtml', () => {
  test('escapes < character', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  test('escapes > character', () => {
    expect(escapeHtml('</script>')).toBe('&lt;/script&gt;')
  })

  test('escapes & character', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  test('escapes multiple characters', () => {
    expect(escapeHtml('<a>&b</a>')).toBe('&lt;a&gt;&amp;b&lt;/a&gt;')
  })

  test('handles normal text', () => {
    expect(escapeHtml('normal text')).toBe('normal text')
  })

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  test('handles null', () => {
    expect(escapeHtml(null as unknown as string)).toBe('')
  })

  test('handles undefined', () => {
    expect(escapeHtml(undefined as unknown as string)).toBe('')
  })

  test('preserves whitespace', () => {
    expect(escapeHtml('  text  ')).toBe('  text  ')
  })
})

describe('formatCompletionMessage', () => {
  const fullSummary: WorkSummary = {
    body: 'Implemented the new feature with all requirements'
  }

  test('formats completion message with body', () => {
    const result = formatCompletionMessage(fullSummary, 'test-project')

    expect(result).toContain('[test-project] 작업 완료')
    expect(result).toContain('Implemented the new feature with all requirements')
    expect(result).toContain('✅ 작업이 완료되었습니다.')
  })

  test('formats completion message without body', () => {
    const summary: WorkSummary = {}
    const result = formatCompletionMessage(summary, 'my-project')

    expect(result).toContain('[my-project] 작업 완료')
    expect(result).toContain('✅ 작업이 완료되었습니다.')
  })

  test('formats completion message with empty body', () => {
    const summary: WorkSummary = {
      body: ''
    }
    const result = formatCompletionMessage(summary, 'my-project')

    expect(result).toContain('[my-project] 작업 완료')
    expect(result).toContain('✅ 작업이 완료되었습니다.')
  })

  test('escapes HTML in body', () => {
    const summary: WorkSummary = {
      body: 'Body with <b>bold</b> text'
    }
    const result = formatCompletionMessage(summary, 'test-project')
    expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })

  test('escapes HTML in project name', () => {
    const summary: WorkSummary = {
      body: 'Some body'
    }
    const result = formatCompletionMessage(summary, '<b>Project</b>')
    expect(result).toContain('&lt;b&gt;Project&lt;/b&gt;')
  })

  test('message structure has correct format', () => {
    const summary: WorkSummary = {
      body: 'Test body'
    }
    const result = formatCompletionMessage(summary, 'test')
    
    expect(result).toMatch(/<b>\[test\] 작업 완료<\/b>/)
    expect(result).toContain('Test body')
    expect(result).toContain('✅ 작업이 완료되었습니다.')
  })
})

describe('formatChoiceMessage', () => {
  const fullSummary: WorkSummary = {
    body: 'Need to choose between options A and B'
  }

  test('formats choice message with body', () => {
    const result = formatChoiceMessage(fullSummary, 'choice-project')

    expect(result).toContain('[choice-project] 선택 필요')
    expect(result).toContain('Need to choose between options A and B')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('formats choice message without body', () => {
    const summary: WorkSummary = {}
    const result = formatChoiceMessage(summary, 'my-project')

    expect(result).toContain('[my-project] 선택 필요')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('formats choice message with empty body', () => {
    const summary: WorkSummary = {
      body: ''
    }
    const result = formatChoiceMessage(summary, 'my-project')

    expect(result).toContain('[my-project] 선택 필요')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('escapes HTML in body', () => {
    const summary: WorkSummary = {
      body: 'Body with <i>italic</i> text'
    }
    const result = formatChoiceMessage(summary, 'test-project')
    expect(result).toContain('&lt;i&gt;italic&lt;/i&gt;')
  })

  test('message structure has correct format', () => {
    const summary: WorkSummary = {
      body: 'Test body'
    }
    const result = formatChoiceMessage(summary, 'test')
    
    expect(result).toMatch(/<b>\[test\] 선택 필요<\/b>/)
    expect(result).toContain('Test body')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })
})

describe('edge cases', () => {
  test('handles very long body', () => {
    const longBody = 'b'.repeat(1000)
    const summary: WorkSummary = { body: longBody }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).toContain(longBody)
  })

  test('handles unicode characters in body', () => {
    const summary: WorkSummary = {
      body: '이름: 테스트'
    }
    const result = formatCompletionMessage(summary, '프로젝트')
    expect(result).toContain('프로젝트')
    expect(result).toContain('이름: 테스트')
  })

  test('handles emoji in body', () => {
    const summary: WorkSummary = {
      body: 'Body with emoji 🔥'
    }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).toContain('🔥')
  })

  test('completion and choice messages are different', () => {
    const summary: WorkSummary = {
      body: 'Test body'
    }
    const completion = formatCompletionMessage(summary, 'test')
    const choice = formatChoiceMessage(summary, 'test')

    expect(completion).toContain('작업 완료')
    expect(completion).toContain('✅ 작업이 완료되었습니다.')
    expect(choice).toContain('선택 필요')
    expect(choice).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })
})
