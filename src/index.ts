import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TelegramClient } from "./telegram-client"
import { EventHandler } from "./event-handler"
import { WorkSummarizer } from "./work-summarizer"
import { MessageRelay } from "./message-relay"

/**
 * OpenCode Telegram Plugin
 * 
 * Integrates OpenCode agent work with Telegram:
 * - Real-time work updates
 * - Completion summaries
 * - Bidirectional message relay
 */
export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory, worktree } = input

  // Initialize core components
  const telegramClient = new TelegramClient()
  const eventHandler = new EventHandler(telegramClient)
  const workSummarizer = new WorkSummarizer()
  const messageRelay = new MessageRelay({ client, telegramClient })

  // Session-work tracking state
  const sessionContext = new Map<string, {
    telegramChatId?: string
    eventHistory: Array<{
      type: string
      title: string
      timestamp: number
      payload: any
    }>
    workInProgress: boolean
  }>()

  return {
    /**
     * Event hook: Listen to all OpenCode events
     * - Agent activity (thinking, tool calls)
     * - Tool execution results
     * - Session lifecycle
     */
    event: async ({ event }) => {
      // Extract session info from event
      const sessionId = event.session_id || event.sessionId || event.properties?.session_id
      
      if (!sessionId) return

      // Initialize session context
      if (!sessionContext.has(sessionId)) {
        sessionContext.set(sessionId, {
          eventHistory: [],
          workInProgress: false,
        })
      }

      const context = sessionContext.get(sessionId)!

      // Track event
      context.eventHistory.push({
        type: event.type,
        title: event.title || event.type,
        timestamp: Date.now(),
        payload: {
          event,
          directory,
          worktree,
        },
      })

      // Detect work start
      if (event.type === "session.started" || event.type === "message.created") {
        context.workInProgress = true
      }

      // Detect work completion
      if (event.type === "session.completed" || event.type === "session.finished") {
        if (context.workInProgress) {
          context.workInProgress = false
          
          // Generate and send summary
          const summary = workSummarizer.generate(context)
          if (context.telegramChatId && summary) {
            await telegramClient.sendMessage({
              chatId: context.telegramChatId,
              text: summary,
              format: "markdownv2",
            })
          }
        }
      }

      // Forward agent output to Telegram
      await eventHandler.handle(event, sessionId, context, { telegramClient, directory, worktree })
    },

    /**
     * Chat message hook: Before message sent to LLM
     * - Capture user intent
     * - Link Telegram chat to session
     */
    "chat.message": async (input, output) => {
      const sessionId = input.sessionID
      const context = sessionContext.get(sessionId)
      
      if (context?.telegramChatId) {
        // Log user message to Telegram
        await telegramClient.sendMessage({
          chatId: context.telegramChatId,
          text: `📝 User: ${output.message?.content || "[message content]"}`,
        })
      }
    },

    /**
     * Tool execution hook: Track tool usage
     * - File operations
     * - Command execution
     * - Build/test results
     */
    "tool.execute.after": async (input) => {
      const sessionId = input.sessionID
      const context = sessionContext.get(sessionId)

      if (!context || !context.workInProgress) return

      // Track tool results for summary
      if (input.tool === "edit" || input.tool === "write") {
        workSummarizer.trackFileModification(
          sessionId,
          input.args?.filePath || "unknown",
          input.output?.title || "modified",
        )
      }

      if (input.tool === "bash" && (input.args?.command || "").includes("test")) {
        const success = !input.output?.output?.includes("failed") && !input.output?.output?.includes("error")
        workSummarizer.trackTestRun(sessionId, success)
      }
    },

    /**
     * Configuration hook: Validate plugin settings
     */
    config: async (config) => {
      // Could validate TELEGRAM_BOT_TOKEN presence or other settings
      console.log("[TelegramPlugin] Config loaded", { directory })
    },
  }
}

export default TelegramPlugin
