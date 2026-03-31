import type { Plugin, PluginInput } from "@opencode-ai/plugin"

type ToolUsage = { tool: string; input: string }
type WorkReport = { tools: ToolUsage[]; files: string[] }

const MSG_CHOICE_FALLBACK = (name: string) =>
  `<b>[${name}] Choice Required</b>\n\n⚠️ A choice is required to continue working.`

const MSG_CONNECTED = (name: string) =>
  `<b>[${name}] Telegram Plugin Connected</b>\n\nSends session completion and choice alerts via Telegram.`

const IDLE_DEBOUNCE_MS = 8000

function truncate(s: string, limit: number): string {
  return s.length <= limit ? s : s.slice(0, limit) + "…"
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function summarizeToolInput(tool: string, args: any): string {
  if (!args) return ""

  switch (tool) {
    case "edit": {
      const file = args.filePath ?? args.file ?? ""
      if (!file) return ""
      const oldStr = args.oldString
      if (typeof oldStr === "string" && oldStr.length > 0) {
        return `${file} — "${truncate(oldStr.split("\n")[0], 40)}"`
      }
      return file
    }
    case "write":
      return args.filePath ?? args.file ?? ""
    case "read": {
      const file = args.filePath ?? args.file ?? ""
      if (!file) return ""
      const parts = [file]
      if (args.offset) parts.push(`L${args.offset}`)
      if (args.limit) parts.push(`+${args.limit}`)
      return parts.join(" ")
    }
    case "bash":
      return args.command ? truncate(args.command, 80) : ""
    case "glob":
    case "grep":
      return args.pattern ? args.pattern : ""
    case "task":
      return args.description ? truncate(args.description, 80) : ""
    default: {
      const hint = args.file ?? args.path ?? args.command ?? args.query ?? args.description
      if (typeof hint === "string") return truncate(hint, 80)
      const keys = Object.keys(args).slice(0, 3)
      return keys.length > 0 ? keys.join(", ") : ""
    }
  }
}

function buildCompletionMessage(r: WorkReport, name: string): string {
  const escapedName = escapeHtml(name)

  if (r.tools.length === 0 && r.files.length === 0) {
    return `<b>[${escapedName}] Session Complete</b>\n\n✅ Session complete.`
  }

  const toolSection = r.tools.length > 0
    ? `🔧 Tools Used (${r.tools.length}):\n${r.tools.map((t, i) => `  ${i + 1}. <code>${escapeHtml(t.tool)}</code>${t.input ? ` — ${escapeHtml(t.input)}` : ""}`).join("\n")}\n\n`
    : ""

  const fileSection = r.files.length > 0
    ? `📝 Changed Files (${r.files.length}):\n${r.files.map((f) => `• ${escapeHtml(f)}`).join("\n")}`
    : ""

  return `<b>[${escapedName}] Session Complete</b>\n\n${toolSection}${fileSection}\n✅ Session complete.`
}

export const TelegramPlugin: Plugin = async ({ directory }: PluginInput) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ""
  const chatId = process.env.TELEGRAM_CHAT_ID || ""

  if (!botToken || !chatId) {
    console.log(`[Telegram Plugin] Missing credentials: token=${!!botToken}, chatId=${!!chatId}`)
    return { event: async () => {}, config: async () => {} }
  }

  const projectName = directory.split("/").pop() || "unknown"
  console.log(`[Telegram Plugin] Initialized for ${projectName}`)

  let report: WorkReport = { tools: [], files: [] }
  let currentSessionID: string | null = null
  let sending = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  async function send(text: string) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      })
      return (await res.json()).ok
    } catch {
      return false
    }
  }

  function resetForSession(sessionID: string) {
    if (currentSessionID === sessionID) return
    currentSessionID = sessionID
    report = { tools: [], files: [] }
    console.log(`[Telegram] new session: ${sessionID}`)
  }

  function scheduleSendCompletion() {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleTimer = null
      trySendCompletion()
    }, IDLE_DEBOUNCE_MS)
  }

  function cancelScheduledSend() {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  function trySendCompletion() {
    console.log(`[Telegram] trySend: sending=${sending}, tools=${report.tools.length}, files=${report.files.length}`)
    if (sending) return

    sending = true
    const snapshot = { tools: [...report.tools], files: [...report.files] }
    report = { tools: [], files: [] }
    const msg = buildCompletionMessage(snapshot, projectName)
    console.log(`[Telegram] sending: ${msg.substring(0, 100)}...`)

    send(msg)
      .then(ok => console.log(`[Telegram] sent: ${ok}`))
      .catch(e => console.error(`[Telegram] error:`, e))
      .finally(() => { sending = false })
  }

  return {
    event: async ({ event }) => {
      const rawID = event.properties?.info?.id
        ?? event.properties?.sessionID
        ?? event.properties?.status?.sessionID
      if (rawID?.startsWith("ses_")) resetForSession(rawID)

      switch (event.type) {
        case "session.status": {
          const type = event.properties?.status?.type
          console.log(`[Telegram] session.status: ${type}`)
          if (type === "busy") cancelScheduledSend()
          else if (type === "idle") scheduleSendCompletion()
          break
        }
        case "session.idle":
          console.log(`[Telegram] session.idle`)
          scheduleSendCompletion()
          break
        case "permission.asked":
        case "question.asked":
          console.log(`[Telegram] ${event.type}`)
          send(MSG_CHOICE_FALLBACK(projectName))
          break
      }
    },

    "tool.execute.before": async (input, output) => {
      if (input.sessionID?.startsWith("ses_")) resetForSession(input.sessionID)
      if (input.tool) {
        report.tools.push({ tool: input.tool, input: summarizeToolInput(input.tool, output?.args) })
        console.log(`[Telegram] tool.execute.before: ${input.tool} (${report.tools.length} total)`)
      }
    },

    "tool.execute.after": async (input, output) => {
      const filediff = output?.metadata?.filediff
      if (filediff?.file && !report.files.includes(filediff.file)) {
        report.files.push(filediff.file)
        console.log(`[Telegram] tool.execute.after: ${input.tool} changed ${filediff.file}`)
      }
    },

    config: async () => {
      console.log(`[Telegram] config called`)
      send(MSG_CONNECTED(projectName)).then(ok => console.log(`[Telegram] connected: ${ok}`))
    },
  }
}

export default TelegramPlugin
