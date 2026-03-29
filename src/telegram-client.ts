import z from "zod"

const TelegramMessageSchema = z.object({
  chat_id: z.union([z.string(), z.number()]),
  text: z.string(),
  parse_mode: z.literal("MarkdownV2").optional(),
  reply_to_message_id: z.string().optional(),
})

export namespace Telegram {
  export type SendMessageParams = z.infer<typeof TelegramMessageSchema>
  export type ChatId = string | number
  export type MessageId = string
  export type ParsedMessage = {
    type: "start" | "help" | "status" | "cancel" | "message" | "project_message" | "new_session"
    message?: string
    projectName?: string
  }
}

export class TelegramClient {
  private readonly botToken: string
  private readonly shell: any
  private lastUpdateId: number = 0
  private consecutive409Count: number = 0
  private readonly MAX_CONFLICT_RETRIES: number = 5
  private last409Time: number = 0
  private readonly MIN_RETRY_INTERVAL: number = 5000
  private webhookDeleted = false
  private botStartWarningShown = false
  private initialized = false

  constructor(botToken?: string, shell?: any) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || ""
    this.shell = shell
  }

  getLastUpdateId(): number {
    return this.lastUpdateId
  }

  escapeMarkdownV2(text: string): string {
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

  async sendMessage(params: Telegram.SendMessageParams): Promise<boolean> {
    if (!this.botToken) {
      console.error("[Telegram] BOT_TOKEN not configured")
      return false
    }

    if (!this.shell) {
      console.error("[Telegram] BunShell not available")
      return false
    }

    try {
      const payload = {
        chat_id: params.chat_id,
        text: params.text,
        reply_to_message_id: params.reply_to_message_id,
      }
      
      if (params.parse_mode) {
        (payload as any).parse_mode = params.parse_mode
      }

      const jsonData = JSON.stringify(payload)
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`
      
      const result = await this.shell`curl -s -X POST ${url} -H "Content-Type: application/json" -d ${jsonData}`.nothrow().json()
      
      if (!result || !result.ok) {
        console.error(`[Telegram] sendMessage failed: ${result?.error || result?.result || 'unknown error'}`)
        return false
      }

      return true
    } catch (error) {
      console.error("[Telegram] Failed to send message:", error)
      return false
    }
  }

  parseMessage(text: string): Telegram.ParsedMessage {
    const trimmed = text.trim()
    const lower = trimmed.toLowerCase()

    if (lower.startsWith("/start") || lower === "start") {
      const args = trimmed.split(/\s+/).slice(1).join(" ")
      return {
        type: "start",
        message: args || "Session initialized",
      }
    }

    if (lower.startsWith("/help") || lower === "help") {
      return {
        type: "help",
        message: "Commands:\n- /project <name> <message> - Send message to specific project\n- /new_session <name> - Create new session for project\n- /status - Check status\n- /cancel - Cancel current session\n- /help - Show this help",
      }
    }

    if (lower.startsWith("/status") || lower === "status") {
      return {
        type: "status",
        message: "Check status",
      }
    }

    if (lower.startsWith("/cancel") || lower === "cancel") {
      const args = trimmed.split(/\s+/).slice(1).join(" ")
      return {
        type: "cancel",
        message: args || "Cancel all",
      }
    }

    if (lower.startsWith("/project ")) {
      const parts = trimmed.slice(9).trim().split(/\s+/)
      const projectName = parts[0]
      const message = parts.slice(1).join(" ")
      
      console.log("[parseMessage] /project command parsed:", {
        projectName,
        message: message.substring(0, 50)
      })
      
      return {
        type: "project_message",
        projectName,
        message,
      }
    }

    if (lower.startsWith("/new_session ")) {
      const projectName = trimmed.slice(13).trim()
      return {
        type: "new_session",
        projectName,
      }
    }

    if (lower.startsWith("/projects")) {
      return {
        type: "message",
        message: trimmed,
      }
    }

    return {
      type: "message",
      message: trimmed,
    }
  }

  async getUpdates(): Promise<Array<{
    update_id: number
    message?: {
      chat: {
        id: string
        type: string
      }
      text: string
      from?: {
        id: string
        first_name?: string
      }
    }
  }>> {
    if (!this.botToken) {
      console.error("[Telegram] BOT_TOKEN not configured")
      return []
    }

    if (!this.shell) {
      console.warn("[Telegram] BunShell not available, cannot receive messages")
      return []
    }

    try {
      const offset = this.lastUpdateId + 1
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${offset}\u0026timeout=30`
      
      const result = await this.shell`curl -s ${url}`.nothrow().json()
      
      if (!result || !result.ok) {
        console.error(`[Telegram] getUpdates failed: ${result?.error || 'unknown error'}`)
        return []
      }

      if (result.ok && Array.isArray(result.result)) {
        for (const update of result.result) {
          if (update.update_id > this.lastUpdateId) {
            this.lastUpdateId = update.update_id
          }
        }
        
        console.log(`[Telegram] Received ${result.result.length} update(s)`)
        return result.result
      }

      return []
    } catch (error) {
      console.error("[Telegram] Failed to get updates:", error)
      return []
    }
  }

  async setWebhook(webhookUrl: string, allowedUpdates?: string[]): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/setWebhook`
      
      const params: any = { url: webhookUrl }
      if (allowedUpdates) {
        params.allowed_updates = allowedUpdates
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.result
    } catch (error) {
      console.error("[Telegram] Failed to set webhook:", error)
      return false
    }
  }
}

export async function sendTelegramMessage(params: Telegram.SendMessageParams): Promise<boolean> {
  const client = new TelegramClient()
  return await client.sendMessage(params)
}

export function parseTelegramMessage(text: string): Telegram.ParsedMessage {
  const client = new TelegramClient()
  return client.parseMessage(text)
}
