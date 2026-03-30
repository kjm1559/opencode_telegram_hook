import type { Plugin, PluginInput } from "@opencode-ai/plugin"

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

  // 작업 상태 추적
  let currentSummary: string = ""

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
      
      // 작업 상태 추적
      if (event.type === "session.updated" || event.type === "session.status") {
        // 세션 업데이트 시 요약 저장
        if (!currentSummary) {
          currentSummary = `프로젝트: ${projectName}\n작업 시작\n\n` +
            (event.title ? `제목: ${event.title}\n` : "") +
            (event.payload?.directory ? `디렉토리: ${event.payload.directory}\n` : "")
        }
        console.log(`[Telegram Event] Session updated, summary: ${currentSummary}`)
      }
      
      // 작업 진행 시 요약 업데이트
      if (event.type === "message.updated" || event.type === "message.part.updated") {
        // 메시지 업데이트 시 작업 내용 추가
        if (event.title) {
          currentSummary += `\n• ${event.title}\n`
          console.log(`[Telegram Event] Updated summary with: ${event.title}`)
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
