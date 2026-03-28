// Verify Telegram Bot Token
async function verifyBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN not set")
    return
  }
  
  console.log(`🔍 Checking bot token: ${token.substring(0, 15)}***`)
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await response.json()
    
    if (response.ok) {
      console.log("✅ Bot token is valid!")
      console.log(`   Bot username: @${data.result.username}`)
      console.log(`   Bot name: ${data.result.first_name}`)
    } else {
      console.error(`❌ Bot token is invalid: ${data.error_code} ${data.description}`)
      console.log("\n💡 To fix:")
      console.log("   1. Create a new bot with @BotFather")
      console.log("   2. Get the new token")
      console.log("   3. Set TELEGRAM_BOT_TOKEN environment variable")
      console.log("   4. Start the bot with /start command in Telegram")
    }
  } catch (error) {
    console.error("❌ Failed to verify bot:", error)
  }
}

verifyBot()
