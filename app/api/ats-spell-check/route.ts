import { NextRequest, NextResponse } from "next/server"

import { readFile } from "node:fs/promises"
import path from "node:path"
import nspell from "nspell"
import { z } from "zod"

import { ACTION_VERB_DICTIONARY } from "@/lib/action-verb-dictionary"
import { enforceRateLimit } from "@/lib/api-rate-limit"
import { validationErrorResponse } from "@/lib/api-response"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"
import { REPETITION_EXCLUSION_TERMS } from "@/lib/repetition-exclusions"

let spellPromise: Promise<ReturnType<typeof nspell>> | null = null

const CUSTOM_ALLOWED_WORDS = new Set<string>([
  ...REPETITION_EXCLUSION_TERMS,
  ...ACTION_VERB_DICTIONARY.map((entry) => entry.verb.toLowerCase()),
  "oauth",
  "oauth2",
  "kafka",
  "cloud-native",
  "msc",
  "galway",
  "nlp",
  "api",
  "apis",
  "ci",
  "cd",
  "saas",
  "b2b",
  "b2c",
])

const spellCheckSchema = z.object({
  content: z
    .string()
    .trim()
    .max(60000, "Content is too long.")
    .optional()
    .default(""),
})

async function getSpellChecker() {
  if (!spellPromise) {
    spellPromise = (async () => {
      const dictionaryDir = path.join(
        process.cwd(),
        "node_modules",
        "dictionary-en"
      )
      const [aff, dic] = await Promise.all([
        readFile(path.join(dictionaryDir, "index.aff")),
        readFile(path.join(dictionaryDir, "index.dic")),
      ])
      const spell = nspell({ aff, dic })

      for (const word of CUSTOM_ALLOWED_WORDS) {
        spell.add(word)
      }

      return spell
    })()
  }

  return spellPromise
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function extractCandidateWords(text: string) {
  return text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
}

function shouldIgnoreWord(word: string) {
  if (word.length < 3) return true
  if (/[0-9]/.test(word)) return true
  if (/^[A-Z]{2,}$/.test(word)) return true
  if (CUSTOM_ALLOWED_WORDS.has(word.toLowerCase())) return true
  return false
}

function isWordAccepted(
  spell: ReturnType<typeof nspell>,
  word: string
): boolean {
  if (spell.correct(word)) return true

  const normalized = word.toLowerCase()
  if (normalized !== word && spell.correct(normalized)) return true

  if (CUSTOM_ALLOWED_WORDS.has(normalized)) return true

  if (word.includes("-")) {
    const parts = word
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean)
    if (
      parts.length > 1 &&
      parts.every((part) => {
        const lower = part.toLowerCase()
        return (
          spell.correct(part) ||
          spell.correct(lower) ||
          CUSTOM_ALLOWED_WORDS.has(lower)
        )
      })
    ) {
      return true
    }
  }

  return false
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, {
    key: "ats-spell-check",
    limit: 20,
    windowMs: 60_000,
    requireRemoteInProduction: true,
  })
  if (rateLimitResponse) return rateLimitResponse

  const spell = await getSpellChecker()
  const parsed = spellCheckSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success) {
    return validationErrorResponse(parsed.error)
  }

  const content = parsed.data.content
  const counts = new Map<string, number>()

  for (const rawWord of extractCandidateWords(content)) {
    const normalized = rawWord.toLowerCase()
    if (shouldIgnoreWord(rawWord)) continue
    if (isWordAccepted(spell, rawWord)) continue
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  const issues = [...counts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      suggestions: spell.suggest(word).slice(0, 4),
    }))
    .sort((left, right) => right.count - left.count)

  const totalMisspellingCount = issues.reduce(
    (sum, issue) => sum + issue.count,
    0
  )
  const metrics: RuntimeSpellCheckMetrics = {
    issues,
    totalMisspellingCount,
    score:
      totalMisspellingCount === 0
        ? 100
        : clampScore(100 - totalMisspellingCount * 14),
  }

  return NextResponse.json(metrics)
}
