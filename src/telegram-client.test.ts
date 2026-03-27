import { describe, expect, test, beforeEach } from "bun:test"
import { TelegramClient, sendTelegramMessage, parseTelegramMessage } from "./telegram-client"

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

describe("TelegramClient 409 Conflict Handling", () => {
  let client: TelegramClient
  let originalFetch: typeof fetch
  
  beforeEach(() => {
    client = new TelegramClient("test-bot-token")
    originalFetch = globalThis.fetch
  })
  
  test("getUpdates returns empty array on 409 conflict and resets lastUpdateId", async () => {
    // Mock fetch to return 409
    globalThis.fetch = (() => 
      Promise.resolve(new Response(JSON.stringify({}), { status: 409 }))
    ) as any
    
    const result = await client.getUpdates()
    
    expect(result).toEqual([])
    expect(client.getLastUpdateId()).toBe(0)
    
    globalThis.fetch = originalFetch
  })
  
  test("getUpdates does NOT throw on 409 (prevents infinite loop)", async () => {
    // Mock fetch to return 409
    globalThis.fetch = (() => 
      Promise.resolve(new Response(JSON.stringify({}), { status: 409 }))
    ) as any
    
    // Should not throw
    await expect(client.getUpdates()).resolves.toEqual([])
    
    globalThis.fetch = originalFetch
  })
  
  test("getUpdates tracks consecutive 409 attempts", async () => {
    let callCount = 0
    
    // Mock fetch to return 409 multiple times
    globalThis.fetch = (() => {
      callCount++
      return Promise.resolve(new Response(JSON.stringify({}), { status: 409 }))
    }) as any
    
    // Call multiple times
    await client.getUpdates()
    await client.getUpdates()
    await client.getUpdates()
    
    expect(callCount).toBe(3)
    expect(client.getLastUpdateId()).toBe(0)
    
    globalThis.fetch = originalFetch
  })
  
  test("getUpdates returns empty array on other HTTP errors", async () => {
    globalThis.fetch = (() => 
      Promise.resolve(new Response(JSON.stringify({}), { status: 500 }))
    ) as any
    
    const result = await client.getUpdates()
    
    expect(result).toEqual([])
    
    globalThis.fetch = originalFetch
  })
  
  test("getUpdates handles successful response", async () => {
    const mockUpdates = [
      { update_id: 100, message: { chat: { id: "123", type: "private" }, text: "hello" } },
      { update_id: 101, message: { chat: { id: "123", type: "private" }, text: "world" } },
    ]
    
    globalThis.fetch = (() => 
      Promise.resolve(new Response(JSON.stringify({ result: mockUpdates }), { status: 200 }))
    ) as any
    
    const result = await client.getUpdates()
    
    expect(result).toEqual(mockUpdates)
    expect(client.getLastUpdateId()).toBe(101) // Should update to max update_id
    
    globalThis.fetch = originalFetch
  })
  
  test("getUpdates handles empty successful response", async () => {
    globalThis.fetch = (() => 
      Promise.resolve(new Response(JSON.stringify({ result: [] }), { status: 200 }))
    ) as any
    
    const result = await client.getUpdates()
    
    expect(result).toEqual([])
    expect(client.getLastUpdateId()).toBe(0) // Should not change
    
    globalThis.fetch = originalFetch
  })
  
  test("getUpdates requires bot token", async () => {
    const noTokenClient = new TelegramClient("")
    
    const result = await noTokenClient.getUpdates()
    
    expect(result).toEqual([])
  })
})

describe("TelegramClient MarkdownV2 Escaping", () => {
  test("escapeMarkdownV2 escapes dot character", () => {
    const client = new TelegramClient("test-token")
    const result = client.escapeMarkdownV2("test.ts")
    
    // Dot should be escaped with backslash
    expect(result).toContain("\\.")
  })
  
  test("escapeMarkdownV2 escapes all special characters", () => {
    const client = new TelegramClient("test-token")
    const input = "test_file.ts *bold* _italic_ [link](url)"
    const result = client.escapeMarkdownV2(input)
    
    // All special chars should be escaped
    expect(result).toContain("\\_")  // underscore
    expect(result).toContain("\\*")  // asterisk
    expect(result).toContain("\\[")  // bracket
    expect(result).toContain("\\]")  // bracket
    expect(result).toContain("\\(")  // paren
    expect(result).toContain("\\)")  // paren
    expect(result).toContain("\\.")  // dot
  })
  
  test("escapeMarkdownV2 handles file paths correctly", () => {
    const client = new TelegramClient("test-token")
    const input = "/home/mj/project/src/test.ts"
    const result = client.escapeMarkdownV2(input)
    
    // Dots should be escaped
    expect(result).toContain("\\.")
    // Forward slashes don't need escaping in MarkdownV2
  })
  
  test("escapeMarkdownV2 handles JSON strings", () => {
    const client = new TelegramClient("test-token")
    const input = JSON.stringify({ file: "test.ts", count: 1 })
    const result = client.escapeMarkdownV2(input)
    
    // Dots in JSON should be escaped
    expect(result).toContain("\\.")
  })
  
  test("escapeMarkdownV2 escapes backslashes correctly", () => {
    const client = new TelegramClient("test-token")
    const input = "test\\file"
    const result = client.escapeMarkdownV2(input)
    
    // Backslashes should be escaped
    expect(result).toContain("\\\\")
  })
})
