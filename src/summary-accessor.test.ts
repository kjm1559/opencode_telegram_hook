import { describe, test, expect } from 'bun:test'
import { getSummaryFromEvent, type WorkSummary } from './summary-accessor'

describe('getSummaryFromEvent', () => {
  test('extracts summary from message.updated event with full data', () => {
    // message.updated has: title, body, diffs (NOT additions/deletions/files)
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: 'Test Title',
            body: 'Test Body',
            diffs: [{ file: 'test.ts', changes: '+10 -5' }]
          }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      title: 'Test Title',
      body: 'Test Body',
      diffs: [{ file: 'test.ts', changes: '+10 -5' }],
      files: ['test.ts']
    })
  })

  test('extracts summary from message.updated event with partial data', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: 'Partial Title'
            // Missing: body, diffs
          }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      title: 'Partial Title',
      files: []
    })
  })

  test('extracts summary from session.updated event with full data', () => {
    // session.updated has: additions, deletions, files, diffs (NOT title/body)
    const event = {
      type: 'session.updated',
      properties: {
        info: {
          summary: {
            additions: 20,
            deletions: 10,
            files: 1,
            diffs: [{ file: 'session.ts', changes: '+20 -10' }]
          }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      additions: 20,
      deletions: 10,
      files: 1,
      diffs: [{ file: 'session.ts', changes: '+20 -10' }]
    })
  })

  test('extracts summary from session.updated event with partial data', () => {
    const event = {
      type: 'session.updated',
      properties: {
        info: {
          summary: {
            additions: 15
            // Missing: deletions, files, diffs
          }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      additions: 15
    })
  })

  test('returns null when no summary available', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {}
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('returns null for unknown event type', () => {
    const event = {
      type: 'unknown.event',
      properties: {
        info: {
          summary: { title: 'Test' }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('returns null for empty event object', () => {
    const event = {}
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('returns null when properties is undefined', () => {
    const event = {
      type: 'message.updated'
    }
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('returns null when info is undefined', () => {
    const event = {
      type: 'message.updated',
      properties: {}
    }
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('returns null when summary is null', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: null
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('returns null when summary is undefined', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: undefined
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toBeNull()
  })

  test('handles empty arrays and zero values correctly', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: '',
            body: '',
            diffs: []
          }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      title: '',
      body: '',
      diffs: [],
      files: []
    })
  })

  test('handles multiple files in diffs', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          summary: {
            title: 'Multi-file change',
            diffs: [
              { file: 'file1.ts' },
              { file: 'file2.ts' },
              { file: 'file3.ts' }
            ]
          }
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result?.title).toBe('Multi-file change')
    expect(result?.diffs).toHaveLength(3)
    expect(result?.files).toEqual(['file1.ts', 'file2.ts', 'file3.ts'])
  })

  test('message.updated with fallback to info.title', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          title: 'Fallback Title',
          body: 'Fallback Body'
          // No summary field
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      title: 'Fallback Title',
      body: 'Fallback Body'
    })
  })

  test('session.updated with fallback to info.title', () => {
    const event = {
      type: 'session.updated',
      properties: {
        info: {
          title: 'Session Fallback Title'
          // No summary field
        }
      }
    }
    const result = getSummaryFromEvent(event)
    expect(result).toEqual({
      title: 'Session Fallback Title'
    })
  })
})
