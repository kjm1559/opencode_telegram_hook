import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { getSummaryFromEvent, type WorkSummary } from "./summary-accessor"
import { formatCompletionMessage, formatChoiceMessage } from "./message-formatter"

export const TelegramPlugin: Plugin = async (input: PluginInput) => {
  const { client, directory } = input
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ""
  const chatId = process.env.TELEGRAM_CHAT_ID || ""
  
  if (!botToken || !chatId) {
    console.log("[Telegram Plugin] Not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)")
    return {
      event: async () => {},
      config: async () => {}
    }
  }

  const projectName = directory.split("/").pop() || "unknown"

  let workSummary: WorkSummary | null = null

  async function sendMessage(text: string) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML"
          })
        }
      )
      
      const result = await response.json()
      return result.ok
    } catch (error) {
      console.error("[Telegram] Error:", error)
      return false
    }
  }

  return {
    event: async ({ event }) => {
      console.log(`[Telegram Event] type: ${event.type}`)
      
      // session.status 이벤트로 작업 완료 감지 (status.type === "idle")
      if (event.type === "session.status") {
        const status = event.properties?.status
        
        if (status?.type === "idle") {
          // 작업 완료 - 메시지 전송
          try {
            const message = workSummary
              ? formatCompletionMessage(workSummary, projectName)
              : `<b>[${projectName}] 작업 완료</b>

✅ 작업이 완료되었습니다.`
            await sendMessage(message)
            console.log(`[Telegram Event] Session completed (idle), sent completion message`)
          } catch (error) {
            console.error(`[Telegram Event] Error sending completion message:`, error)
          }
          workSummary = null
        } else if (status?.type === "busy") {
          // 작업 시작 - 요약 초기화
          workSummary = null
        }
        return
      }
      
      if (event.type === "permission.asked" || event.type === "question.asked") {
        try {
          const message = workSummary
            ? formatChoiceMessage(workSummary, projectName)
            : `<b>[${projectName}] 선택 필요</b>

⚠️ 작업을 계속하기 위해 선택이 필요합니다.`
          await sendMessage(message)
          console.log(`[Telegram Event] Choice required, sent message`)
        } catch (error) {
          console.error(`[Telegram Event] Error sending choice message:`, error)
        }
        return
      }
      
      if (event.type === "session.updated" || event.type === "message.updated") {
        try {
          const summary = getSummaryFromEvent(event)
          if (summary && summary.body) {
            workSummary = summary
            console.log(`[Telegram Event] Extracted summary body: ${summary.body.substring(0, 50)}...`)
          }
        } catch (error) {
          console.error(`[Telegram Event] Error extracting summary:`, error)
        }
      }
    },

    config: async () => {
      console.log(`[Telegram Plugin] Initialized for ${projectName}`)
      console.log(`  Chat ID: ${chatId}`)
      
      // 시작 시 테스트 메시지 전송
      await sendMessage(`
<b>[${projectName}] 플러그인 시작</b>

테스트 메시지입니다.
      `.trim())
    }
  }
}

export default TelegramPlugin
