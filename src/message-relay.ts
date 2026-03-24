import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"
import { Telegram } from "./telegram-client"

export class MessageRelay {
  private readonly client: OpencodeClient
  private readonly telegramClient: {
    (params: Telegram.SendMessageParams): Promise<boolean>
  }
  private readonly activeSessions = new Map<string, string>()

  constructor(options: {
    client: OpencodeClient
    telegramClient: {
      (params: Telegram.SendMessageParams): Promise<boolean>
    }
  }) {
    this.client = options.client
    this.telegramClient = options.telegramClient
  }

  async relayMessageToOpenCode({
    telegramMessage,
    chatId,
  }: {
    telegramMessage: Telegram.ParsedMessage
    chatId: string
  }): Promise<boolean> {
    if (telegramMessage.type === "start") {
      return await this.handleStartCommand(chatId)
    }

    if (telegramMessage.type === "help") {
      return await this.telegramClient({
        chat_id: chatId,
        text: telegramMessage.message,
        parse_mode: "MarkdownV2",
      })
    }

    if (telegramMessage.type === "cancel") {
      return await this.handleCancelCommand(chatId)
    }

    if (telegramMessage.type === "status") {
      return await this.handleStatusCommand(chatId)
    }

    return await this.forwardToSession(chatId, telegramMessage.message)
  }

  async handleStartCommand(
    chatId: string,
  ): Promise<boolean> {
    try {
      const sessions = await this.client.session.list()
      const activeSession = sessions.find((s) => s.active) ?? sessions[0]

      if (activeSession) {
        this.activeSessions.set(chatId, activeSession.id)

        return await this.telegramClient({
          chat_id: chatId,
          text: `✅ Session initialized\n\nSession ID: \`${activeSession.id.substring(0, 8)}...\`\n\nSend your task request.`,
          parse_mode: "MarkdownV2",
        })
      }

      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active sessions found.\n\nStart a session in OpenCode first.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    } catch (error) {
      console.error("[MessageRelay] Failed to list sessions:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: "❌ Failed to initialize session. Check connection.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    }
  }

  async handleCancelCommand(chatId: string): Promise<boolean> {
    const sessionId = this.activeSessions.get(chatId)

    if (!sessionId) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active session linked.\n\nUse /start first.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    }

    try {
      const response = await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [
            {
              type: "text",
              text: "CANCELED: User requested to stop work. Please halt current operations.",
            },
          ],
        },
      })

      if (response.success) {
        await this.telegramClient({
          chat_id: chatId,
          text: "🛑 Work cancellation sent.\n\nThe agent will stop shortly.\n\n---\n",
          parse_mode: "MarkdownV2",
        })
      }

      return response.success ?? true
    } catch (error) {
      console.error("[MessageRelay] Failed to cancel:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: "❌ Failed to cancel work.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    }
  }

  async handleStatusCommand(chatId: string): Promise<boolean> {
    const sessionId = this.activeSessions.get(chatId)

    if (!sessionId) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active session.\n\nUse /start first.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    }

    try {
      const session = await this.client.session.get({
        path: { id: sessionId },
      })

      const status =[
        `📊 Session Status:`,
        `ID: \`${sessionId.substring(0, 8)}...\``,
        `Agent: \`${session.agent || "default"}\``,
        `Model: \`${session.model || "unknown"}\``,
        `Status: \`${session.status || "unknown"}\``,
        "\n---\n",
      ].join("\n")

      return await this.telegramClient({
        chat_id: chatId,
        text: status,
        parse_mode: "MarkdownV2",
      })
    } catch (error) {
      console.error("[MessageRelay] Failed to get status:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: "❌ Failed to get status.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    }
  }

  async forwardToSession(
    chatId: string,
    message: string,
  ): Promise<boolean> {
    const sessionId = this.activeSessions.get(chatId)

    if (!sessionId) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active session linked.\n\nUse /start first.\n\n---\n",
        parse_mode: "MarkdownV2",
      })
    }

    try {
      await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: message }],
        },
      })

      await this.telegramClient({
        chat_id: chatId,
        text: `📨 Message sent to session \`${sessionId.substring(0, 8)}...\`\n\nWaiting for agent response...\n\n---\n`,
        parse_mode: "MarkdownV2",
      })

      return true
    } catch (error) {
      console.error("[MessageRelay] Failed to forward message:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: `❌ Failed to send message: ${error instanceof Error ? error.message : String(error)}\n\n---\n`,
        parse_mode: "MarkdownV2",
      })
    }
  }

  linkSession(
    chatId: string,
    sessionId: string,
  ) {
    this.activeSessions.set(chatId, sessionId)
  }

  unlinkSession(chatId: string) {
    this.activeSessions.delete(chatId)
  }
}
