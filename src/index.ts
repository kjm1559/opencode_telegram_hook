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
      
      // 작업 시작 시 요약 저장
      if (event.type === "session.started") {
        currentSummary = `프로젝트: ${projectName}\n작업 시작\n\n` +
          (event.title ? `제목: ${event.title}\n` : "") +
          (event.payload?.directory ? `디렉토리: ${event.payload.directory}\n` : "")
        console.log(`[Telegram Event] Session started, summary: ${currentSummary}`)
      }
      
      // 작업 진행 시 요약 업데이트
      if (event.type === "message.created" || event.type === "tool.execute.before") {
        if (event.title) {
          currentSummary += `\n• ${event.title}\n`
          console.log(`[Telegram Event] Updated summary with: ${event.title}`)
        }
      }
      
      // 작업 완료 시
      if (event.type === "session.completed" || event.type === "session.finished") {
        const summaryContent = currentSummary.trim() || `프로젝트: ${projectName}\n작업 완료`;
        const summary = `
<b>[${projectName}] 작업 완료</b>

${summaryContent}

✅ 작업이 완료되었습니다.
        `.trim()
        
        console.log(`[Telegram Event] Sending completion message`)
        await sendMessage(summary)
        currentSummary = ""
      }
      
      // 선택 필요 시
      if (event.type === "permission.ask" || event.type === "command.execute.before") {
        const summaryContent = currentSummary.trim() || `프로젝트: ${projectName}\n작업 중`;
        const question = `
<b>[${projectName}] 선택 필요</b>

${summaryContent}

⚠️ 작업 진행을 위해 선택이 필요합니다.
        `.trim()
        
        console.log(`[Telegram Event] Sending choice message`)
        await sendMessage(question)
      }
    },

    config: async () => {
      console.log(`[Telegram Plugin] Initialized for ${projectName}`)
      console.log(`  Chat ID: ${chatId}`)
    }
  }
}

export default TelegramPlugin
