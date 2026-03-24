import z from "zod"

export const TELEGRAM_API_BASE = "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}"

export namespace Telegram {
  export type ChatId = string
  export type MessageId = string
  export type ParsedMessage = {
    type: "start" | "help" | "status" | "cancel" | "message"
    message: string
  }
}

export async function sendTelegramMessage(params: Telegram.SendMessageParams): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    
    if (!botToken) {
      console.error("[Telegram] TELEGRAM_BOT_TOKEN not configured")
      return false
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

export function parseTelegramMessage(text: string): Telegram.ParsedMessage {
  const commands: Record<string, {
    handler: (text: string) => any
    alias?: string[]
  }> = {
    "/start": {
      handler: () => ({ type: "start", message: "Session initialized" }),
      alias: ["start"],
    },
    "/help": {
      handler: () => ({
        type: "help",
        message: `\`\`\`
Commands:
/start - Initialize session
/help - Show this help
/status - Check agent status
/cancel - Stop current work
\`\`\`\nSend any message to forward to OpenCode.
      `.trim(),
      }),
      alias: ["help"],
    },
    "/status": {
      handler: () => ({ type: "status", message: "Checking status..." }),
      alias: ["status"],
    },
    "/cancel": {
      handler: () => ({ type: "cancel", message: "Canceling work..." }),
      alias: ["cancel"],
    },
  }

  const trimmed = text.trim().toLowerCase()
  for (const [cmd, { handler, alias }] of Object.entries(commands)) {
    if (trimmed === cmd || (alias?.includes(trimmed))) {
      return handler(text)
    }
  }

  return {
    type: "message",
    message: text,
  }
}
