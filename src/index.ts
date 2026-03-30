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
      
      // session.status 이벤트로 작업 완료 감지 (status.type === "idle")
      if (event.type === "session.status") {
        const status = event.properties?.status
        if (status?.type === "idle" && currentSummary) {
          // 작업 완료 - 메시지 전송
          console.log(`[Telegram Event] Session completed (idle), sending summary`)
          const completionMessage = `
<b>[${projectName}] 작업 완료</b>

${currentSummary}

✅ 작업이 완료되었습니다.
          `.trim()
          await sendMessage(completionMessage)
          currentSummary = ""
        } else if (status?.type === "busy" && !currentSummary) {
          // 작업 시작 - 요약 초기화
          const info = event.properties?.info
          if (info) {
            currentSummary = `프로젝트: ${projectName}\n작업 시작\n\n` +
              (info.title ? `제목: ${info.title}\n` : "") +
              (info.directory ? `디렉토리: ${info.directory}\n` : "")
            console.log(`[Telegram Event] Session started, summary: ${currentSummary}`)
          }
        }
        return
      }
      
      // session.updated 이벤트로 세션 정보 수집
      if (event.type === "session.updated") {
        const info = event.properties?.info
        if (!currentSummary && info) {
          currentSummary = `프로젝트: ${projectName}\n작업 시작\n\n` +
            (info.title ? `제목: ${info.title}\n` : "") +
            (info.directory ? `디렉토리: ${info.directory}\n` : "")
          console.log(`[Telegram Event] Session updated, summary: ${currentSummary}`)
        }
      }
      
      // 작업 진행 시 요약 업데이트
      if (event.type === "message.updated" || event.type === "message.part.updated") {
        const info = event.properties?.info
        if (info?.title) {
          currentSummary += `\n• ${info.title}\n`
          console.log(`[Telegram Event] Updated summary with: ${info.title}`)
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
