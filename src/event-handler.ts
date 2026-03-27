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

    if (!event.type || typeof event.type !== 'string') {
      console.log("[EventHandler] SKIPPING: Invalid or missing event.type")
      console.log("[EventHandler] Event structure:", JSON.stringify(event, null, 2))
      return
    }

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
    if (!eventType || typeof eventType !== 'string') {
      console.log(`[TelegramPlugin] shouldNotify check: Invalid eventType -> false`)
      return false
    }
    
    const lowerEventType = eventType.toLowerCase()
    const shouldTrackEvents = [
      "message.created",
      "message.part.updated",
      "tool.execute.before",
      "tool.execute.after",
      "command.executed",
      "lsp.client.diagnostics",
      "session.started",
      "session.status",
      "session.diff",
      "session.updated",
      "session.completed",
      "session.finished",
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
      const toolName = this.escapeMarkdownV2(event.toolName || event.arguments?.tool || "unknown")
      const escapedProjectName = this.escapeMarkdownV2(projectName)
      return `[${escapedProjectName}] 🔧 Using tool: \`${toolName}\`\n\n---\n`
    }

    if (event.type === "tool.execute.after") {
        const success = (event.output?.output && typeof event.output.output === 'string' && event.output.output.includes("success")) 
            || !event.output?.error
        const icon = success ? "✅" : "⚠️"
        const title = this.escapeMarkdownV2(event.output?.title || "Tool executed")
        const escapedProjectName = this.escapeMarkdownV2(projectName)

        const lines = [`[${escapedProjectName}] \`${icon} ${title}\``]

        if (event.output?.output?.substring && typeof event.output.output === 'string') {
            lines.push(this.escapeMarkdownV2(event.output.output.substring(0, 256)))
        }

        lines.push("\n---\n")
        return lines.join("\n\n")
    }

    if (event.type === "command.executed") {
      const cmd = this.escapeMarkdownV2(event.arguments?.command || event.command || "command")
      const escapedProjectName = this.escapeMarkdownV2(projectName)
      const lines = [`[${escapedProjectName}] 💻 Command: \`${cmd}\``]

      if (event.output) {
        lines.push(this.escapeMarkdownV2(event.output.substring(0, 256)))
      }

      lines.push("\n---\n")
      return lines.join("\n\n")
    }

    if (event.type === "lsp.client.diagnostics") {
      const errors = (event.properties?.errors || []).length || 0
      const warnings = (event.properties?.warnings || []).length || 0

      if (errors === 0 && warnings === 0) return null

      const escapedProjectName = this.escapeMarkdownV2(projectName)
      const lines = [
        `[${escapedProjectName}] 🐛 LSP Diagnostics:`,
        `Errors: \`${errors}\``,
        `Warnings: \`${warnings}\`\n`,
        `\n---\n`,
      ]

      return lines.join("\n")
    }

    if (event.type === "session.started") {
        const dir = typeof event.payload?.directory === 'string' 
            ? this.escapeMarkdownV2(event.payload.directory) 
            : this.escapeMarkdownV2(projectDir)
        const worktree = typeof event.payload?.worktree === 'string' 
            ? this.escapeMarkdownV2(event.payload.worktree) 
            : "default"
        const escapedProjectName = this.escapeMarkdownV2(projectName)
        return `[${escapedProjectName}] 🚀 New session started\n\nDir: \`${dir.substring(0, 50)}...\`\nWorktree: \`${worktree.substring(0, 30)}...\`\n\n---\n`
    }

    if (event.type === "session.status") {
        const statusType = this.escapeMarkdownV2(event.properties?.status?.type || "unknown")
        const statusIcon = statusType === "busy" ? "🔄" : "⏸️"
        return `[${this.escapeMarkdownV2(projectName)}] ${statusIcon} Session status: \`${statusType}\`\n\n---\n`
    }

    if (event.type === "session.diff") {
        const diffList = event.properties?.diff || []
        const fileCount = Array.isArray(diffList) ? diffList.length : 0
        const changes = diffList.map((d: any) => 
            `• \`${this.escapeMarkdownV2(d.file)}\` → ${this.escapeMarkdownV2(d.status || "modified")}`
        ).slice(0, 5).join("\n")
        return `[${this.escapeMarkdownV2(projectName)}] 📝 Session diff: \`${fileCount}\` files changed\n\n${changes}\n\n---\n`
    }

    if (event.type === "session.updated") {
        const status = this.escapeMarkdownV2(event.payload?.status?.value || event.properties?.status || "updated")
        const request = event.payload?.request?.content || event.payload?.request || event.message
        const prompt = event.payload?.prompt || event.properties?.prompt
        const diff = event.payload?.diff || event.properties?.diff
        
        const lines = [
            `[${this.escapeMarkdownV2(projectName)}] 🔄 Session updated`,
            `Status: \`${status}\``
        ]
        
        if (request) {
            lines.push(`\n📝 \`User Request:\` ${this.escapeMarkdownV2(request.substring(0, 200))}`)
        }
        if (prompt) {
            lines.push(`\n💡 \`Prompt:\` ${this.escapeMarkdownV2(prompt.substring(0, 200))}`)
        }
        if (diff) {
            lines.push(`\n⚡ \`Changes:\` \`${this.escapeMarkdownV2(JSON.stringify(diff, null, 2).substring(0, 256))}\``)
        }
        
        lines.push("\n\n---\n")
        return lines.join("\n")
    }

    if (event.type === "session.completed") {
      return `[${this.escapeMarkdownV2(projectName)}] ✅ Session completed\n\nSee summary below for details.\n\n---\n`
    }

    return `[${this.escapeMarkdownV2(projectName)}]\`[${this.escapeMarkdownV2(event.type)}]\`\n\`${this.escapeMarkdownV2(event.title || "No title")}\`\n\n---\n`
  }

  private formatMessageUpdate(event: any, projectName: string): string | null {
    if (event.type === "message.part.updated") {
      const part = event.properties?.part
      
      if (!part) {
        console.log("[formatMessageUpdate] No part in event.properties")
        return null
      }

      const partType = part?.type || "unknown"
      console.log("[formatMessageUpdate] Part type:", partType);
      
      let content = "";
      
      if (partType === "text") {
        content = part?.text || "";
        console.log("[formatMessageUpdate] Text content:", `"${content}"`, "length:", content.length);
      } 
      else if (partType === "reasoning") {
        content = part?.text || "";
        console.log("[formatMessageUpdate] Reasoning content:", `"${content}"`, "length:", content.length);
      }
      else if (partType === "tool") {
        const toolName = part?.tool || "unknown"
        const state = part?.state || {}
        const status = state?.status || "unknown"
        
        if (status === "completed") {
          const output = state?.output || ""
          content = `Tool \`${toolName}\` completed: ${output}`
          console.log("[formatMessageUpdate] Tool result:", content);
        } else if (status === "error") {
          const error = state?.error || "Unknown error"
          content = `Tool \`${toolName}\` failed: ${error}`
          console.log("[formatMessageUpdate] Tool error:", content);
        } else {
          content = `Tool \`${toolName}\` is ${status}`
          console.log("[formatMessageUpdate] Tool status:", content);
        }
        
        return this.formatTextMessage(projectName, "🔧 Tool", content);
      }
      else {
        content = part?.text || part?.content || ""
        if (content) {
          console.log("[formatMessageUpdate] Content from part.text/part.content:", `"${content}"`, "length:", content.length);
        }
      }

      if (!content || typeof content !== "string" || content.trim() === "") {
        console.log("[formatMessageUpdate] No valid content found in part")
        console.log("[formatMessageUpdate] Part keys:", Object.keys(part || {}));
        return null
      }

      let role = "unknown";
      
      if (event.properties?.info?.role) {
        role = event.properties.info.role;
        console.log("[formatMessageUpdate] Role from event.properties.info:", role);
      } 
      else if (part.senderID !== undefined && part.senderID !== null) {
        role = part.senderID === "user" ? "user" : "assistant";
        console.log("[formatMessageUpdate] Role from part.senderID:", role);
      }
      else if (part.role !== undefined && part.role !== null) {
        role = part.role === "user" ? "user" : "assistant";
        console.log("[formatMessageUpdate] Role from part.role:", role);
      }
      else {
        role = "assistant";
        console.log("[formatMessageUpdate] No role info available, defaulting to assistant");
      }
      
      const sender = role === "user" ? "👤 User" : "🤖 Agent";
      
      return this.formatTextMessage(projectName, sender, content)
    }

    if (event.type === "message.updated") {
      const info = event.properties?.info
      
      if (!info) {
        console.log("[formatMessageUpdate] No info in event.properties")
        return null
      }

      const role = info.role || "unknown"
      const summary = info.summary

      if (role === "user" && summary) {
        const title = summary.title || ""
        const body = summary.body || ""
        const content = title || body || ""

        if (!content || typeof content !== "string") {
          return null
        }

        return this.formatTextMessage(projectName, "👤 User", content)
      }

      if (role === "assistant") {
        const tokens = info.tokens?.total || 0
        const cost = info.cost || 0
        const path = this.escapeMarkdownV2(info.path || "unknown path")
        const escapedProjectName = this.escapeMarkdownV2(projectName)
        
        return `[${escapedProjectName}] 🤖 Agent completed message\n\n\`\`\`\nPath: ${path}\nTokens: ${tokens}\nCost: $${cost.toFixed(4)}\n\`\`\`\n\n---\n`
      }
    }

    const content = event.content || 
                   event.message?.content || 
                   event.properties?.content || 
                   event.properties?.message?.content || ""

    if (!content || typeof content !== "string" || content.trim() === "") {
      console.log("[formatMessageUpdate] No valid content found for message event")
      return null
    }

    const role = event.role || event.properties?.role || 
                (event.message ? event.message.role : undefined) ||
                (event.properties?.info ? event.properties?.info.role : undefined)
    
    const sender = role === "assistant" ? "🤖 Agent" : "👤 User"
    
    return this.formatTextMessage(projectName, sender, content)
  }

  private formatTextMessage(
    projectName: string,
    sender: string,
    content: string,
  ): string {
    const maxLength = 800
    const truncated = content.length > maxLength
      ? content.substring(0, maxLength) + "...\n\n(truncated)"
      : content
    
    const escaped = this.escapeMarkdownV2(truncated)
    return `[${this.escapeMarkdownV2(projectName)}] ${sender}:\n\n${escaped}\n\n---\n`
  }

  private escapeMarkdownV2(text: string): string {
    let result = text
    
    // Escape backslash FIRST
    result = result.replace(/\\/g, '\\\\')
    
    // Escape special characters EXCEPT * and _ (used for markdown formatting)
    result = result.replace(/\[/g, '\\[')
    result = result.replace(/\]/g, '\\]')
    result = result.replace(/\(/g, '\\(')
    result = result.replace(/\)/g, '\\)')
    result = result.replace(/~/g, '\\~')
    result = result.replace(/`/g, '\\`')
    result = result.replace(/>/g, '\\>')
    result = result.replace(/#/g, '\\#')
    result = result.replace(/\+/g, '\\+')
    result = result.replace(/-/g, '\\-')
    result = result.replace(/=/g, '\\=')
    result = result.replace(/\|/g, '\\|')
    result = result.replace(/\{/g, '\\{')
    result = result.replace(/\}/g, '\\}')
    result = result.replace(/\./g, '\\.')
    result = result.replace(/!/g, '\\!')
    
    return result
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
