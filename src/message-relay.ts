import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"
import { type Telegram } from "./telegram-client"
import { type Config, getDirectoryFromProjectName } from "./config"

type TelegramSendFn = (params: Telegram.SendMessageParams) => Promise<boolean>

export class MessageRelay {
  private readonly client: OpencodeClient
  private readonly telegramClient: TelegramSendFn
  private readonly config: Config
  private readonly activeSessions = new Map<string, {
    sessionId: string
    projectName: string
    projectDir: string
  }>()

  constructor(options: {
    client: OpencodeClient
    telegramClient: TelegramSendFn
    config: Config
  }) {
    this.client = options.client
    this.telegramClient = options.telegramClient
    this.config = options.config
  }

  async relayMessageFromTelegram({
    chatId,
    message,
  }: {
    chatId: string
    message: string
  }): Promise<boolean> {
    if (message.startsWith("/")) {
      return await this.handleCommand(chatId, message)
    }

    const { projectName, content } = this.parseProjectTag(message)

    if (projectName) {
      return await this.forwardToProject(chatId, projectName, content)
    }

    return await this.forwardToLastActive(chatId, message)
  }

  private parseProjectTag(message: string): { projectName: string | null; content: string } {
    const match = message.match(/^\[([^\]]+)\]\s+(.*)$/s)

    if (match) {
      return { projectName: match[1], content: match[2] }
    }

    return { projectName: null, content: message }
  }

  async handleCommand(chatId: string, command: string): Promise<boolean> {
    const parts = command.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    if (cmd === "/start") {
      return await this.handleStartCommand(chatId, args[0])
    }

    if (cmd === "/help") {
      return await this.handleHelpCommand(chatId)
    }

    if (cmd === "/cancel") {
      return await this.handleCancelCommand(chatId, args[0])
    }

    if (cmd === "/status") {
      return await this.handleStatusCommand(chatId)
    }

    if (cmd === "/new") {
      return await this.handleNewSessionCommand(chatId, args.slice(0).join(" "))
    }

    if (cmd === "/projects") {
      return await this.handleProjectsListCommand(chatId)
    }

    return await this.telegramClient({
      chat_id: chatId,
      text: `❓ Unknown command: ${cmd}\n\nUse /help to see available commands.\n\n---\n`,
    })
  }

  async handleStartCommand(chatId: string, projectName?: string): Promise<boolean> {
    try {
      const sessions = await this.client.session.list()
      const activeSession = sessions.find((s) => s.active) ?? sessions[0]

      if (activeSession) {
        if (projectName) {
          const projectDir = getDirectoryFromProjectName(projectName, this.config) || activeSession.directory || ""
          this.activeSessions.set(projectName, {
            sessionId: activeSession.id,
            projectName,
            projectDir,
          })

          return await this.telegramClient({
            chat_id: chatId,
            text: `✅ Linked \`${projectName}\` to latest session\n\nSession ID: \`${activeSession.id.substring(0, 8)}...\`\n\nSend message like:\n\n\`\`\`[${projectName}] your task\`\`\``,
          })
        }

        if (activeSession.directory) {
          const generatedName = activeSession.directory.split(/[\\/]/).pop() || "default-project"
          this.activeSessions.set(generatedName, {
            sessionId: activeSession.id,
            projectName: generatedName,
            projectDir: activeSession.directory,
          })

          return await this.telegramClient({
            chat_id: chatId,
            text: `✅ Session initialized\n\nSession ID: \`${activeSession.id.substring(0, 8)}...\`\nProject: \`${generatedName}\`\n\nSend your task request.\n\n---\n`,
          })
        }
      }

      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active sessions found.\n\nStart a session in OpenCode first.\n\n---\n",
      })
    } catch (error) {
      console.error("[MessageRelay] Failed to list sessions:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: "❌ Failed to initialize session. Check connection.\n\n---\n",
      })
    }
  }

  async handleHelpCommand(chatId: string): Promise<boolean> {
    const helpText = [
      "📚 **Available Commands**:",
      "",
      "/start [project]  — Link to latest session (or specific project)",
      "/help            — Show this message",
      "/new [project]    — Create new session for project",
      "/status          — Show all active projects & sessions",
      "/projects        — List configured projects",
      "/cancel [proj]   — Stop work on project (defaults to last active)",
      "",
      "**Message Format**:",
      "\`\`\`[project-name] your task\`\`\`",
      "",
      "Example:",
      "\`\`\`[backend-api] add authentication endpoint\`\`\`",
      "",
      "---",
    ].join("\n")

    return await this.telegramClient({
      chat_id: chatId,
      text: helpText,
    })
  }

  async handleNewSessionCommand(chatId: string, projectName?: string): Promise<boolean> {
    if (!projectName) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ Usage: /new project-name\n\nExample: /new my-feature\n\n---\n",
      })
    }

    const projectDir = getDirectoryFromProjectName(projectName, this.config)

    if (!projectDir) {
      return await this.telegramClient({
        chat_id: chatId,
        text: `⚠️ Project \`${projectName}\` not found in configuration.\n\nConfigure projects in telegram-plugin-config.json\n\n---\n`,
      })
    }

    try {
      const newSession = await this.client.session.create({
        body: {
          mode: "create",
          directory: projectDir,
        },
      })

      if (!newSession.id) {
        return await this.telegramClient({
          chat_id: chatId,
          text: "❌ Failed to create session.\n\n---\n",
        })
      }

      this.activeSessions.set(projectName, {
        sessionId: newSession.id,
        projectName,
        projectDir,
      })

      return await this.telegramClient({
        chat_id: chatId,
        text: `✅ New session created for \`${projectName}\`\n\nSession ID: \`${newSession.id.substring(0, 8)}...\`\nDirectory: \`${projectDir.substring(0, 50)}...\`\n\nSend your task:\n\`\`\`[${projectName}] your request\`\`\`\n\n---\n`,
      })
    } catch (error) {
      console.error("[MessageRelay] Failed to create session:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: `❌ Failed to create session: ${error instanceof Error ? error.message : String(error)}\n\n---\n`,
      })
    }
  }

  async handleCancelCommand(chatId: string, projectName?: string): Promise<boolean> {
    const targetProject = projectName || this.getLastActiveProject()

    if (!targetProject) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active projects found.\n\nUse /start first.\n\n---\n",
      })
    }

    const sessionInfo = this.activeSessions.get(targetProject)

    if (!sessionInfo) {
      return await this.telegramClient({
        chat_id: chatId,
        text: `⚠️ Project \`${targetProject}\` not linked.\n\nUse /start or /new first.\n\n---\n`,
      })
    }

    try {
      await this.client.session.prompt({
        path: { id: sessionInfo.sessionId },
        body: {
          parts: [
            {
              type: "text",
              text: "CANCELED: User requested to stop work. Please halt current operations.",
            },
          ],
        },
      })

      return await this.telegramClient({
        chat_id: chatId,
        text: `🛑 Cancellation sent for \`${targetProject}\`.\n\nThe agent will stop shortly.\n\n---\n`,
      })
    } catch (error) {
      console.error("[MessageRelay] Failed to cancel:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: `❌ Failed to cancel \`${targetProject}\`.\n\n---\n`,
      })
    }
  }

  async handleStatusCommand(chatId: string): Promise<boolean> {
    if (this.activeSessions.size === 0) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active projects.\n\nUse /start to link a session.\n\n---\n",
      })
    }

    let statusText = [
      "📊 **Active Projects**:",
      "",
    ]

    for (const [projectName, info] of this.activeSessions.entries()) {
      try {
        const session = await this.client.session.get({
          path: { id: info.sessionId },
        })

        const statusLabel = session.active ? "● Active" : "○ Idle"
        statusText.push(
          `• \`${projectName}\` (\`${info.sessionId.substring(0, 8)}...\`) — ${statusLabel}`,
        )
      } catch {
        statusText.push(
          `• \`${projectName}\` (\`${info.sessionId.substring(0, 8)}...\`) — ⚠️ Status unknown`,
        )
      }
    }

    statusText.push("")
    statusText.push(`**Total**: ${this.activeSessions.size} projects`)
    statusText.push("\n---\n")

    return await this.telegramClient({
      chat_id: chatId,
      text: statusText.join("\n"),
    })
  }

  async handleProjectsListCommand(chatId: string): Promise<boolean> {
    if (!this.config.projects || this.config.projects.length === 0) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No projects configured.\n\nAdd projects to telegram-plugin-config.json\n\n---\n",
      })
    }

    const projectList = this.config.projects.map((p, idx) => `\`${idx + 1}. ${p.display_name}\` — ${p.directory}`)

    const text = [
      "📁 **Configured Projects**:",
      "",
      ...projectList,
      "",
      `
Use \`/new project-name\` to create new session.
Use \`[project-name] message\` to send messages.
\n---\n`,
    ].join("\n")

    return await this.telegramClient({
      chat_id: chatId,
      text,
    })
  }

  async forwardToProject(chatId: string, projectName: string, message: string): Promise<boolean> {
    let sessionInfo = this.activeSessions.get(projectName)

    if (!sessionInfo) {
      const projectDir = getDirectoryFromProjectName(projectName, this.config)
      const sessions = await this.client.session.list()
      const activeSession = sessions.find((s) => s.directory === projectDir)

      if (!activeSession) {
        return await this.telegramClient({
          chat_id: chatId,
          text: `⚠️ No active session for \`${projectName}\`.\n\nUse \`/new ${projectName}\` to create one.\n\n---\n`,
        })
      }

      sessionInfo = {
        sessionId: activeSession.id,
        projectName,
        projectDir: projectDir || activeSession.directory || "",
      }
      this.activeSessions.set(projectName, sessionInfo)
    }

    try {
      await this.client.session.prompt({
        path: { id: sessionInfo.sessionId },
        body: {
          parts: [{ type: "text", text: message }],
        },
      })

      return await this.telegramClient({
        chat_id: chatId,
        text: `📨 Sent to \`${projectName}\`\n\nWaiting for agent response...\n\n---\n`,
      })
    } catch (error) {
      console.error("[MessageRelay] Failed to forward message:", error)
      return await this.telegramClient({
        chat_id: chatId,
        text: `❌ Failed to send to \`${projectName}\`: ${error instanceof Error ? error.message : String(error)}\n\n---\n`,
      })
    }
  }

  async forwardToLastActive(chatId: string, message: string): Promise<boolean> {
    const lastActive = this.getLastActiveProject()

    if (!lastActive) {
      return await this.telegramClient({
        chat_id: chatId,
        text: "⚠️ No active projects.\n\nUse \`/start\` to link a session or specify project in message:\n\n\`\`\`[project-name] your message\`\`\`\n\n---\n",
      })
    }

    return await this.forwardToProject(chatId, lastActive, message)
  }

  getLastActiveProject(): string | null {
    if (this.activeSessions.size === 0) return null

    let lastProject = null
    let lastTime = 0

    for (const [name, info] of this.activeSessions.entries()) {
      if (Date.now() - lastTime < 300000) {
        lastProject = name
        lastTime = Date.now()
      }
    }

    for (const [key] of this.activeSessions) {
      return key
    }

    return lastProject
  }

  getActiveSessions(): Map<string, {
    sessionId: string
    projectName: string
    projectDir: string
  }> {
    return this.activeSessions
  }

  setActiveSession(
    projectName: string,
    sessionInfo: {
      sessionId: string
      projectDir: string
    },
  ) {
    this.activeSessions.set(projectName, {
      sessionId: sessionInfo.sessionId,
      projectName,
      projectDir: sessionInfo.projectDir,
    })
  }
}
