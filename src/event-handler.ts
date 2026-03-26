import { type Telegram } from "./telegram-client"
import { type Config } from "./config"

type TelegramSendFn = (params: Telegram.SendMessageParams) => Promise<boolean>

export class EventHandler {
  private readonly throttledEvents = new Map<string, number>()
  private readonly throttleMs = 1000
  private readonly telegramClient: TelegramSendFn
  private readonly config: Config

  constructor(
    telegramClient: TelegramSendFn,
    config: Config,
  ) {
    this.telegramClient = telegramClient
    this.config = config
  }

    async handle(
    event: any,
    projectDir: string,
    projectName: string,
    chatIds: Array<string>,
    deps: {
      telegramClient: TelegramSendFn
    },
    ) {
    console.log("[EventHandler] ======== EVENT RECEIVED ========")
    console.log("[EventHandler] Received event:", event.type)
    console.log("[EventHandler] Event title:", event.title)
    console.log("[EventHandler] Project:", projectName)
    console.log("[EventHandler] Chat IDs received:", chatIds)
    console.log("[EventHandler] Chat IDs count:", chatIds.length)
    console.log("[EventHandler] Session ID:", event.session_id || event.sessionId || event.properties?.session_id)
    console.log("[EventHandler] Event payload keys:", Object.keys(event.payload || {}))

    if (chatIds.length === 0) {
      console.log("  [EventHandler] SKIPPING: No chat IDs available")
      return
    }

    const shouldNotify = this.shouldNotify(event.type)
    if (!shouldNotify) return

    const text = this.formatEvent(event, projectDir, projectName)
    if (!text) return

    for (const chatId of chatIds) {
      await this.notify(chatId, text)
    }
  }

    private shouldNotify(eventType: string): boolean {
        const lowerEventType = eventType.toLowerCase()
        const shouldTrackEvents = [
            "message.created",
            "message.part.updated",
            "tool.execute.before",
            "tool.execute.after",
            "command.executed",
            "lsp.client.diagnostics",
            "session.started",
            "session.completed",
        ]
        const result = shouldTrackEvents.some((pattern) => 
            lowerEventType.includes(pattern.toLowerCase())
        )
        console.log(`[TelegramPlugin] shouldNotify check: "${eventType}" -> ${result}`)
        return result
    }

  private formatEvent(event: any, projectDir: string, projectName: string): string | null {
    if (event.type === "message.created" || event.type === "message.part.updated") {
      return this.formatMessageUpdate(event, projectName)
    }

    if (event.type === "tool.execute.before") {
      const toolName = event.toolName || event.arguments?.tool || "unknown"
      return `[${projectName}] 🔧 Using tool: \`${toolName}\`\n\n---\n`
    }

    if (event.type === "tool.execute.after") {
        const success = (event.output?.output && typeof event.output.output === 'string' && event.output.output.includes("success")) 
            || !event.output?.error
        const icon = success ? "✅" : "⚠️"
        const title = event.output?.title || "Tool executed"

        const lines = [`[${projectName}] \`${icon} ${title}\``]

        if (event.output?.output?.substring && typeof event.output.output === 'string') {
            lines.push(event.output.output.substring(0, 256))
        }

        lines.push("\n---\n")
        return lines.join("\n\n")
    }

    if (event.type === "command.executed") {
      const cmd = event.arguments?.command || event.command || "command"
      const lines = [`[${projectName}] 💻 Command: \`${cmd}\``]

      if (event.output) {
        lines.push(event.output.substring(0, 256))
      }

      lines.push("\n---\n")
      return lines.join("\n\n")
    }

    if (event.type === "lsp.client.diagnostics") {
      const errors = (event.properties?.errors || []).length || 0
      const warnings = (event.properties?.warnings || []).length || 0

      if (errors === 0 && warnings === 0) return null

      const lines = [
        `[${projectName}] 🐛 LSP Diagnostics:`,
        `Errors: \`${errors}\``,
        `Warnings: \`${warnings}\`\n`,
        `\n---\n`,
      ]

      return lines.join("\n")
    }

    if (event.type === "session.started") {
        const dir = typeof event.payload?.directory === 'string' 
            ? event.payload.directory 
            : projectDir
        const worktree = typeof event.payload?.worktree === 'string' 
            ? event.payload.worktree 
            : "default"
        return `[${projectName}] 🚀 New session started\n\nDir: \`${dir.substring(0, 50)}...\`\nWorktree: \`${worktree.substring(0, 30)}...\`\n\n---\n`
    }

    if (event.type === "session.completed") {
      return `[${projectName}] ✅ Session completed\n\nSee summary below for details.\n\n---\n`
    }

    return `[${projectName}] \`[${event.type}]\`\n\`${event.title || "No title"}\`\n\n---\n`
  }

  private formatMessageUpdate(event: any, projectName: string): string | null {
    const part = event.part || event.properties?.part
    const role = part?.role || event.role
    const content = part?.content || event.message?.content || ""

    if (!content || typeof content !== "string") return null

    const sender = role === "assistant" ? "🤖 Agent" : "👤 User"
    return `[${projectName}] ${sender}:\n\n\`\`\`\n${content.substring(0, 500)}\n\`\`\`\n\n---\n`
  }

  private async notify(chatId: string, text: string): Promise<boolean> {
    const now = Date.now()
    const last = this.throttledEvents.get(chatId) || 0

    if (now - last < this.throttleMs) {
      return false
    }

    this.throttledEvents.set(chatId, now)

    return await this.telegramClient({
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
    })
  }
}
