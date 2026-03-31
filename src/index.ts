import type { Plugin, PluginInput } from "@opencode-ai/plugin"

type ToolUsage = {
  tool: string
  input: string
}

type WorkReport = {
  tools: ToolUsage[]
  files: string[]
}

const MSG_CHOICE_FALLBACK = (name: string) =>
  `<b>[${name}] 선택 필요</b>\n\n⚠️ 작업을 계속하기 위해 선택이 필요합니다.`

const MSG_CONNECTED = (name: string) =>
  `<b>[${name}] Telegram 플러그인 연결됨</b>\n\n작업 완료 및 선택 알림을 Telegram 으로 전송합니다.`

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
  const IDLE_DEBOUNCE_MS = 8000

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
    if (report.tools.length === 0 && report.files.length === 0) return
    sending = true
    const snapshot = { tools: [...report.tools], files: [...report.files] }
    report = { tools: [], files: [] }
    const msg = buildCompletionMessage(snapshot, projectName)
    console.log(`[Telegram] sending: ${msg.substring(0, 100)}...`)
    send(msg).then(ok => console.log(`[Telegram] sent: ${ok}`)).catch(e => console.error(`[Telegram] error:`, e)).finally(() => { sending = false })
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
          if (type === "busy") {
            cancelScheduledSend()
          } else if (type === "idle") {
            scheduleSendCompletion()
          }
          break
        }
        case "session.idle":
          console.log(`[Telegram] session.idle`)
          scheduleSendCompletion()
          break
        case "session.diff": {
          const diff = event.properties?.diff
          console.log(`[Telegram] session.diff: files=${diff?.length || 0}`)
          if (diff?.length) {
            for (const d of diff) {
              const file = d.file
              if (!report.files.includes(file)) report.files.push(file)
            }
            console.log(`[Telegram] files: ${report.files.join(", ")}`)
          }
          break
        }
        case "permission.asked":
        case "question.asked":
          console.log(`[Telegram] ${event.type}`)
          send(MSG_CHOICE_FALLBACK(projectName))
          break
      }
    },

    "tool.execute.before": async (input, _output) => {
      if (input.sessionID?.startsWith("ses_")) resetForSession(input.sessionID)
      if (input.tool) {
        report.tools.push({ tool: input.tool, input: "" })
        console.log(`[Telegram] tool.execute.before: ${input.tool} (${report.tools.length} total)`)
      }
    },

    config: async () => {
      console.log(`[Telegram] config called`)
      send(MSG_CONNECTED(projectName)).then(ok => console.log(`[Telegram] connected: ${ok}`))
    },
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildCompletionMessage(r: WorkReport, name: string): string {
  const escapedName = escapeHtml(name)

  let toolSection = ""
  if (r.tools.length > 0) {
    const tools = r.tools
      .map((t, i) => `  ${i + 1}. <code>${escapeHtml(t.tool)}</code>${t.input ? ` — ${escapeHtml(t.input)}` : ""}`)
      .join("\n")
    toolSection = `🔧 사용된 도구 (${r.tools.length}개):\n${tools}\n\n`
  }

  const files = r.files.map((f) => `• ${escapeHtml(f)}`).join("\n")
  const fileSection = `📝 변경 파일 (${r.files.length}개):\n${files}`

  return `<b>[${escapedName}] 작업 완료</b>\n\n${toolSection}${fileSection}\n\n✅ 작업이 완료되었습니다.`
}

export default TelegramPlugin
