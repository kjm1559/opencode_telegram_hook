import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { getSummaryFromEvent, type WorkSummary } from "./summary-accessor"
import { formatCompletionMessage, formatChoiceMessage } from "./message-formatter"

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

  let sending = false

  function setIdle() {
    pendingCompletion = true
  }

  function extractSummary(event: any) {
    const summary = getSummaryFromEvent(event)
    if (!summary) return
    workSummary = summary
    if (pendingCompletion) trySendCompletion()
  }

  function extractPartText(event: any) {
    const part = event.properties?.part
    const text = part?.text
    const role = event.properties?.info?.role
    console.log(`[DEBUG] message.part.updated: role=${role}, hasText=${!!text}, textPreview=${text ? text.substring(0, 50) : 'none'}`)
    if (!text || role !== "assistant") return
    if (!workSummary) workSummary = {}
    workSummary.body = text
    console.log(`[DEBUG] workSummary.body set from assistant, pendingCompletion=${pendingCompletion}`)
    if (pendingCompletion) trySendCompletion()
  }

  function trySendCompletion() {
    console.log(`[DEBUG] trySendCompletion: sending=${sending}, hasBody=${!!workSummary?.body}`)
    if (sending || !workSummary?.body) return
    sending = true
    const currentSummary = workSummary
    workSummary = null
    pendingCompletion = false
    console.log(`[DEBUG] Sending completion message`)
    send(formatCompletionMessage(currentSummary, projectName)).finally(() => { sending = false })
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
        case "message.part.updated":
          extractPartText(event)
          break
      }
    },

    config: async () => {
      send(MSG_CONNECTED(projectName))
    },
  }
}

export default TelegramPlugin
