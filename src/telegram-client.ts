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
  private lastUpdateId: number = 0
  private consecutive409Count: number = 0
  private readonly MAX_CONFLICT_RETRIES: number = 5
  private last409Time: number = 0
  private readonly MIN_RETRY_INTERVAL: number = 5000
  private webhookDeleted = false
  private botStartWarningShown = false

  constructor(botToken?: string) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || ""
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

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`

      const payload: any = {
        chat_id: params.chat_id,
        text: params.text,
        reply_to_message_id: params.reply_to_message_id,
      }
      
      // Only add parse_mode if explicitly provided
      if (params.parse_mode) {
        payload.parse_mode = params.parse_mode
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        
        if (response.status === 404) {
          // 404: Bot not found or invalid token
          console.error(
            `[Telegram] 404 Not Found - Check your bot token. ` +
            `Error: ${errorText.substring(0, 100)}`
          )
        } else if (response.status === 400) {
          // 400: Bad Request - usually invalid chat_id or message format
          console.error(
            `[Telegram] 400 Bad Request - Check chat_id and message format. ` +
            `Error: ${errorText.substring(0, 200)}`
          )
        } else {
          console.error(`[Telegram] API error: ${response.status} ${errorText.substring(0, 100)}`)
        }
        
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
      console.log("[getUpdates] No bot token")
      return []
    }

    // Always delete webhook to ensure clean state
    try {
      const webhookUrl = `https://api.telegram.org/bot${this.botToken}/deleteWebhook`
      console.log("[getUpdates] Deleting webhook:", webhookUrl.substring(0, 80) + "...")
      const webhookResponse = await fetch(webhookUrl, { method: "POST" })
      const webhookData = await webhookResponse.json()
      console.log("[getUpdates] Webhook delete response:", webhookResponse.status, webhookData.ok ? "success" : webhookData.description)
      this.webhookDeleted = true
    } catch (e) {
      console.error("[getUpdates] Failed to delete webhook:", e)
    }

    try {
      const offsetParam = this.lastUpdateId > 0 ? `&offset=${this.lastUpdateId + 1}` : ''
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates${offsetParam}&timeout=30`
      
      console.log("[getUpdates] Calling Telegram API:", {
        lastUpdateId: this.lastUpdateId,
        url: url.substring(0, 80) + "..."
      })
      
      const response = await fetch(url, { method: "GET" })
      
      console.log("[getUpdates] Response status:", response.status)
      
      if (!response.ok) {
        console.error("[getUpdates] API error:", response.status)
        
        // Handle 404 - bot may not be started
        if (response.status === 404) {
          if (!this.botStartWarningShown) {
            console.warn(
              "[getUpdates] ⚠️  Bot not activated. Please send /start to @mjkim_cc_bot in Telegram."
            )
            this.botStartWarningShown = true
          }
        }
        
        return []
      }

      const data = await response.json()
      const updates = data.result || []
      
      console.log("[getUpdates] Received updates:", updates.length)
      
      if (updates.length > 0) {
        this.lastUpdateId = Math.max(this.lastUpdateId, ...updates.map(u => u.update_id))
        console.log("[getUpdates] Updated lastUpdateId to:", this.lastUpdateId)
        
        // Log each update
        updates.forEach(u => {
          if (u.message) {
            console.log("[getUpdates] Update details:", {
              update_id: u.update_id,
              chat_id: u.message.chat.id,
              text: u.message.text.substring(0, 100)
            })
          }
        })
      }
      
      return updates
    } catch (error) {
      console.error("[getUpdates] Error:", error)
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
