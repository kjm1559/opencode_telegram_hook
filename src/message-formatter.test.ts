import { describe, test, expect } from 'bun:test'
import { formatCompletionMessage, formatChoiceMessage, escapeHtml } from './message-formatter'
import type { WorkSummary } from './summary-accessor'

describe('escapeHtml', () => {
  test('escapes less than symbol (<)', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  test('escapes greater than symbol (>)', () => {
    expect(escapeHtml('5 > 3')).toBe('5 &gt; 3')
  })

  test('escapes ampersand (&)', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  test('escapes multiple special characters together', () => {
    expect(escapeHtml('<div>&</div>')).toBe('&lt;div&gt;&amp;&lt;/div&gt;')
  })

  test('handles normal text without special characters', () => {
    expect(escapeHtml('normal text')).toBe('normal text')
  })

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  test('handles null/undefined', () => {
    expect(escapeHtml(null as unknown as string)).toBe('')
    expect(escapeHtml(undefined as unknown as string)).toBe('')
  })

  test('preserves newlines and whitespace', () => {
    const input = 'line1\nline2\tindented'
    expect(escapeHtml(input)).toBe('line1\nline2\tindented')
  })
})

describe('formatCompletionMessage', () => {
  const fullSummary: WorkSummary = {
    title: 'Test Implementation',
    body: 'Implemented the new feature with all requirements',
    diffs: [
      { file: 'src/index.ts' },
      { file: 'src/utils.ts' }
    ],
    additions: 150,
    deletions: 25,
    files: ['src/index.ts', 'src/utils.ts']
  }

  test('formats completion message with full summary', () => {
    const result = formatCompletionMessage(fullSummary, 'test-project')

    expect(result).toContain('[test-project] 작업 완료')
    expect(result).toContain('제목: Test Implementation')
    expect(result).toContain('Implemented the new feature with all requirements')
    expect(result).toContain('📝 변경 사항:')
    expect(result).toContain('• <code>src/index.ts</code>')
    expect(result).toContain('• <code>src/utils.ts</code>')
    expect(result).toContain('✅ 작업이 완료되었습니다')
  })

  test('includes bold tags for project name', () => {
    const result = formatCompletionMessage(fullSummary, 'test-project')
    expect(result).toContain('<b>[test-project] 작업 완료</b>')
  })

  test('handles partial summary with missing title', () => {
    const partialSummary: WorkSummary = {
      body: 'Only body content',
      diffs: [{ file: 'test.ts' }]
    }
    const result = formatCompletionMessage(partialSummary, 'my-project')

    expect(result).toContain('[my-project] 작업 완료')
    expect(result).not.toContain('제목: ')
    expect(result).toContain('Only body content')
    expect(result).toContain('✅ 작업이 완료되었습니다')
  })

  test('handles partial summary with missing body', () => {
    const partialSummary: WorkSummary = {
      title: 'Only Title'
    }
    const result = formatCompletionMessage(partialSummary, 'my-project')

    expect(result).toContain('[my-project] 작업 완료')
    expect(result).toContain('제목: Only Title')
    expect(result).not.toContain('📝 변경 사항:')
    expect(result).toContain('✅ 작업이 완료되었습니다')
  })

  test('handles partial summary with missing diffs', () => {
    const partialSummary: WorkSummary = {
      title: 'Title',
      body: 'Body',
      additions: 10,
      deletions: 5,
      files: ['test.ts']
    }
    const result = formatCompletionMessage(partialSummary, 'my-project')

    expect(result).toContain('[my-project] 작업 완료')
    expect(result).not.toContain('📝 변경 사항:')
    expect(result).toContain('✅ 작업이 완료되었습니다')
  })

  test('handles empty summary object', () => {
    const emptySummary: WorkSummary = {}
    const result = formatCompletionMessage(emptySummary, 'empty-project')

    expect(result).toContain('[empty-project] 작업 완료')
    expect(result).toContain('✅ 작업이 완료되었습니다')
  })

  test('escapes HTML in project name', () => {
    const result = formatCompletionMessage(fullSummary, '<script>alert(1)</script>')
    expect(result).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(result).not.toContain('<script>')
  })

  test('escapes HTML in summary title', () => {
    const summary: WorkSummary = {
      title: '<b>Bold</b> Title',
      body: 'Body content'
    }
    const result = formatCompletionMessage(summary, 'test-project')
    expect(result).toContain('&lt;b&gt;Bold&lt;/b&gt; Title')
    expect(result).not.toContain('<b>Bold</b>')
  })

  test('escapes HTML in summary body', () => {
    const summary: WorkSummary = {
      title: 'Title',
      body: '<script>malicious()</script>'
    }
    const result = formatCompletionMessage(summary, 'test-project')
    expect(result).toContain('&lt;script&gt;malicious()&lt;/script&gt;')
  })

  test('escapes HTML in file names', () => {
    const summary: WorkSummary = {
      title: 'Title',
      diffs: [{ file: '<script>evil.ts</script>' }]
    }
    const result = formatCompletionMessage(summary, 'test-project')
    expect(result).toContain('<code>&lt;script&gt;evil.ts&lt;/script&gt;</code>')
  })

  test('handles special characters in project name', () => {
    const result = formatCompletionMessage(fullSummary, 'Project & Demo')
    expect(result).toContain('Project &amp; Demo')
  })

  test('message structure has correct sections', () => {
    const result = formatCompletionMessage(fullSummary, 'test-project')
    const lines = result.split('\n')

    expect(lines[0]).toBe('<b>[test-project] 작업 완료</b>')
    expect(lines[1]).toBe('')
    expect(lines[lines.length - 1]).toBe('✅ 작업이 완료되었습니다.')
  })
})

describe('formatChoiceMessage', () => {
  const fullSummary: WorkSummary = {
    title: 'Decision Required',
    body: 'Need to choose between options A and B',
    diffs: [{ file: 'config.json' }],
    additions: 5,
    deletions: 2,
    files: ['config.json']
  }

  test('formats choice message with full summary', () => {
    const result = formatChoiceMessage(fullSummary, 'choice-project')

    expect(result).toContain('[choice-project] 선택 필요')
    expect(result).toContain('제목: Decision Required')
    expect(result).toContain('Need to choose between options A and B')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('includes bold tags for project name', () => {
    const result = formatChoiceMessage(fullSummary, 'choice-project')
    expect(result).toContain('<b>[choice-project] 선택 필요</b>')
  })

  test('does NOT include file changes section', () => {
    const result = formatChoiceMessage(fullSummary, 'choice-project')
    expect(result).not.toContain('📝 변경 사항:')
  })

  test('handles partial summary with missing title', () => {
    const partialSummary: WorkSummary = {
      body: 'Only body content'
    }
    const result = formatChoiceMessage(partialSummary, 'my-project')

    expect(result).toContain('[my-project] 선택 필요')
    expect(result).not.toContain('제목: ')
    expect(result).toContain('Only body content')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('handles partial summary with missing body', () => {
    const partialSummary: WorkSummary = {
      title: 'Only Title'
    }
    const result = formatChoiceMessage(partialSummary, 'my-project')

    expect(result).toContain('[my-project] 선택 필요')
    expect(result).toContain('제목: Only Title')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('handles empty summary object', () => {
    const emptySummary: WorkSummary = {}
    const result = formatChoiceMessage(emptySummary, 'empty-project')

    expect(result).toContain('[empty-project] 선택 필요')
    expect(result).toContain('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('escapes HTML in project name', () => {
    const result = formatChoiceMessage(fullSummary, '<b>bold</b>')
    expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;')
    expect(result).not.toContain('<b>bold</b>')
  })

  test('escapes HTML in summary title', () => {
    const summary: WorkSummary = {
      title: '<i>Italic</i> Title',
      body: 'Body content'
    }
    const result = formatChoiceMessage(summary, 'test-project')
    expect(result).toContain('&lt;i&gt;Italic&lt;/i&gt; Title')
  })

  test('message structure has correct sections', () => {
    const result = formatChoiceMessage(fullSummary, 'test-project')
    const lines = result.split('\n')

    expect(lines[0]).toBe('<b>[test-project] 선택 필요</b>')
    expect(lines[lines.length - 1]).toBe('⚠️ 작업을 계속하기 위해 선택이 필요합니다.')
  })

  test('choice message differs from completion message', () => {
    const completion = formatCompletionMessage(fullSummary, 'test-project')
    const choice = formatChoiceMessage(fullSummary, 'test-project')

    expect(completion).toContain('작업 완료')
    expect(completion).toContain('✅')
    expect(choice).toContain('선택 필요')
    expect(choice).toContain('⚠️')
    expect(completion).not.toBe(choice)
  })
})

describe('edge cases', () => {
  test('handles very long project name', () => {
    const longName = 'a'.repeat(1000)
    const summary: WorkSummary = { title: 'Test' }
    const result = formatCompletionMessage(summary, longName)
    expect(result).toContain(longName)
  })

  test('handles very long title', () => {
    const longTitle = 'b'.repeat(1000)
    const summary: WorkSummary = { title: longTitle }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).toContain(longTitle)
  })

  test('handles very long body', () => {
    const longBody = 'c'.repeat(1000)
    const summary: WorkSummary = { title: 'Test', body: longBody }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).toContain(longBody)
  })

  test('handles multiple files in diffs', () => {
    const summary: WorkSummary = {
      title: 'Test',
      diffs: [
        { file: 'file1.ts' },
        { file: 'file2.ts' },
        { file: 'file3.ts' }
      ]
    }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).toContain('• <code>file1.ts</code>')
    expect(result).toContain('• <code>file2.ts</code>')
    expect(result).toContain('• <code>file3.ts</code>')
  })

  test('handles empty diffs array', () => {
    const summary: WorkSummary = {
      title: 'Test',
      diffs: []
    }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).not.toContain('📝 변경 사항:')
  })

  test('handles unicode characters', () => {
    const summary: WorkSummary = {
      title: 'テスト タイトル',
      body: '이름: 테스트'
    }
    const result = formatCompletionMessage(summary, '프로젝트')
    expect(result).toContain('프로젝트')
    expect(result).toContain('テスト タイトル')
    expect(result).toContain('이름: 테스트')
  })

  test('handles emoji in content', () => {
    const summary: WorkSummary = {
      title: 'Title 🎉',
      body: 'Body with emoji 🔥'
    }
    const result = formatCompletionMessage(summary, 'test')
    expect(result).toContain('🎉')
    expect(result).toContain('🔥')
  })
})

describe('HTML formatting verification', () => {
  test('completion message uses correct HTML tags', () => {
    const summary: WorkSummary = {
      title: 'Test',
      diffs: [{ file: 'test.ts' }]
    }
    const result = formatCompletionMessage(summary, 'project')

    expect(result).toMatch(/<b>\[project\] 작업 완료<\/b>/)
    expect(result).toMatch(/<code>test\.ts<\/code>/)
  })

  test('choice message uses correct HTML tags', () => {
    const summary: WorkSummary = {
      title: 'Test'
    }
    const result = formatChoiceMessage(summary, 'project')

    expect(result).toMatch(/<b>\[project\] 선택 필요<\/b>/)
  })

  test('HTML is properly escaped before tags are added', () => {
    const summary: WorkSummary = {
      title: '<b>already bold</b>'
    }
    const result = formatCompletionMessage(summary, 'project')

    expect(result).toContain('&lt;b&gt;already bold&lt;/b&gt;')
    expect(result).not.toContain('<b>&lt;b&gt;')
  })
})
