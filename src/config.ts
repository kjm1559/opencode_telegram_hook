import z from "zod"

export const ConfigSchema = z.object({
  telegram_bot_token: z.string().min(10),
  allowed_chat_ids: z.array(z.string()).optional(),
  max_events_per_summary: z.number().positive().default(100),
})

export type Config = z.infer<typeof ConfigSchema>

export function loadConfig(): Config {
  const config = ConfigSchema.safeParse({
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN,
    allowed_chat_ids: process.env.ALLOWED_CHAT_IDS?.split(",").map((s) => s.trim()) || [],
    max_events_per_summary: process.env.MAX_EVENTS_PER_SUMMARY ? Number(process.env.MAX_EVENTS_PER_SUMMARY) : 100,
  })

  if (!config.success) {
    console.error("Config validation failed:", config.error.errors)
    throw new Error("Invalid config")
  }

  return config.data
}
