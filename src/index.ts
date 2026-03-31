import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { getSummaryFromEvent, type WorkSummary } from "./summary-accessor"
import { formatCompletionMessage, formatChoiceMessage } from "./message-formatter"

const MSG_COMPLETION_FALLBACK = (name: string) =>
  `<b>[${name}] 작업 완료</b>\n\n✅ 작업이 완료되었습니다.`

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
  let workSummary: WorkSummary | null = null
  let pendingCompletion = false

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

  async function sendCompletion() {
    await send(workSummary ? formatCompletionMessage(workSummary, projectName) : MSG_COMPLETION_FALLBACK(projectName))
    workSummary = null
    pendingCompletion = false
  }

  function setIdle() {
    pendingCompletion = true
    if (workSummary) sendCompletion()
  }

  function extractSummary(event: any) {
    const summary = getSummaryFromEvent(event)
    if (!summary) return
    if (!summary.body && summary.diffs?.length) {
      summary.body = `변경 파일 ${summary.diffs.length}개:\n${summary.diffs.map((d: any) => `- ${d.file}`).join("\n")}`
    }
    workSummary = summary
    if (pendingCompletion) sendCompletion()
  }

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.status": {
          const type = event.properties?.status?.type
          if (type === "idle") setIdle()
          else if (type === "busy") { pendingCompletion = false; workSummary = null }
          break
        }
        case "session.idle":
          setIdle()
          break
        case "permission.asked":
        case "question.asked":
          send(workSummary ? formatChoiceMessage(workSummary, projectName) : MSG_CHOICE_FALLBACK(projectName))
          break
        case "session.updated":
        case "message.updated":
          extractSummary(event)
          break
      }
    },

    config: async () => {
      send(MSG_CONNECTED(projectName))
    },
  }
}

export default TelegramPlugin
