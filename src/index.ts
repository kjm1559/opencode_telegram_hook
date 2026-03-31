import type { Plugin, PluginInput } from "@opencode-ai/plugin"
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
  let workSummary: { body?: string } | null = null
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
    console.log(`[DEBUG] setIdle: pendingCompletion=true`)
  }

  function extractSummary(event: any) {
    const info = event.properties?.info
    if (!info) return

    // message.updated: role === "user"일 때 summary.body 사용 (요약 에이전트 결과)
    if (event.type === "message.updated" && info.role === "user") {
      const body = info.summary?.body
      console.log(`[DEBUG] message.updated (user): hasBody=${!!body}, bodyPreview=${body ? body.substring(0, 50) : 'none'}`)
      if (body) {
        workSummary = { body }
        if (pendingCompletion) trySendCompletion()
      }
      return
    }

    // session.updated: 파일 변경 사항 사용
    if (event.type === "session.updated") {
      const s = info.summary
      if (s?.diffs?.length) {
        const body = `변경 파일 ${s.diffs.length}개:\n${s.diffs.map((d: any) => `- ${d.file}`).join("\n")}`
        console.log(`[DEBUG] session.updated: files=${s.files}, diffs=${s.diffs.length}`)
        workSummary = { body }
        if (pendingCompletion) trySendCompletion()
      }
    }
  }

  function trySendCompletion() {
    console.log(`[DEBUG] trySendCompletion: sending=${sending}, hasSummary=${!!workSummary}, hasBody=${!!workSummary?.body}`)
    if (sending || !workSummary?.body) return
    sending = true
    const currentSummary = workSummary
    workSummary = null
    pendingCompletion = false
    console.log(`[DEBUG] Sending completion message, bodyLen=${currentSummary.body?.length}`)
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
      }
    },

    config: async () => {
      send(MSG_CONNECTED(projectName))
    },
  }
}

export default TelegramPlugin
