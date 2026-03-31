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
  let isIdle = false

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
      // 세션 상태 이벤트 처리
      if (event.type === "session.status") {
        const status = event.properties?.status
        
        if (status?.type === "idle") {
          isIdle = true
          // 요약이 이미 있으면 즉시 전송
          if (workSummary) {
            await sendCompletionMessage()
          }
        } else if (status?.type === "busy") {
          isIdle = false
          workSummary = null
        }
        return
      }
      
      // session.idle 이벤트 처리 (fallback)
      if (event.type === "session.idle") {
        isIdle = true
        if (workSummary) {
          await sendCompletionMessage()
        }
        return
      }
      
      // 선택 필요 이벤트 처리
      if (event.type === "permission.asked" || event.type === "question.asked") {
        try {
          const message = workSummary
            ? formatChoiceMessage(workSummary, projectName)
            : `<b>[${projectName}] 선택 필요</b>

⚠️ 작업을 계속하기 위해 선택이 필요합니다.`
          await sendMessage(message)
        } catch (error) {
          console.error(`[Telegram] Error:`, error)
        }
        return
      }
      
      // 요약 데이터 수집 (message.updated / session.updated)
      if (event.type === "session.updated" || event.type === "message.updated") {
        try {
          const summary = getSummaryFromEvent(event)
          
          if (summary) {
            // body 가 없으면 diffs 로 요약 생성
            if (!summary.body && summary.diffs && summary.diffs.length > 0) {
              summary.body = `변경 파일 ${summary.diffs.length}개:\n${summary.diffs.map(d => `- ${d.file}`).join('\n')}`
            }
            
            workSummary = summary
            
            // idle 상태이고 요약이 있으면 즉시 전송
            if (isIdle && workSummary) {
              await sendCompletionMessage()
            }
          }
        } catch (error) {
          console.error(`[Telegram] Error:`, error)
        }
      }
    },

    config: async () => {
      console.log(`[Telegram Plugin] Initialized for ${projectName}`)
      console.log(`  Chat ID: ${chatId}`)
      
      await sendMessage(`<b>[${projectName}] 플러그인 시작</b>

테스트 메시지입니다.`)
    }
  }

  async function sendCompletionMessage() {
    try {
      const message = workSummary
        ? formatCompletionMessage(workSummary, projectName)
        : `<b>[${projectName}] 작업 완료</b>

✅ 작업이 완료되었습니다.`
      await sendMessage(message)
      workSummary = null
      isIdle = false
    } catch (error) {
      console.error(`[Telegram] Error:`, error)
    }
  }
}

export default TelegramPlugin
