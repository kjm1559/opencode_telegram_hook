// Telegram integration test script
import { TelegramClient } from "./telegram-client"
import { parseTelegramMessage } from "./telegram-client"
import { loadConfig } from "./config"

const config = loadConfig()

console.log("🔧 Telegram Test Script")
console.log("========================")
console.log("Config:", {
  bot_token_set: !!config.telegram_bot_token,
  token_preview: config.telegram_bot_token ? `${config.telegram_bot_token.substring(0, 8)}...` : "NOT SET",
  projects_count: config.projects?.length || 0,
  allowed_chat_ids: config.allowed_chat_ids?.length || 0,
  max_events: config.max_events_per_summary,
})

const client = new TelegramClient(config.telegram_bot_token)

async function runTests() {
  console.log("\n1️⃣ Testing parseTelegramMessage...")
  
  const tests = [
    { input: "/start", expectType: "start" },
    { input: "/help", expectType: "help" },
    { input: "/status", expectType: "status" },
    { input: "/cancel", expectType: "cancel" },
    { input: "fix the bug", expectType: "message" },
  ]
  
  for (const t of tests) {
    const result = parseTelegramMessage(t.input)
    const pass = result.type === t.expectType
    console.log(`  ${pass ? '✅' : '❌'} "${t.input}" → ${result.type} (expected: ${t.expectType})`)
  }

  if (!config.telegram_bot_token) {
    console.log("\n⚠️  BOT_TOKEN not configured - skip API tests")
    console.log("\nSet token in:")
    console.log("  1. .env file: export TELEGRAM_BOT_TOKEN='your-token'")
    console.log("  2. or directly in config")
    return
  }

  console.log("\n2️⃣ Testing Telegram API (sendMessage)...")
  
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!chatId) {
    console.log("\n⚠️  TELEGRAM_CHAT_ID not set - skip message test")
    console.log("\nSet your Telegram chat ID:")
    console.log("  export TELEGRAM_CHAT_ID='your-chat-id'")
    return
  }

  const result = await client.sendMessage({
    chat_id: chatId,
    text: `🤖 *Telegram Plugin Test*\n\nPlugin is working!\nTime: ${new Date().toISOString()}`,
    parse_mode: "MarkdownV2",
  })
  console.log(`  ${result ? '✅' : '❌'} Message sent: ${result}`)

  console.log("\n3️⃣ Testing getUpdates...")
  const updates = await client.getUpdates()
  console.log(`  ${updates.length > 0 ? '✅' : 'ℹ️'} Updates: ${updates.length}`)

  console.log("\n✅ All tests complete!")
}

runTests().catch(console.error)
