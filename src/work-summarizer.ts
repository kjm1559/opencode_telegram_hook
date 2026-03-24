export class WorkSummarizer {
  private readonly trackedData = new Map<string, {
    filesModified: Array<{
      file: string
      action: string
      timestamp: number
    }>
    tests: Array<{
      success: boolean
      timestamp: number
    }>
    commands: Array<{
      command: string
      success: boolean
      timestamp: number
    }>
  }>()

  trackFileModification(
    sessionId: string,
    file: string,
    action: string = "modified",
  ) {
    if (!this.trackedData.has(sessionId)) {
      this.trackedData.set(sessionId, {
        filesModified: [],
        tests: [],
        commands: [],
      })
    }

    const data = this.trackedData.get(sessionId)!
    data.filesModified.push({
      file,
      action,
      timestamp: Date.now(),
    })
  }

  trackTestRun(
    sessionId: string,
    success: boolean,
  ) {
    if (!this.trackedData.has(sessionId)) {
      this.trackedData.set(sessionId, {
        filesModified: [],
        tests: [],
        commands: [],
      })
    }

    const data = this.trackedData.get(sessionId)!
    data.tests.push({
      success,
      timestamp: Date.now(),
    })
  }

  trackCommandExecution(
    sessionId: string,
    command: string,
    success: boolean,
  ) {
    if (!this.trackedData.has(sessionId)) {
      this.trackedData.set(sessionId, {
        filesModified: [],
        tests: [],
        commands: [],
      })
    }

    const data = this.trackedData.get(sessionId)!
    data.commands.push({
      command,
      success,
      timestamp: Date.now(),
    })
  }

  generate(
    context: {
      eventHistory: Array<{
        type: string
        title: string
        timestamp: number
        payload: {
          event: {
            session_id?: string
            sessionId?: string
            properties?: {
              session_id?: string
            }
          }
        }
      }>
    },
  ): string | null {
    const sessionId = (
      context.eventHistory[0]?.payload?.event?.session_id ||
      context.eventHistory[0]?.payload?.event?.sessionId ||
      context.eventHistory[0]?.payload?.event?.properties?.session_id ||
      "unknown"
    )
    const data = this.trackedData.get(sessionId)

    if (!data || (data.filesModified.length === 0 || data.commands.length === 0)) {
      return null
    }

    const sections: Array<string> = []

    if (data.filesModified.length > 0) {
      const files = data.filesModified.map((f) => `- \`${f.file}\` (${f.action})`)
      sections.push(`**Files Modified** (${data.filesModified.length}):\n${files.join("\n")}`)
    }

    if (data.tests.length > 0) {
      const passed = data.tests.filter((t) => t.success).length
      const failed = data.tests.length - passed
      const icons = passed > 0 ? "✅" : passed === 0 ? "⚠️" : "❌"

      sections.push(
        `${icons} **Tests**: ${passed}/${data.tests.length} passed${failed > 0 ? ` (${failed} failed)` : ""}`,
      )
    }

    if (data.commands.length > 0) {
      const successCount = data.commands.filter((c) => c.success).length
      sections.push(
        `**Commands Executed**: \`${data.commands.length}\` (\`${successCount}\` success)`,
      )
    }

    const summary = [
      "✅ **Work Completed**!",
      "",
      "**Actions**:",
      ...sections,
      "",
      "**Details**:",
      `Events tracked: \`${context.eventHistory.length}\`\n`,
      "Ready for next task. 🎉",
    ].join("\n")

    if (data.filesModified.length === 0 && data.commands.length === 0) {
      return null
    }

    return summary
  }

  clear(sessionId: string) {
    this.trackedData.delete(sessionId)
  }
}
