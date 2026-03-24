import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TelegramClient } from "./telegram-client"
import { EventHandler } from "./event-handler"
import { WorkSummarizer } from "./work-summarizer"
import { MessageRelay } from "./message-relay"
import {
  loadConfig,
  loadProjectState,
  saveProjectState,
  getProjectNameFromDirectory,
  type Config,
  type ProjectSessionState,
} from "./config"

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory, worktree } = input

  const config: Config = loadConfig()

  const telegramClient = new TelegramClient(config.telegram_bot_token)
  const eventHandler = new EventHandler(telegramClient.sendMessage.bind(telegramClient), config)
  const workSummarizer = new WorkSummarizer()
  const messageRelay = new MessageRelay({ client, telegramClient: telegramClient.sendMessage.bind(telegramClient), config })

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
      const sessionId = event.session_id || event.sessionId || event.properties?.session_id

      if (!sessionId) return

      const projectDir = event.payload?.directory || directory
      const projectName = getProjectNameFromDirectory(projectDir, config)

      if (!projectContext.has(projectDir)) {
        projectContext.set(projectDir, {
          projectId: projectName,
          telegramChatIds: [],
          eventHistory: [],
          workInProgress: false,
          lastSessionId: sessionId,
        })
      }

      const context = projectContext.get(projectDir)!
      context.lastSessionId = sessionId

      context.eventHistory.push({
        type: event.type,
        title: event.title || event.type,
        timestamp: Date.now(),
        payload: { event, directory: projectDir, worktree },
      })

      if (event.type === "session.started" || event.type === "message.created") {
        context.workInProgress = true
      }

      if (event.type === "session.completed" || event.type === "session.finished") {
        if (context.workInProgress) {
          context.workInProgress = false

          const summary = workSummarizer.generate(context, projectName)
          for (const chatId of context.telegramChatIds) {
            if (summary) {
              await telegramClient.sendMessage({
                chat_id: chatId,
                text: summary,
                parse_mode: "MarkdownV2",
              })
            }
          }
        }
      }

      await eventHandler.handle(event, projectDir, projectName, context.telegramChatIds, { telegramClient: telegramClient.sendMessage.bind(telegramClient) })
    },

    "chat.message": async (input, output) => {
      const sessionId = input.sessionID

      for (const [dir, ctx] of projectContext.entries()) {
        if (ctx.lastSessionId === sessionId && ctx.telegramChatIds.length > 0) {
          const projectName = getProjectNameFromDirectory(dir, config)
          for (const chatId of ctx.telegramChatIds) {
            await telegramClient.sendMessage({
              chat_id: chatId,
              text: `[${projectName}] 📝 User: ${output.message?.content || "[message content]"}`,
              parse_mode: "MarkdownV2",
            })
          }
        }
      }
    },

    "tool.execute.after": async (input) => {
      const sessionId = input.sessionID

      for (const [dir, ctx] of projectContext.entries()) {
        if (ctx.lastSessionId === sessionId && ctx.workInProgress) {
          if (input.tool === "edit" || input.tool === "write") {
            workSummarizer.trackFileModification(
              dir,
              input.args?.filePath || "unknown",
              input.output?.title || "modified",
            )
          }

          if (input.tool === "bash" && (input.args?.command || "").includes("test")) {
            const success = !input.output?.output?.includes("failed") && !input.output?.output?.includes("error")
            workSummarizer.trackTestRun(dir, success)
          }
        }
      }
    },

    config: async () => {
      console.log("[TelegramPlugin] Initialized - directory:", directory)
    },
  }
}

export default TelegramPlugin
