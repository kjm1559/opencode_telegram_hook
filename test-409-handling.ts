// test-409-handling.ts
// Test 409 conflict handling in TelegramClient

import { TelegramClient } from './src/telegram-client'

// Mock shell that returns 409 error
const mockShell409 = (command: TemplateStringsArray) => {
  const mockProcess = {
    nothrow: () => ({
      text: async () => JSON.stringify({
        ok: false,
        error_code: 409,
        description: "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running"
      })
    }),
    json: async () => ({
      ok: false,
      error_code: 409,
      description: "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running"
    })
  }
  return mockProcess
}

// Mock shell that returns success
const mockShellSuccess = (command: TemplateStringsArray) => {
  const mockProcess = {
    nothrow: () => ({
      text: async () => JSON.stringify({
        ok: true,
        result: [
          {
            update_id: 12345,
            message: {
              chat: { id: "7764331663", type: "private" },
              text: "test message"
            }
          }
        ]
      })
    }),
    json: async () => ({
      ok: true,
      result: [
        {
          update_id: 12345,
          message: {
            chat: { id: "7764331663", type: "private" },
            text: "test message"
          }
        }
      ]
    })
  }
  return mockProcess
}

async function test409Handling() {
  console.log("=== Test 1: 409 Conflict Handling ===")
  
  const client = new TelegramClient("test_token", mockShell409)
  
  // First call - should warn
  console.log("\nCall 1:")
  const result1 = await client.getUpdates()
  console.log("Result:", result1.length, "updates")
  
  // Second call - should not warn again
  console.log("\nCall 2:")
  const result2 = await client.getUpdates()
  console.log("Result:", result2.length, "updates")
  
  // Tenth call - should warn again
  console.log("\nCall 10:")
  for (let i = 0; i < 8; i++) {
    await client.getUpdates()
  }
  const result10 = await client.getUpdates()
  console.log("Result:", result10.length, "updates")
  
  console.log("\n✅ 409 handling test completed")
}

async function testSuccessHandling() {
  console.log("\n=== Test 2: Success Handling ===")
  
  const client = new TelegramClient("test_token", mockShellSuccess)
  
  const result = await client.getUpdates()
  console.log("Result:", result.length, "updates")
  console.log("Last update ID:", client.getLastUpdateId())
  
  if (result.length === 1 && result[0].update_id === 12345) {
    console.log("✅ Success handling test passed")
  } else {
    console.log("❌ Success handling test failed")
  }
}

async function main() {
  await test409Handling()
  await testSuccessHandling()
  
  console.log("\n=== All tests completed ===")
}

main().catch(console.error)
