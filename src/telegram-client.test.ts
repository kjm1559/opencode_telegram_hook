import { describe, expect, test } from "bun:test"
import { sendTelegramMessage, parseTelegramMessage } from "./telegram-client"

describe("Telegram client", () => {
  test("parseTelegramMessage handles /start command", () => {
    const result = parseTelegramMessage("/start")
    expect(result.type).toBe("start")
  })

  test("parseTelegramMessage handles /help command", () => {
    const result = parseTelegramMessage("/help")
    expect(result.type).toBe("help")
    expect(result.message).toContain("Commands:")
  })

  test("parseTelegramMessage handles /cancel command", () => {
    const result = parseTelegramMessage("/cancel")
    expect(result.type).toBe("cancel")
  })

  test("parseTelegramMessage handles /status command", () => {
    const result = parseTelegramMessage("/status")
    expect(result.type).toBe("status")
  })

  test("parseTelegramMessage handles regular text messages", () => {
    const originalText = "Add a new feature for JWT authentication"
    const result = parseTelegramMessage(originalText)
    expect(result.type).toBe("message")
    expect(result.message).toBe(originalText)
  })

  test("parseTelegramMessage is case-insensitive for /start", () => {
    const result = parseTelegramMessage("/START")
    expect(result.type).toBe("start")
  })

  test("parseTelegramMessage is case-insensitive for /HELP", () => {
    const result = parseTelegramMessage("/HELP")
    expect(result.type).toBe("help")
  })

  test("parseTelegramMessage handles mixed case commands", () => {
    const result = parseTelegramMessage("/StArT")
    expect(result.type).toBe("start")
  })

  test("sendTelegramMessage requires TELEGRAM_BOT_TOKEN", async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_BOT_TOKEN
    
    const result = await sendTelegramMessage({
      chat_id: "123456789",
      text: "test",
    })
    
    expect(result).toBe(false)
    
    if (originalToken) {
      process.env.TELEGRAM_BOT_TOKEN = originalToken
    }
  })
})
