import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TelegramClient } from "./telegram-client"
import { EventHandler } from "./event-handler"
import { WorkSummarizer } from "./work-summarizer"
import { MessageRelay } from "./message-relay"

console.log("[TelegramPlugin] File loaded - starting plugin execution")
import {
  loadConfig,
  loadProjectState,
  saveProjectState,
  getProjectNameFromDirectory,
  type Config,
  type ProjectSessionState,
} from "./config"

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  console.log("[TelegramPlugin] Plugin function called")
  const { client, directory, worktree } = input

  const config: Config = loadConfig()

  // Get chat IDs from environment variables and config
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
      console.log("[TelegramPlugin] Event received:", event.type, "-", event.title)
      console.log("  Default chat IDs:", defaultChatIds)
      
      // Enhanced session ID extraction for different event types
      let sessionIdRaw = null;
      
      // Standard locations
      sessionIdRaw = event.session_id || event.sessionId || event.properties?.session_id || event.payload?.session_id;
      
      // For message events, check additional locations
      if (!sessionIdRaw && (event.type === "message.part.delta" || event.type === "message.part.updated" || 
                           event.type === "message.created" || event.type === "message.updated")) {
        // Try to get session from message properties or context
        sessionIdRaw = event.properties?.session_id || 
                      event.message?.session_id ||
                      (event.payload && event.payload.session_id) ||
                      (event.context && event.context.session_id);
      }
      
      // For tool events, check different locations
      if (!sessionIdRaw && event.type.startsWith("tool.execute")) {
        sessionIdRaw = event.session_id || event.sessionId || 
                      event.properties?.session_id ||
                      (event.context && event.context.session_id);
      }
      
      // For command events
      if (!sessionIdRaw && event.type === "command.executed") {
        sessionIdRaw = event.session_id || event.sessionId ||
                      event.properties?.session_id ||
                      (event.arguments && event.arguments.session_id);
      }
      
      // For session events
      if (!sessionIdRaw && (event.type === "session.started" || event.type === "session.completed" ||
                           event.type === "session.updated" || event.type === "session.status" ||
                           event.type === "session.idle" || event.type === "session.diff")) {
        sessionIdRaw = event.session_id || event.sessionId ||
                      event.properties?.session_id ||
                      (event.payload && event.payload.session_id);
      }
      
      // Last resort: check if there's any session-like property
      if (!sessionIdRaw) {
        // Look for any property that might contain session info
        const sessionLikeProps = ['sessionId', 'session_id', 'session'];
        for (const prop of sessionLikeProps) {
          if (event[prop] !== undefined && event[prop] !== null) {
            sessionIdRaw = event[prop];
            break;
          }
          if (event.properties && event.properties[prop] !== undefined && event.properties[prop] !== null) {
            sessionIdRaw = event.properties[prop];
            break;
          }
          if (event.payload && event.payload[prop] !== undefined && event.payload[prop] !== null) {
            sessionIdRaw = event.payload[prop];
            break;
          }
        }
      }
      
      // Additional fallback: check if session info is nested in other common locations
      if (!sessionIdRaw) {
        // Check for session in common nested locations
        const possiblePaths = [
          'context.session',
          'context.sessionId', 
          'context.session_id',
          'data.session',
          'data.sessionId',
          'data.session_id',
          'state.session',
          'state.sessionId',
          'state.session_id'
        ];
        
        for (const path of possiblePaths) {
          const parts = path.split('.');
          let value = event;
          let found = true;
          
          for (const part of parts) {
            if (value === null || value === undefined || !(part in value)) {
              found = false;
              break;
            }
            value = value[part];
          }
          
          if (found && value !== null && value !== undefined) {
            sessionIdRaw = value;
            break;
          }
        }
      }
      
      const sessionId = sessionIdRaw !== null && sessionIdRaw !== undefined 
        ? String(sessionIdRaw) 
        : null;

      if (!sessionId) {
        console.log("  [TelegramPlugin] No session_id found after enhanced search, skipping");
        console.log("  Event type:", event.type);
        console.log("  Available keys:", Object.keys(event));
        if (event.properties) console.log("  Properties keys:", Object.keys(event.properties));
        if (event.payload) console.log("  Payload keys:", Object.keys(event.payload));
        return
      }
      
      console.log("  Using session ID:", sessionId);
      
      const projectDirFromPayload = event.payload?.directory
      const projectDir = projectDirFromPayload !== null && projectDirFromPayload !== undefined 
        ? String(projectDirFromPayload) 
        : directory
      const projectName = getProjectNameFromDirectory(projectDir, config)

       for (const [dir, ctx] of projectContext.entries()) {
         if (ctx.lastSessionId === sessionId && ctx.telegramChatIds.length > 0) {
           const projectName = getProjectNameFromDirectory(dir, config)
           for (const chatId of ctx.telegramChatIds) {
             await telegramClient.sendMessage({
               chat_id: chatId,
               text: `[${projectName}] 📝 User: ${input.message?.content || "[message content]"}`, // Fixed: use input instead of output
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
       // Send startup message to confirm plugin is loaded
       try {
         if (defaultChatIds.length > 0) {
           await telegramClient.sendMessage({
             chat_id: defaultChatIds[0], 
             text: "🔧 Telegram Plugin Loaded\n\nPlugin is now active and ready to receive events from OpenCode.",
             parse_mode: "MarkdownV2",
           })
         }
       } catch (e) {
         console.error("Failed to send startup message:", e)
       }
       
       console.log("\n===== [TelegramPlugin] Initialized =====")
       console.log("  Directory:", directory)
       console.log("  Bot token set:", !!(config.telegram_bot_token))
       console.log("  Projects:", config.projects?.length || 0)
       console.log("  DEFAULT CHAT IDS:", defaultChatIds)
       console.log("  Chat IDs count:", defaultChatIds.length)
       console.log("  TELEGRAM_CHAT_ID env:", process.env.TELEGRAM_CHAT_ID || "NOT SET")
       console.log("================================\n")
     },
  }
}

export default TelegramPlugin
