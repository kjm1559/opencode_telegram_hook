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
    return { event: async () => {}, config: async () => {} }
  }

  const projectName = directory.split("/").pop() || "unknown"
  let report: WorkReport = { tools: [], files: [] }
  let pendingCompletion = false
  let sending = false

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

  function setIdle() {
    pendingCompletion = true
    trySendCompletion()
  }

  function trySendCompletion() {
    if (sending || !pendingCompletion || report.files.length === 0) return
    sending = true
    const msg = buildCompletionMessage(report, projectName)
    report = { tools: [], files: [] }
    pendingCompletion = false
    send(msg).finally(() => { sending = false })
  }

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.status": {
          const type = event.properties?.status?.type
          if (type === "idle") setIdle()
          else if (type === "busy") { pendingCompletion = false; report = { tools: [], files: [] } }
          break
        }
        case "session.idle":
          setIdle()
          break
        case "permission.asked":
        case "question.asked":
          send(MSG_CHOICE_FALLBACK(projectName))
          break
        case "tool.execute.before": {
          const tool = event.properties?.tool
          const input = event.properties?.input
          if (tool) {
            const desc = input ? Object.values(input).filter(Boolean).slice(0, 2).join(", ") : ""
            report.tools.push({ tool, input: desc })
          }
          break
        }
        case "session.updated": {
          const diffs = event.properties?.info?.summary?.diffs
          if (diffs?.length) {
            report.files = diffs.map((d: any) => d.file)
            trySendCompletion()
          }
          break
        }
      }
    },

    config: async () => {
      send(MSG_CONNECTED(projectName))
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
