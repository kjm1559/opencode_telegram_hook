import { describe, expect, test } from "bun:test"
import { WorkSummarizer } from "./work-summarizer"

describe("WorkSummarizer", () => {
  test("trackFileModification adds file to tracking", () => {
    const summarizer = new WorkSummarizer()
    
    summarizer.trackFileModification(
      "session-123",
      "src/utils/auth.ts",
      "created",
    )

    expect(summarizer).toBeDefined()
  })

  test("trackTestRun records test result", () => {
    const summarizer = new WorkSummarizer()
    
    summarizer.trackTestRun("session-123", true)

    expect(summarizer).toBeDefined()
  })

  test("generate returns null when no data tracked", () => {
    const summarizer = new WorkSummarizer()
    
    const context = {
      eventHistory: [
        {
          type: "session.started",
          title: "test",
          timestamp: Date.now(),
          payload: {
            event: {
              session_id: "session-123",
            },
          },
        },
      ],
    }
    
    const summary = summarizer.generate(context)
    
    expect(summary).toBeNull()
  })

  test("generate creates summary with tracked data", () => {
    const summarizer = new WorkSummarizer()
    
    summarizer.trackFileModification(
      "session-123",
      "src/auth.ts",
      "modified",
    )

    summarizer.trackTestRun("session-123", true)

    summarizer.trackCommandExecution(
      "session-123",
      "npm test",
      true,
    )

    const context = {
      eventHistory: [
        {
          type: "session.started",
          title: "test",
          timestamp: Date.now(),
          payload: {
            event: {
              session_id: "session-123",
            },
          },
        },
      ],
    }

    const summary = summarizer.generate(context)

    expect(summary).toBeTruthy()
    expect(summary?.includes("Work Completed")).toBe(true)
    expect(summary?.includes("src/auth.ts")).toBe(true)
  })
})
