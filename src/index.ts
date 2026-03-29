import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TelegramClient } from "./telegram-client"
import { EventHandler } from "./event-handler"
import { loadConfig, getProjectNameFromDirectory, type Config } from "./config"

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory } = input
  const config = loadConfig()
  const projectName = getProjectNameFromDirectory(directory, config)
  
  const chatIds = Array.from(
    new Set([
      process.env.TELEGRAM_CHAT_ID || "",
      ...(config.allowed_chat_ids || []),
    ]),
  ).filter(Boolean)

  const telegramClient = new TelegramClient(config.telegram_bot_token, input.$)
  const eventHandler = new EventHandler(telegramClient.sendMessage.bind(telegramClient), config)

  // Simple polling - no state management
  setInterval(async () => {
    try {
      const updates = await telegramClient.getUpdates()
      
      for (const update of updates) {
        if (!update.message?.text) continue
        
        const parsed = telegramClient.parseMessage(update.message.text)
        const chatId = update.message.chat.id.toString()
        
        console.log(`[Telegram] Received:`, parsed)
        
        if (parsed.type === "project_message" && parsed.message) {
          // Forward to OpenCode via HTTP API
          await forwardToSession(client, parsed.message, chatId, projectName)
        } else if (parsed.type === "message" && parsed.message) {
          // Forward to current session
          await forwardToSession(client, parsed.message, chatId, projectName)
        }
      }
    } catch (error: any) {
      if (!error.message?.includes("409")) {
        console.error("[Telegram Polling] Error:", error.message)
      }
    }
  }, 3000).unref()

  async function forwardToSession(client: any, message: string, chatId: string, projectName: string) {
    // Get last session via HTTP API
    const sessionsRes = await fetch("http://localhost:4096/session", {
      headers: { "Content-Type": "application/json" }
    })
    const sessions = await sessionsRes.json()
    const lastSession = sessions.result?.[0]
    
    if (!lastSession?.id) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `[${projectName}] ❌ No active session. Create one first.`
      })
      return
    }
    
    try {
      await fetch(`http://localhost:4096/session/${lastSession.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parts: [{ type: "text", text: message }] })
      })
      
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `[${projectName}] ✅ Message sent to session ${lastSession.id}`
      })
    } catch (error: any) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `[${projectName}] ❌ Error: ${error.message}`
      })
    }
  }

  return {
    event: async ({ event }) => {
      await eventHandler.handle(event, directory, projectName, chatIds, {
        telegramClient: telegramClient.sendMessage.bind(telegramClient)
      })
    },

    config: async () => {
      console.log(`[TelegramPlugin] Initialized for ${projectName}`)
      console.log(`  Chat IDs: ${chatIds}`)
      console.log(`  Polling started (3s interval)`)
    }
  }
}

export default TelegramPlugin
