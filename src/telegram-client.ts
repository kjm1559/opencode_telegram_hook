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
    type: "start" | "help" | "status" | "cancel" | "message"
    message: string
  }
}

export class TelegramClient {
  private readonly botToken: string
  private lastUpdateId: number = 0
  private consecutive409Count: number = 0
  private readonly MAX_CONFLICT_RETRIES: number = 5

  constructor(botToken?: string) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || ""
  }

  getLastUpdateId(): number {
    return this.lastUpdateId
  }

  escapeMarkdownV2(text: string): string {
    // Telegram MarkdownV2 requires escaping these characters with backslash
    // Process backslash FIRST to avoid double-escaping
    let result = text.replace(/\\/g, '\\\\')
    
    // Then escape all other special characters
    const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for (const char of specialChars) {
      result = result.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '\\' + char)
    }
    
    return result
  }

  async sendMessage(params: Telegram.SendMessageParams): Promise<boolean> {
    if (!this.botToken) {
      console.error("[Telegram] BOT_TOKEN not configured")
      return false
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: params.chat_id,
          text: params.text,
          parse_mode: params.parse_mode || "MarkdownV2",
          reply_to_message_id: params.reply_to_message_id,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Telegram] API error:", response.status, errorText)
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
        message: "Commands: /start, /help, /status, /cancel, /new\n",
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

    if (lower.startsWith("/new")) {
      return {
        type: "message",
        message: trimmed,
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

    try {
      const offset = this.lastUpdateId + 1
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${offset}&timeout=30`,
        {
          method: "GET",
        },
      )

      if (!response.ok) {
        if (response.status === 409) {
          this.consecutive409Count++
          console.log(
            `[Telegram] Resetting update offset due to conflict (attempt ${this.consecutive409Count})`
          )
          this.lastUpdateId = 0
          
          if (this.consecutive409Count > this.MAX_CONFLICT_RETRIES) {
            console.warn(
              `[Telegram] WARNING: Persistent 409 conflicts (${this.consecutive409Count} attempts). ` +
              'Possible causes: multiple bot instances, webhook still active, or stale offset.'
            )
            this.consecutive409Count = 0 // Reset counter to avoid spam
          }
          return []
        }
        // Reset 409 counter on other errors
        this.consecutive409Count = 0
        console.error(`[Telegram] HTTP error: ${response.status}`)
        return []
      }
      
      // Success - reset 409 counter
      this.consecutive409Count = 0

      const data = await response.json()
      const updates = data.result || []
      
      if (updates.length > 0) {
        this.lastUpdateId = Math.max(this.lastUpdateId, ...updates.map(u => u.update_id))
      }
      
      return updates
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
