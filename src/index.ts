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

  return {
    event: async ({ event }) => {
      await eventHandler.handle(event, directory, projectName, chatIds, {
        telegramClient: telegramClient.sendMessage.bind(telegramClient)
      })
    },

    "chat.message": async (input) => {
      const sessionId = input.sessionID
      const messageContent = input.message?.content?.toString() || ""
      
      if (!messageContent.trim()) return
      
      try {
        await client.session.prompt({
          path: { id: sessionId },
          body: { parts: [{ type: "text", text: messageContent }] },
        })
        
        for (const chatId of chatIds) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `[${projectName}] 📩 Message sent to OpenCode session`
          })
        }
      } catch (error: any) {
        for (const chatId of chatIds) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `[${projectName}] ❌ Error: ${error.message}`
          })
        }
      }
    },

    config: async () => {
      console.log(`[TelegramPlugin] Initialized for ${projectName}`)
      console.log(`  Chat IDs: ${chatIds}`)
    }
  }
}

export default TelegramPlugin
