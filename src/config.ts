import z from "zod"
import * as fs from "node:fs"
import * as path from "node:path"

export const ProjectConfigSchema = z.object({
  display_name: z.string(),
  directory: z.string().refine((p) => p.startsWith("/"), "Directory must be absolute path"),
  agent_name: z.string().optional().default("default"),
})

export const ConfigSchema = z.object({
  telegram_bot_token: z.string().min(10),
  allowed_chat_ids: z.array(z.string()).optional(),
  max_events_per_summary: z.number().positive().default(100),
  projects: z.array(ProjectConfigSchema).optional(),
})

export type Config = z.infer<typeof ConfigSchema>
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

export interface ProjectSessionState {
  sessionId: string
  lastActivity: number
  telegramChatId: string | null
  status: "active" | "idle" | "completed"
}

/**
 * Load plugin configuration from env vars and project mapping
 */
export function loadConfig(): Config {
  const config = ConfigSchema.safeParse({
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN,
    allowed_chat_ids: process.env.ALLOWED_CHAT_IDS?.split(",").map((s) => s.trim()) || [],
    max_events_per_summary: process.env.MAX_EVENTS_PER_SUMMARY ? Number(process.env.MAX_EVENTS_PER_SUMMARY) : 100,
    projects: parseProjectsConfig(),
  })

  if (!config.success) {
    console.error("Config validation failed:", config.error.errors)
    throw new Error("Invalid config")
  }

  return config.data
}

/**
 * Parse project configurations from env or config file
 */
function parseProjectsConfig(): ProjectConfig[] {
  // Priority 1: PROJECTS env var (JSON array)
  if (process.env.PROJECTS) {
    try {
      return JSON.parse(process.env.PROJECTS)
    } catch {
      console.warn("Warning: Failed to parse PROJECTS env var as JSON")
    }
  }

  // Priority 2: config.json file
  const configPath = path.join(process.cwd(), "telegram-plugin-config.json")
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      return z.array(ProjectConfigSchema).parse(data.projects || data)
    } catch (err) {
      console.warn("Warning: Failed to parse config file:", err)
    }
  }

  // Default: empty array (projects will be added dynamically)
  return []
}

/**
 * Get project name from directory path (lookup or generate)
 */
export function getProjectNameFromDirectory(path: string, config: Config): string {
  // Find in config
  const project = config.projects?.find((p) => p.directory === path)
  if (project) return project.display_name

  // Generate from last path segment
  const lastSegment = path.split(/[\\/]/).pop() || "project"
  return lastSegment.replace(/[^a-zA-Z0-9_-]/g, "-")
}

/**
 * Get project directory from display name
 */
export function getDirectoryFromProjectName(name: string, config: Config): string | null {
  return config.projects?.find((p) => p.display_name === name)?.directory || null
}

/**
 * Load project session state from JSON file (persistence)
 */
export function loadProjectState(): Map<string, Map<string, ProjectSessionState>> {
  const stateFile = path.join(process.cwd(), ".telegram-plugin-state.json")

  try {
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, "utf-8"))
      return new Map(Object.entries(data))
    }
  } catch (err) {
    console.warn("Warning: Failed to load project state:", err)
  }

  return new Map()
}

/**
 * Save project session state to JSON file
 */
export function saveProjectState(state: Map<string, Map<string, ProjectSessionState>>): void {
  const stateFile = path.join(process.cwd(), ".telegram-plugin-state.json")

  try {
    const obj: Record<string, Record<string, ProjectSessionState>> = {}
    for (const [chatId, projects] of state.entries()) {
      obj[chatId] = Object.fromEntries(projects)
    }
    fs.writeFileSync(stateFile, JSON.stringify(obj, null, 2))
  } catch (err) {
    console.error("Error saving project state:", err)
  }
}

