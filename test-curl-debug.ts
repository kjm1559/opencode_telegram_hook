// test-curl-debug.ts
// Run with: bun test-curl-debug.ts

import { $ } from 'bun:shell'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set')
  process.exit(1)
}

console.log('=== Telegram API Curl Debug Test ===')
console.log('Bot Token:', BOT_TOKEN.substring(0, 10) + '...')
console.log('Chat ID:', CHAT_ID)

// Test 1: GET with correct method
async function testGetUpdates() {
  console.log('\n--- Test 1: GET /getUpdates ---')
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=0&timeout=5`
  
  try {
    const raw = await $`curl -s ${url}`
    const text = await raw.text()
    console.log('Raw output:', text.substring(0, 200))
    
    const json = JSON.parse(text)
    console.log('Parsed JSON:', JSON.stringify(json, null, 2))
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error('Exit code:', error.exitCode)
  }
}

// Test 2: POST (wrong method - current implementation)
async function testPostUpdates() {
  console.log('\n--- Test 2: POST /getUpdates (wrong) ---')
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=0&timeout=5`
  
  try {
    const raw = await $`curl -s -X POST ${url}`
    const text = await raw.text()
    console.log('Raw output:', text.substring(0, 200))
    
    const json = JSON.parse(text)
    console.log('Parsed JSON:', JSON.stringify(json, null, 2))
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error('Exit code:', error.exitCode)
  }
}

// Test 3: With .json() method
async function testJsonMethod() {
  console.log('\n--- Test 3: Using .json() method ---')
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=0&timeout=5`
  
  try {
    const result = await $`curl -s ${url}`.json()
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error('Exit code:', error.exitCode)
  }
}

// Test 4: With .nothrow().json()
async function testNothrowJson() {
  console.log('\n--- Test 4: Using .nothrow().json() ---')
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=0&timeout=5`
  
  try {
    const result = await $`curl -s ${url}`.nothrow().json()
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error('Exit code:', error.exitCode)
  }
}

// Run tests
async function main() {
  await testGetUpdates()
  await testPostUpdates()
  await testJsonMethod()
  await testNothrowJson()
  
  console.log('\n=== Tests completed ===')
}

main().catch(console.error)
