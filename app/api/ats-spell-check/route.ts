import { NextResponse } from "next/server"

import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import nspell from "nspell"

import { ACTION_VERB_DICTIONARY } from "@/lib/action-verb-dictionary"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"
import { REPETITION_EXCLUSION_TERMS } from "@/lib/repetition-exclusions"

const require = createRequire(import.meta.url)
let spellPromise: Promise<ReturnType<typeof nspell>> | null = null

const CUSTOM_ALLOWED_WORDS = new Set<string>([
  ...REPETITION_EXCLUSION_TERMS,
  ...ACTION_VERB_DICTIONARY.map((entry) => entry.verb.toLowerCase()),
  "oauth2",
  "nlp",
  "api",
  "apis",
  "ci",
  "cd",
  "saas",
  "b2b",
  "b2c",
])

async function getSpellChecker() {
  if (!spellPromise) {
    spellPromise = (async () => {
      const dictionaryEntryPath = require.resolve("dictionary-en")
      const dictionaryDir = path.dirname(dictionaryEntryPath)
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

export async function POST(request: Request) {
  const spell = await getSpellChecker()
  const body = (await request.json().catch(() => null)) as {
    content?: string
  } | null

  const content = typeof body?.content === "string" ? body.content : ""
  const counts = new Map<string, number>()

  for (const rawWord of extractCandidateWords(content)) {
    const normalized = rawWord.toLowerCase()
    if (shouldIgnoreWord(rawWord)) continue
    if (spell.correct(normalized)) continue
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
