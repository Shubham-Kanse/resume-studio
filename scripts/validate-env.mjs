import fs from "node:fs"
import path from "node:path"

const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
]

const REQUIRED_ENV_VARS = [
  {
    name: "GROQ_API_KEY",
    purpose: "AI resume generation and AI ATS insights",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    purpose: "Supabase browser and server clients",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    purpose: "Supabase browser and server clients",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    purpose: "Admin account deletion and billing synchronization",
  },
  {
    name: "POLAR_ACCESS_TOKEN",
    purpose: "Polar checkout and customer portal",
  },
  {
    name: "POLAR_WEBHOOK_SECRET",
    purpose: "Polar webhook verification",
  },
  {
    name: "POLAR_PRO_PRODUCT_ID",
    purpose: "Pro plan checkout configuration",
  },
  {
    name: "UPSTASH_REDIS_REST_URL",
    purpose: "Shared production rate limiting",
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    purpose: "Shared production rate limiting",
  },
]

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) continue

    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim())
    process.env[key] = value
  }
}

function loadLocalEnvFiles() {
  for (const file of ENV_FILES) {
    loadEnvFile(path.resolve(process.cwd(), file))
  }
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase()

  return (
    !normalized ||
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("placeholder") ||
    normalized.includes("example") ||
    normalized === "changeme"
  )
}

function validateEnv() {
  const missing = []

  for (const requirement of REQUIRED_ENV_VARS) {
    const value = process.env[requirement.name]
    if (!value || isPlaceholder(value)) {
      missing.push(requirement)
    }
  }

  if (missing.length === 0) {
    console.log("Environment validation passed.")
    return
  }

  console.error("")
  console.error("Environment validation failed.")
  console.error("The build was stopped because required environment variables are missing or still use placeholder values.")
  console.error("")

  for (const requirement of missing) {
    console.error(`- ${requirement.name}: ${requirement.purpose}`)
  }

  console.error("")
  console.error("Set these variables in your deployment provider and local env files before running `pnpm build` again.")
  process.exit(1)
}

loadLocalEnvFiles()
validateEnv()
