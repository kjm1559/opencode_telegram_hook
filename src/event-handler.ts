import { sendTelegramMessage, type Telegram } from "./telegram-client"

export class EventHandler {
  private readonly telegramClient: typeof sendTelegramMessage
  private readonly throttledEvents = new Map<string, number>()
  private readonly throttleMs = 1000

  constructor(telegramClient: typeof sendTelegramMessage) {
    this.telegramClient = telegramClient
  }

  async handle(
    event: any,
    sessionId: string,
    context: {
      telegramChatId?: string
      eventHistory: Array<any>
    },
    deps: {
      telegramClient: typeof sendTelegramMessage
      directory: string
      worktree: string
    },
  ) {
    const { telegramChatId } = context

    if (!telegramChatId) return

    const shouldNotify = this.shouldNotify(event.type)
    if (!shouldNotify) return

    await this.sendToTelegram(event, telegramChatId, deps)
  }

  private shouldNotify(eventType: string): boolean {
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

    return shouldTrackEvents.some((pattern) => eventType.includes(pattern))
  }

  private async sendToTelegram(
    event: any,
    chatId: string,
    deps: {
      directory: string
      worktree: string
    },
  ) {
    const now = Date.now()

    if (event.type === "message.created" || event.type === "message.part.updated") {
      return await this.handleMessageUpdate(event, chatId)
    }

    if (event.type === "tool.execute.before") {
      return await this.notify(
        chatId,
        `🔧 Using tool: \`${event.toolName || event.arguments?.tool || "unknown"}\`",
      )
    }

    if (event.type === "tool.execute.after") {
      const success = event.output?.output?.includes("success") || !event.output?.error
      const icon = success ? "✅" : "⚠️"
      const title = event.output?.title || "Tool executed"

      const text = [`\`${icon} ${title}\``]

      if (event.output?.output?.substring) {
        text.push(event.output.output.substring(0, 256))
      }

      return await this.notify(chatId, text.join("\n\n"))
    }

    if (event.type === "command.executed") {
      const cmd = event.arguments?.command || event.command || "command"
      const text = [`💻 Command: \`${cmd}\``]

      if (event.output) {
        text.push(event.output.substring(0, 256))
      }

      return await this.notify(chatId, text.join("\n\n"))
    }

    if (event.type === "lsp.client.diagnostics") {
      const errors = (event.properties?.errors || []).length || 0
      const warnings = (event.properties?.warnings || []).length || 0

      if (errors > 0 || warnings > 0) {
        const text = [
          `🐛 LSP Diagnostics:`,
          `Errors: \`${errors}\``,
          `Warnings: \`${warnings}\`\n`,
          `Dir: \`${deps.directory.substring(0, 50)}...\`\n`,
        ]

        return await this.notify(chatId, text.join("\n"))
      }
    }

    if (event.type === "session.started") {
      return await this.notify(
        chatId,
        `🚀 New session started\n\nDir: \`${deps.directory.substring(0, 50)}...\`\nWorktree: \`${deps.worktree.substring(0, 30)}...\`\n\n---\n`,
      )
    }

    if (event.type === "session.completed") {
      return await this.notify(
        chatId,
        `✅ Session completed\n\nSee summary below for details.\n\n---\n`,
      )
    }

    const genericText = `\`[${event.type}]\`\n\`${event.title || "No title"}\``
    await this.notify(chatId, genericText)
  }

  private async handleMessageUpdate(
    event: any,
    chatId: string,
  ) {
    const part = event.part || event.properties?.part
    const role = part?.role || event.role
    const content = part?.content || event.message?.content || ""

    if (!content || typeof content !== "string") return

    const sender = role === "assistant" ? "🤖 Agent" : "👤 User"
    const text = [
      `${sender}:`,
      `\`\`\`\n${content.substring(0, 500)}\n\`\`\`\n`,
    ]

    await this.notify(chatId, text.join(""))
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
