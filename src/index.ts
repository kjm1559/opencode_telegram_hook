import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TelegramClient } from "./telegram-client"
import { EventHandler } from "./event-handler"
import { WorkSummarizer } from "./work-summarizer"
import { MessageRelay } from "./message-relay"
import {
  loadConfig,
  getProjectNameFromDirectory,
  type Config,
} from "./config"

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory, worktree } = input

  const config: Config = loadConfig()

  const defaultChatIds = Array.from(
    new Set([
      process.env.TELEGRAM_CHAT_ID || "",
      ...(config.allowed_chat_ids || []),
    ]),
  ).filter(Boolean)

  const telegramClient = new TelegramClient(config.telegram_bot_token)
  const eventHandler = new EventHandler(telegramClient.sendMessage.bind(telegramClient), config)
  const workSummarizer = new WorkSummarizer()
  const messageRelay = new MessageRelay({ client, telegramClient: telegramClient.sendMessage.bind(telegramClient), config })

  let latestSessionId: string | null = null

  const projectName = getProjectNameFromDirectory(directory, config)
  
  const projectContext = new Map<string, {
    projectId: string
    telegramChatIds: Array<string>
    eventHistory: Array<{
      type: string
      title: string
      timestamp: number
      payload: any
    }>
    workInProgress: boolean
    lastSessionId: string | null
  }>()

  return {
    event: async ({ event }) => {
      const eventLog = (msg: string) => console.log(`[💬 ${projectName}] [${event.type}]`, msg)
      
      // Extract session_id based on OpenCode event structure
      const getSessionId = (e: any): string | null => {
        // Try standard locations first (sessionID in properties)
        if (e.properties?.sessionID) {
          return String(e.properties.sessionID)
        }
        if (e.properties?.id) {
          return String(e.properties.id)
        }
        // For session.started/updated events with info object
        if (e.properties?.info?.id) {
          return String(e.properties.info.id)
        }
        // Direct event properties (fallback)
        if (e.sessionID) {
          return String(e.sessionID)
        }
        return null
      }
      
      const extractedSessionId = getSessionId(event)
      
      if (event.type === "session.started") {
        if (extractedSessionId) {
          latestSessionId = extractedSessionId
          eventLog(`✓ Cached session: ${latestSessionId}`)
        } else {
          eventLog(`✗ FAILED TO CACHE: session.started but no session_id found!`)
          console.log(`  session.started properties:`, event.properties)
        }
      } else if (["session.completed", "session.finished", "session.idle"].includes(event.type)) {
        const completedSessionId = getSessionId(event)
        if (completedSessionId && latestSessionId === completedSessionId) {
          latestSessionId = null
          eventLog(`✓ Cleared session cache`)
        }
      }

      const sessionId = extractedSessionId || latestSessionId

      if (!sessionId) {
        eventLog(`✗ No session_id (type=${event.type})`)
        return
      }

      eventLog(`✓ Using session: ${sessionId}`)

      const projectDir = event.payload?.directory || directory
      const projectName = getProjectNameFromDirectory(projectDir, config)

      if (!projectContext.has(projectDir)) {
        projectContext.set(projectDir, {
          projectId: projectName,
          telegramChatIds: defaultChatIds,
          eventHistory: [],
          workInProgress: false,
          lastSessionId: sessionId
        })
      }

      const context = projectContext.get(projectDir)!
      context.lastSessionId = sessionId

      context.eventHistory.push({
        type: event.type,
        title: event.title || event.type,
        timestamp: Date.now(),
        payload: { event, directory: projectDir, worktree }
      })

      if (["session.started", "message.created"].includes(event.type)) {
        context.workInProgress = true
      }

      if (["session.completed", "session.finished"].includes(event.type)) {
        if (context.workInProgress) {
          context.workInProgress = false
          const summary = workSummarizer.generate(context, projectName)
          if (summary) {
            for (const chatId of context.telegramChatIds) {
              await telegramClient.sendMessage({
                chat_id: chatId,
                text: summary,
                parse_mode: "MarkdownV2"
              })
            }
          }
        }
      }

      await eventHandler.handle(event, projectDir, projectName, context.telegramChatIds, {
        telegramClient: telegramClient.sendMessage.bind(telegramClient)
      })
    },

    "chat.message": async (input) => {
      const sessionId = input.sessionID
      for (const [dir, ctx] of projectContext.entries()) {
        if (ctx.lastSessionId === sessionId && ctx.telegramChatIds.length > 0) {
          const projectName = getProjectNameFromDirectory(dir, config)
          for (const chatId of ctx.telegramChatIds) {
            await telegramClient.sendMessage({
              chat_id: chatId,
              text: `[${projectName}] 📝 User: ${input.message?.content || "[message content]"}`,
              parse_mode: "MarkdownV2"
            })
          }
        }
      }
    },

    "tool.execute.after": async (input) => {
      const sessionId = input.sessionID
      for (const [dir, ctx] of projectContext.entries()) {
        if (ctx.lastSessionId === sessionId && ctx.workInProgress) {
          if ((input.tool === "edit" || input.tool === "write") && input.args?.filePath) {
            workSummarizer.trackFileModification(dir, input.args.filepath, input.output?.title || "modified")
          }
          if (input.tool === "bash" && input.args?.command?.includes("test")) {
            const success = !input.output?.output?.includes("failed") && !input.output?.output?.includes("error")
            workSummarizer.trackTestRun(dir, success)
          }
        }
      }
    },

    config: async () => {
      try {
        if (defaultChatIds.length > 0) {
          await telegramClient.sendMessage({
            chat_id: defaultChatIds[0],
            text: `🔧 *Telegram Plugin Loaded*\n\n📂 *Project:* ${projectName}\n📁 *Directory:* \`${directory}\`\n\nPlugin is now active and ready to receive events from OpenCode.`,
            parse_mode: "MarkdownV2"
          })
        }
      } catch (e) {
        console.error("Failed to send startup message:", e)
      }
      
      console.log("\n===== [TelegramPlugin] Initialized ====")
      console.log("  Directory:", directory)
      console.log("  Bot token set:", !!(config.telegram_bot_token))
      console.log("  Projects:", config.projects?.length || 0)
      console.log("  Chat IDs:", defaultChatIds)
      console.log("  TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID || "NOT SET")
      console.log("=================================\n")
    }
  }
}

export default TelegramPlugin
