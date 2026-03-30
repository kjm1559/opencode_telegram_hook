import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { TelegramClient } from "./telegram-client"
import { EventHandler } from "./event-handler"
import { loadConfig, getProjectNameFromDirectory, type Config } from "./config"
import { POLL_INTERVAL_MS } from "./utils"
import * as fs from "node:fs"
import * as path from "node:path"

// Module-level state - shared across all plugin instances
let sharedTelegramClient: TelegramClient | null = null
let pollingStarted = false
let isPollingOwner = false
const projectRegistry = new Map<string, {
  projectName: string
  directory: string
  client: any
  telegramClient: TelegramClient
  chatIds: string[]
}>()

// File-based lock for cross-process coordination
const LOCK_DIR = "/tmp/opencode_telegram_hook"
const LOCK_FILE = path.join(LOCK_DIR, "polling.lock")

// Route message to specific project
async function routeToSession(projectName: string, message: string, chatId: string) {
  const project = projectRegistry.get(projectName)
  if (!project) {
    await sharedTelegramClient?.sendMessage({
      chat_id: chatId,
      text: `❌ Project not found: ${projectName}`
    })
    return
  }
  
  try {
    const sessionsResult = await project.client.session.list({})
    const sessions = sessionsResult?.result || []
    const lastSession = sessions[0]
    
    if (!lastSession?.id) {
      await project.telegramClient.sendMessage({
        chat_id: chatId,
        text: `[${projectName}] ❌ No active session. Create one first.`
      })
      return
    }
    
    await project.client.session.prompt({
      path: { id: lastSession.id },
      body: { parts: [{ type: "text", text: message }] }
    })
    
    await project.telegramClient.sendMessage({
      chat_id: chatId,
      text: `[${projectName}] ✅ Message sent to session ${lastSession.id}`
    })
  } catch (error: any) {
    console.error(`[Route] Error for ${projectName}:`, error.message)
    await project.telegramClient.sendMessage({
      chat_id: chatId,
      text: `[${projectName}] ❌ Error: ${error.message}`
    })
  }
}

// Single polling handler - routes messages to projects
async function handlePolling() {
  if (!sharedTelegramClient) return
  
  try {
    const updates = await sharedTelegramClient.getUpdates()
    
    for (const update of updates) {
      if (!update.message?.text) continue
      
      const parsed = sharedTelegramClient.parseMessage(update.message.text)
      const chatId = update.message.chat.id.toString()
      
      console.log(`[Polling] Received:`, parsed)
      
      if (parsed.type === "project_message" && parsed.projectName && parsed.message) {
        await routeToSession(parsed.projectName, parsed.message, chatId)
      } else if (parsed.type === "message" && parsed.message) {
        const firstProject = projectRegistry.values().next().value
        if (firstProject) {
          await routeToSession(firstProject.projectName, parsed.message, chatId)
        }
      }
    }
  } catch (error: any) {
    if (!error.message?.includes("409")) {
      console.error("[Polling] Error:", error.message)
    }
  }
}

// MODULE-LEVEL INITIALIZATION - runs ONCE when module loads
function initializePlugin(botToken: string, shellInstance: any) {
  sharedTelegramClient = new TelegramClient(botToken, shellInstance)
  
  // Start single polling thread - runs forever
  setInterval(handlePolling, POLL_INTERVAL_MS).unref()
  
  console.log("[Telegram Plugin] Initialized (module-level)")
  console.log(`  Polling interval: ${POLL_INTERVAL_MS}ms`)
  console.log(`  Is polling owner: ${isPollingOwner}`)
}

// Try to acquire lock (file-based)
function tryAcquireLock(): boolean {
  try {
    if (!fs.existsSync(LOCK_DIR)) {
      fs.mkdirSync(LOCK_DIR, { recursive: true })
    }
    
    // Try to create lock file (fails if exists)
    fs.writeFileSync(LOCK_FILE, process.pid.toString(), { flag: 'wx' })
    return true
  } catch (error: any) {
    // Lock file already exists
    return false
  }
}

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory, $ } = input
  const config = loadConfig()
  const projectName = getProjectNameFromDirectory(directory, config)
  
  // Initialize plugin on first instance (race-condition safe)
  if (!pollingStarted) {
    pollingStarted = true
    
    // Try to acquire lock (only first process becomes owner)
    isPollingOwner = tryAcquireLock()
    
    if (isPollingOwner) {
      initializePlugin(config.telegram_bot_token, $)
    } else {
      console.log("[Telegram Plugin] Another instance is polling - skipping")
    }
  }
  
  const chatIds = Array.from(
    new Set([
      process.env.TELEGRAM_CHAT_ID || "",
      ...(config.allowed_chat_ids || []),
    ]),
  ).filter(Boolean)

  // Register this project for routing
  projectRegistry.set(projectName, {
    projectName,
    directory,
    client,
    telegramClient: sharedTelegramClient!,
    chatIds
  })

  const eventHandler = new EventHandler(sharedTelegramClient!.sendMessage.bind(sharedTelegramClient), config)

  return {
    event: async ({ event }) => {
      await eventHandler.handle(event, directory, projectName, chatIds, {
        telegramClient: sharedTelegramClient!.sendMessage.bind(sharedTelegramClient)
      })
    },

    config: async () => {
      console.log(`[TelegramPlugin] Initialized for ${projectName}`)
      console.log(`  Chat IDs: ${chatIds}`)
      console.log(`  Registered projects: ${Array.from(projectRegistry.keys()).join(', ')}`)
    }
  }
}

export default TelegramPlugin
