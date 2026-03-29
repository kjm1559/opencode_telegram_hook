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

// Global polling state - shared across all plugin instances
let globalPollingStarted = false
let globalPollingInterval: NodeJS.Timeout | null = null
const globalProjectRegistry = new Map<string, {
  projectName: string
  directory: string
  telegramClient: TelegramClient
  config: Config
  input: PluginInput
  chatIds: string[]
  latestSessionId: string | null
  projectContext: Map<string, any>
}>()

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory, worktree } = input

  const config: Config = loadConfig()

  const defaultChatIds = Array.from(
    new Set([
      process.env.TELEGRAM_CHAT_ID || "",
      ...(config.allowed_chat_ids || []),
    ]),
  ).filter(Boolean)

    const telegramClient = new TelegramClient(config.telegram_bot_token, input.$)
    const eventHandler = new EventHandler(telegramClient.sendMessage.bind(telegramClient), config)
    const workSummarizer = new WorkSummarizer()
    const messageRelay = new MessageRelay({ client, telegramClient: telegramClient.sendMessage.bind(telegramClient), config })
    
    // Store references for use in config function
    const handlers = { eventHandler, telegramClient }

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
        if (e.info?.id) return String(e.info.id)
        if (e.sessionID) return String(e.sessionID)
        if (e.properties?.sessionID) return String(e.properties.sessionID)
        if (e.properties?.id) return String(e.properties.id)
        if (e.properties?.info?.id) return String(e.properties.info.id)
        if (e.properties?.info?.sessionID) return String(e.properties.info.sessionID)
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

      const isMessagePartEvent = event.type === "message.part.updated"
      
      if (!sessionId && !isMessagePartEvent) {
        eventLog(`✗ No session_id (type=${event.type})`)
        return
      }

      if (sessionId) {
        eventLog(`✓ Using session: ${sessionId}`)
      } else if (isMessagePartEvent) {
        eventLog(`⚡ Message part update (no session_id, using cached)`)
      }

      const projectDir = event.payload?.directory || directory
      const eventProjectName = getProjectNameFromDirectory(projectDir, config)

      if (!projectContext.has(projectDir)) {
        projectContext.set(projectDir, {
          projectId: eventProjectName,
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
        eventLog(`🏁 SESSION COMPLETE EVENT! type=${event.type}, workInProgress=${context.workInProgress}`)
        console.log("[Index] Session complete event:", {
          type: event.type,
          workInProgress: context.workInProgress,
          eventHistoryLength: context.eventHistory.length,
          eventName: eventProjectName,
        })
        if (context.workInProgress) {
          context.workInProgress = false
          eventLog(`Generating summary with ${context.eventHistory.length} events...`)
          const summary = workSummarizer.generate(context, eventProjectName)
            if (summary) {
              eventLog(`Summary generated (${summary.length} chars), sending to ${context.telegramChatIds.length} chat(s)`)
              for (const chatId of context.telegramChatIds) {
                await telegramClient.sendMessage({
                  chat_id: chatId,
                  text: summary
                })
              }
          } else {
            eventLog(`⚠️ Summary was null (no tracked work)`)
          }
        } else {
          eventLog(`Skipping summary: workInProgress was false`)
        }
      }

      await eventHandler.handle(event, projectDir, eventProjectName, context.telegramChatIds, {
        telegramClient: telegramClient.sendMessage.bind(telegramClient)
      })
    },

    "chat.message": async (input) => {
      console.log("[ChatMessageHandler] ======== CHAT MESSAGE RECEIVED ========")
      console.log("[ChatMessageHandler] input:", JSON.stringify(input, null, 2))
      
      const sessionId = input.sessionID
      const messageContent = input.message?.content?.toString() || ""
      
      console.log(`[ChatMessageHandler] sessionId: ${sessionId}`)
      console.log(`[ChatMessageHandler] messageContent: "${messageContent}"`)
      console.log(`[ChatMessageHandler] messageContent.trim(): "${messageContent.trim()}"`)
      console.log(`[ChatMessageHandler] isEmpty: ${!messageContent.trim()}`)
      
      if (!messageContent.trim()) {
        console.log("[ChatMessageHandler] Ignoring empty message")
        return // Ignore empty messages
      }
      
      // Find the project context for this session
      console.log(`[ChatMessageHandler] Looking for sessionId ${sessionId} in projectContext`)
      console.log(`[ChatMessageHandler] projectContext size: ${projectContext.size}`)
      
      for (const [dir, ctx] of projectContext.entries()) {
        console.log(`[ChatMessageHandler] Checking dir: ${dir}, lastSessionId: ${ctx.lastSessionId}, telegramChatIds length: ${ctx.telegramChatIds.length}`)
        if (ctx.lastSessionId === sessionId && ctx.telegramChatIds.length > 0) {
          const projectName = getProjectNameFromDirectory(dir, config)
          console.log(`[ChatMessageHandler] Found matching project: ${projectName}`)
          
          try {
            // Send the user's message to the OpenCode session using the OpenCode client
            console.log(`[ChatMessageHandler] Sending message to session ${sessionId}: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? "..." : ""}"`)
            
            // Use the OpenCode client to send a user message to the session
            await client.session.prompt({
              path: { id: sessionId },
              body: {
                parts: [{ type: "text", text: messageContent }],
              },
            })
            
            // Send confirmation back to Telegram
            for (const chatId of ctx.telegramChatIds) {
              const escapedText = `[${telegramClient.escapeMarkdownV2(projectName)}] 📩 Message sent to OpenCode session`
              await telegramClient.sendMessage({
                chat_id: chatId,
                text: escapedText
              })
            }
          } catch (error) {
            console.error("[ChatMessageHandler] Error sending message to OpenCode:", error)
            console.error("[ChatMessageHandler] Error stack:", error.stack)
            // Send error notification to Telegram
            for (const chatId of ctx.telegramChatIds) {
              const escapedError = `[${telegramClient.escapeMarkdownV2(projectName)}] ❌ Failed to send message: ${telegramClient.escapeMarkdownV2(error.message)}`
              await telegramClient.sendMessage({
                chat_id: chatId,
                text: escapedError
              })
            }
          }
          break
        }
      }
      
      console.log("[ChatMessageHandler] ======== CHAT MESSAGE PROCESSING COMPLETE ========")
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
    
    shouldNotify: (eventType: string) => {
      const lowerEventType = eventType.toLowerCase()
      const shouldTrackEvents = [
        "message.created",
        "message.updated",
        "message.part.updated",
        "tool.execute.before",
        "tool.execute.after",
        "command.executed",
        "lsp.client.diagnostics",
        "session.started",
        "session.status",
        "session.diff",
        "session.updated",
        "session.completed",
        "session.finished",
      ]
      const result = shouldTrackEvents.some((pattern) => 
        lowerEventType.includes(pattern.toLowerCase())
      )
      console.log(`[TelegramPlugin] shouldNotify check: "${eventType}" -> ${result}`)
      return result
    },

    config: async () => {
      const projectKey = directory
      
      // Register this project globally
      if (!globalProjectRegistry.has(projectKey)) {
        globalProjectRegistry.set(projectKey, {
          projectName,
          directory,
          telegramClient,
          config,
          input,
          chatIds: defaultChatIds,
          latestSessionId: null,
          projectContext: new Map()
        })
        
        console.log("[Telegram] Project registered:", projectName)
        console.log("[Telegram] Total projects:", globalProjectRegistry.size)
      } else {
        console.log("[Telegram] Skipping - Project already registered:", projectName)
      }
      
      // File-based lock to ensure only one instance polls across all plugin instances
      const lockFile = "/tmp/telegram_plugin.lock"
      const fs = await import("fs/promises")
      const hasLock = await fs.access(lockFile).then(() => true).catch(() => false)
      
      if (!hasLock && !globalPollingStarted) {
        try {
          await fs.writeFile(lockFile, process.pid.toString())
          globalPollingStarted = true
          globalPollingInterval = setInterval(globalPollingLoop, 3000)
          console.log("[Telegram] Global polling started (3s interval) - Lock acquired (PID:", process.pid, ")")
        } catch (error: any) {
          console.log("[Telegram] Lock already exists - Skipping polling")
        }
      } else if (hasLock) {
        console.log("[Telegram] Skipping polling - Lock already exists")
      } else {
        console.log("[Telegram] Skipping polling - Already started")
      }
      
      console.log("\n===== [TelegramPlugin] Initialized ====")
      console.log("  Directory:", directory)
      console.log("  Bot token set:", !!(config.telegram_bot_token))
      console.log("  Projects:", config.projects?.length || 0)
      console.log("  Chat IDs:", defaultChatIds)
      console.log("  TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID || "NOT SET")
      console.log("  Polling:", globalPollingStarted ? "Running (first instance)" : "Disabled")
      console.log("  Registry size:", globalProjectRegistry.size)
      console.log("================================\n")
    }
  }
}

// Global polling function - single instance for all projects
async function globalPollingLoop() {
  // Only one instance should poll - use the first registered project's client
  const firstProject = globalProjectRegistry.values().next().value
  if (!firstProject) {
    return
  }
  
  try {
    const updates = await firstProject.telegramClient.getUpdates()
    
    for (const update of updates) {
      if (!update.message?.text) continue
      
      const parsedMessage = firstProject.telegramClient.parseMessage(update.message.text)
      const chatId = update.message.chat.id.toString()
      
      console.log(`[Polling] Received message from ${chatId}:`, parsedMessage)
      
      await processTelegramMessage(parsedMessage, chatId, firstProject, updates[0]?.update_id)
    }
  } catch (error) {
    console.error("[GlobalPolling] Error:", error)
  }
}

async function processTelegramMessage(
  parsedMessage: any,
  chatId: string,
  ctx: any,
  updateId?: number
) {
  const { client } = ctx.input
  
  if (parsedMessage.type === "project_message" && parsedMessage.projectName) {
    const targetProject = Array.from(globalProjectRegistry.values()).find(
      p => p.projectName === parsedMessage.projectName
    )
    
    if (!targetProject) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Project not found: ${parsedMessage.projectName}\n\nAvailable projects:\n${Array.from(globalProjectRegistry.values()).map(p => `- ${p.projectName}`).join('\n')}`
      })
      return
    }
    
    const sessionId = targetProject.latestSessionId
    if (!sessionId) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ No active session for project: ${parsedMessage.projectName}\n\nUse /new_session ${parsedMessage.projectName} to create a new session.`
      })
      return
    }
    
    try {
      await client.session.prompt({
        path: { id: sessionId },
        body: { parts: [{ type: "text", text: parsedMessage.message }] }
      })
      
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `✅ Message sent to ${parsedMessage.projectName}\nSession: ${sessionId}`
      })
    } catch (error: any) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Failed to send message: ${error.message}`
      })
    }
  }
  
  else if (parsedMessage.type === "new_session" && parsedMessage.projectName) {
    const targetProject = Array.from(globalProjectRegistry.values()).find(
      p => p.projectName === parsedMessage.projectName
    )
    
    if (!targetProject) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Project not found: ${parsedMessage.projectName}`
      })
      return
    }
    
    try {
      const result = await client.session.create({
        body: { directory: targetProject.directory }
      })
      
      targetProject.latestSessionId = result.id
      
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `✅ New session created for ${parsedMessage.projectName}\nSession ID: ${result.id}`
      })
    } catch (error: any) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Failed to create session: ${error.message}`
      })
    }
  }
  
  else if (parsedMessage.type === "message" && parsedMessage.message) {
    const sessionId = ctx.latestSessionId
    if (!sessionId) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ No active session for ${ctx.projectName}`
      })
      return
    }
    
    try {
      await client.session.prompt({
        path: { id: sessionId },
        body: { parts: [{ type: "text", text: parsedMessage.message }] }
      })
      
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `✅ Message sent to ${ctx.projectName}`
      })
    } catch (error: any) {
      await ctx.telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Failed to send message: ${error.message}`
      })
    }
  }
}

export default TelegramPlugin
