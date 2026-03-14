"use client"

import { useEffect, useMemo, useState } from "react"

import { BarChart3, ChevronDown, Gauge } from "lucide-react"

import { renderDeterministicATSSection } from "@/components/ats/ats-deterministic-sections"
import {
  getLengthMetrics,
  getAccomplishmentMetrics,
  getActionVerbMetrics,
  getActiveVoiceMetrics,
  getConsistencyMetrics,
  getDateOrderMetrics,
  getFillerWordMetrics,
  getSectionMetrics,
  getSpellCheckMetrics,
} from "@/lib/ats-deterministic-metrics"
import type { ATSNLPAnalysis } from "@/lib/ats-nlp-analysis-types"
import {
  extractExperienceBullets,
  getSectionBulletCounts,
} from "@/lib/ats-resume-parsing"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"
import { REPETITION_STRONG_ACTION_VERBS } from "@/lib/repetition-exclusions"
import { cn } from "@/lib/utils"
import type { ATSScoreResponse, ATSSectionReview } from "@/types/ats"

export type ATSPanelSectionId =
  | "overview"
  | "breakdown"
  | "sample-cv-lines"
  | "action-verbs"
  | "job-match"
  | "quantifying-impact"
  | "action-verb-use"
  | "accomplishments"
  | "repetition"
  | "length"
  | "filler-words"
  | "total-bullet-points"
  | "bullet-points-length"
  | "sections"
  | "personal-pronouns"
  | "buzzwords-cliches"
  | "active-voice"
  | "consistency"
  | "date-order"
  | "spell-check"

export interface ATSNavGroup {
  heading?: string
  items: Array<{
    id: ATSPanelSectionId
    label: string
  }>
}

export interface ATSSectionRendererProps {
  scoreData: ATSScoreResponse
  resumeContent: string
  jobDescription: string
  nlpAnalysis?: ATSNLPAnalysis | null
  spellMetrics?: RuntimeSpellCheckMetrics | null
  onSelectSection?: (sectionId: ATSPanelSectionId) => void
}

type OverviewMetric = {
  id: string
  label: string
  score: number
  note: string
}

type OverviewMetricComputation = {
  metrics: OverviewMetric[]
  overallScore: number
}

type ColorBand = "red" | "orange" | "green"

const OVERVIEW_ACTION_VERBS = new Set([
  "accelerated",
  "achieved",
  "analyzed",
  "built",
  "created",
  "delivered",
  "designed",
  "developed",
  "drove",
  "executed",
  "generated",
  "improved",
  "implemented",
  "increased",
  "launched",
  "led",
  "managed",
  "optimized",
  "owned",
  "reduced",
  "resolved",
  "scaled",
  "streamlined",
])

const REPETITION_ACTION_VERB_ALLOWLIST = new Set<string>(
  REPETITION_STRONG_ACTION_VERBS
)

const PERSONAL_PRONOUN_TERMS = ["i", "me", "my", "mine", "we", "our", "ours"]

const SCORE_BAND_STYLES: Record<
  ColorBand,
  {
    text: string
    bar: string
    ring: string
  }
> = {
  red: {
    text: "text-red-500",
    bar: "bg-red-500",
    ring: "rgba(239, 68, 68, 0.9)",
  },
  orange: {
    text: "text-amber-500",
    bar: "bg-amber-500",
    ring: "rgba(245, 158, 11, 0.9)",
  },
  green: {
    text: "text-green-500",
    bar: "bg-green-500",
    ring: "rgba(34, 197, 94, 0.9)",
  },
}

export const ATS_NAV_GROUPS: ATSNavGroup[] = [
  {
    items: [
      { id: "overview", label: "Overview" },
      { id: "breakdown", label: "Breakdown" },
    ],
  },
  {
    items: [
      { id: "sample-cv-lines", label: "Sample CV Lines" },
      { id: "action-verbs", label: "Action Verbs" },
    ],
  },
  {
    heading: "Impact",
    items: [
      { id: "job-match", label: "Job Match" },
      { id: "quantifying-impact", label: "Quantifying Impact" },
      { id: "action-verb-use", label: "Action Verb Use" },
      { id: "accomplishments", label: "Accomplishments" },
      { id: "repetition", label: "Repetition" },
    ],
  },
  {
    heading: "Brevity",
    items: [
      { id: "length", label: "Length" },
      { id: "filler-words", label: "Filler Words" },
      { id: "total-bullet-points", label: "Total Bullet Points" },
      { id: "bullet-points-length", label: "Bullet Points Length" },
    ],
  },
  {
    heading: "Style",
    items: [
      { id: "sections", label: "Sections" },
      { id: "personal-pronouns", label: "Personal Pronouns" },
      { id: "buzzwords-cliches", label: "Buzzwords & Clichés" },
      { id: "active-voice", label: "Active Voice" },
      { id: "consistency", label: "Consistency" },
      { id: "date-order", label: "Date Order" },
      { id: "spell-check", label: "Spell Check" },
    ],
  },
]

const PLACEHOLDER_COPY: Record<
  Exclude<ATSPanelSectionId, "overview" | "breakdown">,
  { title: string; description: string }
> = {
  "sample-cv-lines": {
    title: "Sample CV Lines",
    description:
      "This module is reserved for example rewrites and side-by-side bullet comparisons.",
  },
  "action-verbs": {
    title: "Action Verbs",
    description:
      "This module will analyze weak openings, repeated verbs, and stronger replacements.",
  },
  "job-match": {
    title: "Job Match",
    description:
      "This module will compare resume language against the job description using term weighting and section coverage.",
  },
  "quantifying-impact": {
    title: "Quantifying Impact",
    description:
      "This module will surface bullets that need measurable outcomes, scale, or business effect.",
  },
  "action-verb-use": {
    title: "Action Verb Use",
    description:
      "This module will score bullet openings for clarity, strength, and variation.",
  },
  accomplishments: {
    title: "Accomplishments",
    description:
      "This module will distinguish task-heavy bullets from accomplishment-driven bullets.",
  },
  repetition: {
    title: "Repetition",
    description:
      "This module will isolate repeated phrasing, duplicate ideas, and overused wording.",
  },
  length: {
    title: "Length",
    description:
      "This module will evaluate overall resume length against ATS-friendly norms.",
  },
  "filler-words": {
    title: "Filler Words",
    description:
      "This module will flag vague padding and suggest tighter alternatives.",
  },
  "total-bullet-points": {
    title: "Total Bullet Points",
    description:
      "This module will review bullet volume by section and identify overloaded areas.",
  },
  "bullet-points-length": {
    title: "Bullet Points Length",
    description:
      "This module will inspect bullets that are too thin to prove impact or too long to scan well.",
  },
  sections: {
    title: "Sections",
    description:
      "This module will check whether each resume section is present, ordered well, and ATS-safe.",
  },
  "personal-pronouns": {
    title: "Personal Pronouns",
    description:
      "This module will flag first-person phrasing and tighten the writing style.",
  },
  "buzzwords-cliches": {
    title: "Buzzwords & Clichés",
    description:
      "This module will identify generic language that weakens credibility.",
  },
  "active-voice": {
    title: "Active Voice",
    description:
      "This module will detect passive phrasing and propose direct achievement language.",
  },
  consistency: {
    title: "Consistency",
    description:
      "This module will review formatting, tense, punctuation, and bullet style consistency.",
  },
  "date-order": {
    title: "Date Order",
    description:
      "This module will validate reverse-chronological ordering and date formatting issues.",
  },
  "spell-check": {
    title: "Spell Check",
    description:
      "This module will collect spelling issues and suspicious terms for review.",
  },
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeExperienceWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9+-]/g, "")
}

function extractExperienceBulletsForScoring(text: string) {
  return extractExperienceBullets(text)
}

function scoreExperienceBulletImpact(bullet: string) {
  const words = bullet.split(/\s+/).map(normalizeExperienceWord).filter(Boolean)
  const wordCount = words.length
  const hasMetric = /\d|%|\$|x|ms|sec|kpi|mrr|arr/i.test(bullet)
  const firstWord = normalizeExperienceWord(words[0] || "")
  const hasStrongVerb = OVERVIEW_ACTION_VERBS.has(firstWord)
  const hasPassiveVoice = /\b(was|were|been|being|is|are)\s+\w+ed\b/i.test(
    bullet
  )
  const hasOutcomeSignal =
    /\b(improv|increas|reduc|grew|cut|saved|raised|boost|accelerat|shorten|stabiliz|expanded)\w*/i.test(
      bullet
    )
  const hasScopeSignal =
    /\b(team|users|customers|branches|stores|platform|system|pipeline|accounts|clinics|markets|regions)\b/i.test(
      bullet
    )

  let score = 3
  if (hasStrongVerb) score += 2
  if (hasMetric) score += 2
  if (hasOutcomeSignal) score += 2
  if (hasScopeSignal) score += 1
  if (wordCount >= 12 && wordCount <= 28) score += 1
  if (wordCount < 8 || wordCount > 34) score -= 1
  if (hasPassiveVoice) score -= 2

  return Math.max(1, Math.min(10, score))
}

function getAverageExperienceBulletImpactScore(resumeContent: string) {
  const bullets = extractExperienceBulletsForScoring(resumeContent)

  if (bullets.length === 0) return null

  const total = bullets.reduce(
    (sum, bullet) => sum + scoreExperienceBulletImpact(bullet),
    0
  )

  return total / bullets.length
}

function getBulletLeadVerbCounts(text: string) {
  const bullets = extractExperienceBulletsForScoring(text)
  const counts = new Map<string, number>()

  for (const bullet of bullets) {
    const firstWord = normalizeExperienceWord(
      bullet.replace(/^[-*•]\s*/, "").split(/\s+/)[0] || ""
    )

    if (!firstWord) continue
    counts.set(firstWord, (counts.get(firstWord) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

function getActionVerbRepetitionMetrics(resumeContent: string) {
  const actionVerbCounts = getBulletLeadVerbCounts(resumeContent).filter(
    ([word]) => REPETITION_ACTION_VERB_ALLOWLIST.has(word)
  )

  const totalActionVerbCount = actionVerbCounts.reduce(
    (sum, [, count]) => sum + count,
    0
  )
  const repeatedActionVerbCount = actionVerbCounts
    .filter(([, count]) => count > 2)
    .reduce((sum, [, count]) => sum + count, 0)

  return {
    totalActionVerbCount,
    repeatedActionVerbCount,
    ratio:
      totalActionVerbCount > 0
        ? repeatedActionVerbCount / totalActionVerbCount
        : null,
  }
}

function countWholeWordMatches(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return (
    text.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, "g"))?.length ?? 0
  )
}

function getPersonalPronounMetrics(resumeContent: string) {
  const totalWords = resumeContent
    .split(/\s+/)
    .map((word) => normalizeExperienceWord(word))
    .filter(Boolean).length

  const totalPronounCount = PERSONAL_PRONOUN_TERMS.reduce(
    (sum, term) => sum + countWholeWordMatches(resumeContent, term),
    0
  )

  return {
    totalWords,
    totalPronounCount,
    ratio: totalWords > 0 ? totalPronounCount / totalWords : 0,
  }
}

function getScoreBand(score: number): ColorBand {
  if (Math.round(score / 10) >= 9) return "green"
  if (Math.round(score / 10) >= 6) return "orange"
  return "red"
}

function getScoreTextColor(score: number) {
  return SCORE_BAND_STYLES[getScoreBand(score)].text
}

function getScoreBarColor(score: number) {
  return SCORE_BAND_STYLES[getScoreBand(score)].bar
}

function getScoreRingColor(score: number) {
  return SCORE_BAND_STYLES[getScoreBand(score)].ring
}

function getStatusTone(status: ATSSectionReview["status"]) {
  switch (status) {
    case "strong":
      return "border-primary/25 bg-primary/10 text-primary"
    case "good":
      return "border-primary/25 bg-primary/10 text-primary"
    case "needs-work":
      return "border-orange-400/25 bg-orange-500/10 text-orange-100"
    case "weak":
      return "border-red-400/25 bg-red-500/10 text-red-100"
  }
}

function getStatusLabel(status: ATSSectionReview["status"]) {
  switch (status) {
    case "strong":
      return "Strong"
    case "good":
      return "Good"
    case "needs-work":
      return "Needs work"
    case "weak":
      return "Weak"
  }
}

function findDebugSection(data: ATSScoreResponse, id: string) {
  return data.debugAnalysis.find((section) => section.id === id) ?? null
}

function findDebugItem(
  data: ATSScoreResponse,
  sectionId: string,
  label: string
) {
  return (
    findDebugSection(data, sectionId)?.items.find(
      (item) => item.label === label
    ) ?? null
  )
}

function parseFraction(detail: string) {
  const match = detail.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return null

  const numerator = Number(match[1])
  const denominator = Number(match[2])

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null
  }

  return { numerator, denominator, ratio: numerator / denominator }
}

function parseFirstInteger(detail: string) {
  const match = detail.match(/(\d+)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function scoreBulletLength(wordCount: number | null) {
  if (wordCount === null) return null
  if (wordCount >= 12 && wordCount <= 28) return 100
  if (wordCount < 12) return clampScore(100 - (12 - wordCount) * 8)
  return clampScore(100 - (wordCount - 28) * 6)
}

const FEEDBACK_PRIORITY_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(missing|not detected|critical|blocker)\b/i, weight: 14 },
  { pattern: /\b(quantif|metric|outcome|result)\b/i, weight: 12 },
  { pattern: /\b(keyword|required terms?|alignment|match)\b/i, weight: 11 },
  { pattern: /\b(experience|bullet|action|star|impact)\b/i, weight: 10 },
  { pattern: /\b(date|timeline|chronology|gap|overlap)\b/i, weight: 9 },
  { pattern: /\b(parse|ats|header|section|format)\b/i, weight: 8 },
  { pattern: /\b(skill|evidence|coverage|traceability)\b/i, weight: 8 },
]

const FEEDBACK_EMPHASIS_TERMS = [
  "missing",
  "critical",
  "quantified",
  "metric",
  "outcome",
  "required",
  "keyword",
  "experience",
  "bullet",
  "date",
  "timeline",
  "gap",
  "overlap",
  "parseability",
  "ATS",
  "skills",
  "evidence",
  "action",
]

function scoreFeedbackLine(text: string) {
  return FEEDBACK_PRIORITY_PATTERNS.reduce((score, rule) => {
    return rule.pattern.test(text) ? score + rule.weight : score
  }, 1)
}

function dedupeFeedbackLines(lines: string[]) {
  const seen = new Set<string>()
  return lines.filter((line) => {
    const key = line.toLowerCase().replace(/\s+/g, " ").trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function pickTopFeedback(lines: string[], limit: number) {
  return dedupeFeedbackLines(lines)
    .map((line) => ({ line, score: scoreFeedbackLine(line) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.line)
}

function buildSectionFeedback(section: ATSSectionReview) {
  return {
    blockers: pickTopFeedback(section.gaps, 3),
    fixes: pickTopFeedback(section.actions, 3),
    keep: pickTopFeedback(section.whatWorks, 2),
  }
}

function renderHighlightedText(text: string) {
  if (!text.trim()) return text
  const escapedTerms = FEEDBACK_EMPHASIS_TERMS.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  )
  const regex = new RegExp(`\\b(${escapedTerms.join("|")})\\b`, "gi")
  const parts = text.split(regex)

  return parts.map((part, index) => {
    const isMatch = FEEDBACK_EMPHASIS_TERMS.some(
      (term) => term.toLowerCase() === part.toLowerCase()
    )
    if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>
    return (
      <span
        key={`${part}-${index}`}
        className="rounded bg-primary/20 px-1 py-0.5 text-primary"
      >
        {part}
      </span>
    )
  })
}

function average(scores: Array<number | null | undefined>, fallback: number) {
  const filtered = scores.filter(
    (score): score is number =>
      typeof score === "number" && Number.isFinite(score)
  )

  if (filtered.length === 0) return fallback

  return clampScore(
    filtered.reduce((sum, score) => sum + score, 0) / filtered.length
  )
}

function useAnimatedEntry(key: string | number) {
  const [isAnimated, setIsAnimated] = useState(false)

  useEffect(() => {
    setIsAnimated(false)
    const frameId = window.requestAnimationFrame(() => setIsAnimated(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [key])

  return isAnimated
}

function useAnimatedNumber(
  value: number,
  key: string | number,
  duration = 900
) {
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    let frameId = 0
    let startTime: number | null = null

    setAnimatedValue(0)

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

      setAnimatedValue(value * eased)
      if (progress < 1) frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [duration, key, value])

  return animatedValue
}

function buildOverviewMetrics(
  data: ATSScoreResponse,
  resumeContent: string,
  runtimeSpellMetrics?: RuntimeSpellCheckMetrics | null,
  nlpAnalysis?: ATSNLPAnalysis | null
): OverviewMetricComputation {
  const buildMetricScore = (
    sectionIds: ATSPanelSectionId[],
    fallback: number
  ) =>
    average(
      sectionIds.map((sectionId) =>
        (() => {
          const navScore = getNavSectionScore(
            sectionId,
            data,
            resumeContent,
            runtimeSpellMetrics,
            nlpAnalysis
          )

          return navScore !== null ? navScore * 10 : null
        })()
      ),
      fallback
    )

  const metrics = [
    {
      id: "impact",
      label: "Impact",
      score: buildMetricScore(
        [
          "quantifying-impact",
          "action-verb-use",
          "accomplishments",
          "repetition",
        ],
        data.categoryScores.contentQuality.score
      ),
      note: "Built from the section scores for impact, achievement language, and repetition.",
    },
    {
      id: "brevity",
      label: "Brevity",
      score: buildMetricScore(
        [
          "length",
          "filler-words",
          "total-bullet-points",
          "bullet-points-length",
        ],
        data.overallScore
      ),
      note: "Built from the section scores for length, filler words, bullet volume, and bullet length.",
    },
    {
      id: "style",
      label: "Style",
      score: buildMetricScore(
        [
          "sections",
          "personal-pronouns",
          "buzzwords-cliches",
          "active-voice",
          "consistency",
          "date-order",
        ],
        data.atsCompatibility.parseability
      ),
      note: "Built from the section scores for structure, tone, consistency, and dates.",
    },
    {
      id: "average-bullet-score",
      label: "Average Bullet Score",
      score: buildMetricScore(
        [
          "quantifying-impact",
          "action-verb-use",
          "accomplishments",
          "bullet-points-length",
        ],
        data.categoryScores.contentQuality.score
      ),
      note: "Built from the section scores that directly evaluate bullet construction.",
    },
  ]
  const explicitOverallScore = clampScore(
    metrics.reduce((sum, metric) => sum + metric.score, 0) /
      Math.max(1, metrics.length)
  )

  return {
    metrics,
    overallScore: explicitOverallScore,
  }
}

export function computeOverviewStandaloneScore(params: {
  scoreData: ATSScoreResponse
  resumeContent: string
  runtimeSpellMetrics?: RuntimeSpellCheckMetrics | null
  nlpAnalysis?: ATSNLPAnalysis | null
}) {
  return buildOverviewMetrics(
    params.scoreData,
    params.resumeContent,
    params.runtimeSpellMetrics ?? null,
    params.nlpAnalysis ?? null
  ).overallScore
}

export function getATSOverviewDisplayScores(
  scoreData: ATSScoreResponse,
  resumeContent: string,
  nlpAnalysis?: ATSNLPAnalysis | null
) {
  const { overallScore: derivedOverviewScore } = buildOverviewMetrics(
    scoreData,
    resumeContent,
    null,
    nlpAnalysis ?? null
  )

  const resumeScore = scoreData.standaloneResumeScore ?? scoreData.overallScore

  return {
    resumeScore,
    overallScore: resumeScore,
    derivedOverviewScore,
    targetRoleScore: scoreData.targetRoleScore,
  }
}

function ScoreMeter({
  score,
  label = "ATS Score",
  caption = "Overall Score",
}: {
  score: number
  label?: string
  caption?: string
}) {
  const isAnimated = useAnimatedEntry(`${label}:${caption}:${score}`)
  const animatedScore = useAnimatedNumber(score, `${label}:${caption}:${score}`)
  const radius = 84
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - (isAnimated ? score : 0) / 100)

  return (
    <div className="flex h-full flex-col rounded-[28px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/42">
        <Gauge className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="relative flex h-48 w-48 items-center justify-center rounded-full">
          <svg
            className="-rotate-90 absolute inset-0 h-full w-full"
            viewBox="0 0 200 200"
            aria-hidden="true"
          >
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="10"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={getScoreRingColor(score)}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{
                transition:
                  "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </svg>
          <div className="relative text-center">
            <div
              className={cn(
                "text-5xl font-semibold transition-colors",
                getScoreTextColor(score)
              )}
            >
              {Math.round(animatedScore)}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/42">
              {caption}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewMetricRow({
  metric,
  isAnimated,
}: {
  metric: OverviewMetric
  isAnimated: boolean
}) {
  const animatedScore = useAnimatedNumber(
    metric.score,
    `${metric.id}:${metric.score}`
  )
  const scoreOutOfHundred = Math.max(
    0,
    Math.min(100, Math.round(animatedScore))
  )
  const displayFill = Math.max(0, Math.min(100, scoreOutOfHundred))

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{metric.label}</p>
        </div>
        <div
          className={cn(
            "text-2xl font-semibold",
            getScoreTextColor(metric.score)
          )}
        >
          {scoreOutOfHundred}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full origin-left", getScoreBarColor(metric.score))}
          style={{
            transform: `scaleX(${(isAnimated ? displayFill : 0) / 100})`,
            transition: "transform 800ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  )
}

function OverviewMetricList({ metrics }: { metrics: OverviewMetric[] }) {
  const isAnimated = useAnimatedEntry(
    metrics.map((metric) => `${metric.id}:${metric.score}`).join("|")
  )

  return (
    <div className="rounded-[28px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/42">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        Overview Metrics
      </div>
      <div className="mt-5 space-y-4">
        {metrics.map((metric) => (
          <OverviewMetricRow
            key={metric.id}
            metric={metric}
            isAnimated={isAnimated}
          />
        ))}
      </div>
    </div>
  )
}

function ATSOverviewSection({
  scoreData,
  resumeContent,
  spellMetrics,
}: ATSSectionRendererProps) {
  const { metrics } = useMemo(
    () => buildOverviewMetrics(scoreData, resumeContent, spellMetrics, null),
    [resumeContent, scoreData, spellMetrics]
  )
  const hasTargetMyCVScore = scoreData.targetRoleScore !== null
  const resumeScore = scoreData.standaloneResumeScore ?? scoreData.overallScore
  const overviewSummary = (() => {
    const score = hasTargetMyCVScore
      ? scoreData.targetRoleScore || 0
      : resumeScore

    if (hasTargetMyCVScore) {
      if (score >= 90) {
        return `Your resume is already strong on its own, and the current job-targeting is excellent. Resume ATS is ${resumeScore}/100 and Target My CV is ${scoreData.targetRoleScore}/100.`
      }

      if (score >= 80) {
        return `Your resume foundation is solid, and the job targeting is in a strong range. Resume ATS is ${resumeScore}/100 and Target My CV is ${scoreData.targetRoleScore}/100.`
      }

      if (score >= 70) {
        return `Your resume reads reasonably well for ATS, but the job-specific positioning still has room to improve. Resume ATS is ${resumeScore}/100 and Target My CV is ${scoreData.targetRoleScore}/100.`
      }

      if (score >= 60) {
        return `Your base resume is workable, but the current job match is still underpowered. Resume ATS is ${resumeScore}/100 and Target My CV is ${scoreData.targetRoleScore}/100.`
      }

      return `Your resume needs stronger tailoring to this job before it will compete well. Resume ATS is ${resumeScore}/100 and Target My CV is ${scoreData.targetRoleScore}/100.`
    }

    if (score >= 90) {
      return "Excellent work. Your CV ranks among the strongest resumes we analyze and is already performing at a high ATS standard, with only small refinements left."
    }

    if (score >= 80) {
      return "Good start. Your CV ranks among the top 20% of the resumes we analyze, with a strong foundation and a few clear opportunities to improve further."
    }

    if (score >= 70) {
      return "Good start. Your CV ranks among the top 30% of the resumes we analyze, but there is still room to improve impact, clarity, and ATS strength."
    }

    if (score >= 60) {
      return "Your CV is in a workable range, but it still trails the stronger resumes we analyze. A few focused improvements should noticeably raise its ATS performance."
    }

    if (score >= 45) {
      return "Your CV shows potential, but it is still underperforming against many of the resumes we analyze. It needs sharper structure, stronger bullets, and clearer evidence of impact."
    }

    return "Your CV currently sits below the stronger resumes we analyze and needs substantial improvement in structure, wording, and evidence before it can compete well in ATS screening."
  })()

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">Overview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasTargetMyCVScore
            ? "Separate resume and target-role scoring, plus the core ATS quality signals behind them."
            : "High-level ATS scoring across impact, brevity, style, and bullet quality."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(360px,1.05fr)]">
        {hasTargetMyCVScore ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreMeter
              score={resumeScore}
              label="Resume ATS"
              caption="Standalone CV"
            />
            <ScoreMeter
              score={scoreData.targetRoleScore || 0}
              label="Target My CV"
              caption="Job Match"
            />
          </div>
        ) : (
          <ScoreMeter score={resumeScore} />
        )}
        <OverviewMetricList metrics={metrics} />
      </div>

      <div className="rounded-[28px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className="text-sm leading-7 text-muted-foreground">
          {overviewSummary}
        </p>
      </div>
    </div>
  )
}

function ATSBreakdownSection({ scoreData }: ATSSectionRendererProps) {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(
    scoreData.sectionReviews[0]?.id ?? null
  )
  const [showDetailedDiagnostics, setShowDetailedDiagnostics] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">Breakdown</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Section-by-section ATS scoring from the current deterministic
          analysis.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowDetailedDiagnostics((value) => !value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] transition-colors",
              showDetailedDiagnostics
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-white/12 text-muted-foreground hover:text-foreground"
            )}
          >
            {showDetailedDiagnostics ? "Detailed View On" : "Detailed View Off"}
          </button>
        </div>
        {scoreData.sectionReviews.map((section) => {
          const isExpanded = expandedMetric === section.id
          const curated = buildSectionFeedback(section)

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-[24px] border border-white/8 bg-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedMetric(isExpanded ? null : section.id)
                }
                className="w-full px-4 py-4 text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">
                        {section.title}
                      </h4>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          getStatusTone(section.status)
                        )}
                      >
                        {getStatusLabel(section.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {section.diagnosis}
                    </p>
                  </div>

                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded ? "rotate-180" : ""
                    )}
                  />
                </div>
              </button>

              {isExpanded ? (
                <div className="border-t border-white/8 px-4 py-4">
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-red-200">
                        Top Blockers
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {curated.blockers.length > 0 ? (
                          curated.blockers.map((item) => (
                            <li key={item}>{renderHighlightedText(item)}</li>
                          ))
                        ) : (
                          <li>No material blockers in this section.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-primary">
                        Best Fixes
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {curated.fixes.length > 0 ? (
                          curated.fixes.map((item) => (
                            <li key={item}>{renderHighlightedText(item)}</li>
                          ))
                        ) : (
                          <li>No high-priority fixes were generated.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                        Keep Doing
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {curated.keep.length > 0 ? (
                          curated.keep.map((item) => (
                            <li key={item}>{renderHighlightedText(item)}</li>
                          ))
                        ) : (
                          <li>No explicit section strengths captured yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {showDetailedDiagnostics ? (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/55">
                        Detailed Diagnostics
                      </div>
                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                            What Works
                          </div>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {section.whatWorks.length > 0 ? (
                              section.whatWorks.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>
                                No strengths captured for this section yet.
                              </li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                            Gaps
                          </div>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {section.gaps.length > 0 ? (
                              section.gaps.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>
                                No major gaps were recorded for this section.
                              </li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                            Actions
                          </div>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {section.actions.length > 0 ? (
                              section.actions.map((item) => (
                                <li key={item}>{item}</li>
                              ))
                            ) : (
                              <li>No follow-up actions were generated.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function renderATSSection(
  sectionId: ATSPanelSectionId,
  props: ATSSectionRendererProps
) {
  if (sectionId === "overview") {
    return <ATSOverviewSection {...props} />
  }

  if (sectionId === "breakdown") {
    return <ATSBreakdownSection {...props} />
  }

  const placeholder = PLACEHOLDER_COPY[sectionId]
  void placeholder

  return renderDeterministicATSSection(
    sectionId,
    props.scoreData,
    props.resumeContent,
    props.jobDescription,
    props.nlpAnalysis,
    props.spellMetrics,
    props.onSelectSection
  )
}

export function getNavLabel(sectionId: ATSPanelSectionId) {
  for (const group of ATS_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.id === sectionId)
    if (item) return item.label
  }

  return "Overview"
}

export function getPanelScoreTone(score: number) {
  return getScoreTextColor(score)
}

export function getPanelScoreBar(score: number) {
  return getScoreBarColor(score)
}

function scoreFromRatio(value: number | null) {
  if (value === null) return null
  return clampScore(value * 100)
}

function scoreToTen(value: number | null) {
  if (value === null) return null
  return Math.max(1, Math.min(10, Math.round(value / 10)))
}

function scoreExperienceBulletVolume(experienceBulletCount: number) {
  if (experienceBulletCount >= 10 && experienceBulletCount <= 14) return 96
  if (experienceBulletCount >= 15 && experienceBulletCount <= 18) return 90
  if (experienceBulletCount >= 19 && experienceBulletCount <= 21) return 80
  if (experienceBulletCount >= 22 && experienceBulletCount <= 24) return 72
  if (experienceBulletCount >= 25) {
    return clampScore(68 - (experienceBulletCount - 25) * 4)
  }
  if (experienceBulletCount >= 8)
    return clampScore(74 + (experienceBulletCount - 8) * 4)
  return clampScore(52 + experienceBulletCount * 4)
}

export function getNavSectionScore(
  sectionId: ATSPanelSectionId,
  data: ATSScoreResponse,
  resumeContent = "",
  runtimeSpellMetrics?: RuntimeSpellCheckMetrics | null,
  nlpAnalysis?: ATSNLPAnalysis | null
) {
  const quantifiedScore = scoreFromRatio(
    parseFraction(
      findDebugItem(data, "bullets", "Quantified bullets")?.detail || ""
    )?.ratio ?? null
  )
  const businessImpactScore = scoreFromRatio(
    parseFraction(
      findDebugItem(data, "bullets", "Business impact bullets")?.detail || ""
    )?.ratio ?? null
  )
  const averageBulletLengthScore = scoreBulletLength(
    parseFirstInteger(
      findDebugItem(data, "bullets", "Average bullet length")?.detail || ""
    )
  )
  const totalBullets =
    parseFraction(
      findDebugItem(data, "bullets", "Quantified bullets")?.detail || ""
    )?.denominator ?? null
  const bulletCounts = getSectionBulletCounts(resumeContent)
  const experienceBulletCount = bulletCounts.experienceBulletCount
  const repeatedWords = findDebugSection(data, "repetition")?.items.length ?? 0
  const workExperienceScore =
    data.sectionReviews.find((section) => section.id === "workExperience")
      ?.score ?? data.categoryScores.contentQuality.score
  const averageExperienceBulletImpactScore =
    getAverageExperienceBulletImpactScore(resumeContent)
  const actionVerbMetrics = getActionVerbMetrics(resumeContent)
  const accomplishmentMetrics = getAccomplishmentMetrics(resumeContent)
  const actionVerbRepetition = getActionVerbRepetitionMetrics(resumeContent)
  const personalPronounMetrics = getPersonalPronounMetrics(resumeContent)
  const spellMetrics =
    runtimeSpellMetrics ?? getSpellCheckMetrics(resumeContent)
  const dateMetrics = getDateOrderMetrics(resumeContent)
  const lengthMetrics = getLengthMetrics(resumeContent)
  const activeVoiceMetrics = getActiveVoiceMetrics(resumeContent)
  const consistencyMetrics = getConsistencyMetrics(resumeContent)
  const fillerWordMetrics = getFillerWordMetrics(resumeContent)
  const sectionMetrics = getSectionMetrics(resumeContent, {
    missingRequiredSections: data.evidenceSummary?.missingSections ?? [],
    missingOptionalSections: [],
  })

  switch (sectionId) {
    case "quantifying-impact":
      if (nlpAnalysis) return scoreToTen(nlpAnalysis.quantifyingImpact.score)
      return averageExperienceBulletImpactScore !== null
        ? Math.round(averageExperienceBulletImpactScore)
        : scoreToTen(
            average(
              [quantifiedScore, businessImpactScore, workExperienceScore],
              data.overallScore
            )
          )
    case "job-match":
      if (data.targetRoleScore !== null) {
        return scoreToTen(data.targetRoleScore)
      }
      return nlpAnalysis?.jobMatch.hasJobDescription
        ? scoreToTen(nlpAnalysis.jobMatch.score)
        : scoreToTen(data.keywordAnalysis?.matchPercentage ?? data.overallScore)
    case "action-verb-use":
      return scoreToTen(actionVerbMetrics.score)
    case "accomplishments":
      return scoreToTen(accomplishmentMetrics.score)
    case "repetition":
      if (nlpAnalysis) {
        if (nlpAnalysis.repetition.repeatedLeadVerbs.length === 0) return 10
        return scoreToTen(nlpAnalysis.repetition.score)
      }
      return actionVerbRepetition.ratio !== null
        ? actionVerbRepetition.repeatedActionVerbCount === 0
          ? 10
          : scoreToTen(clampScore((1 - actionVerbRepetition.ratio) * 100))
        : scoreToTen(clampScore(100 - repeatedWords * 12))
    case "buzzwords-cliches":
      if (nlpAnalysis) return scoreToTen(nlpAnalysis.buzzwords.score)
      return scoreToTen(clampScore(100 - repeatedWords * 10))
    case "length":
      return scoreToTen(lengthMetrics.score)
    case "filler-words":
      return scoreToTen(fillerWordMetrics.score)
    case "total-bullet-points":
      return scoreToTen(
        experienceBulletCount <= 0
          ? totalBullets === null
            ? data.overallScore
            : scoreExperienceBulletVolume(totalBullets)
          : scoreExperienceBulletVolume(experienceBulletCount)
      )
    case "bullet-points-length":
      if (nlpAnalysis) return scoreToTen(nlpAnalysis.bulletLength.score)
      return scoreToTen(averageBulletLengthScore ?? data.overallScore)
    case "sections":
      return scoreToTen(sectionMetrics.score)
    case "personal-pronouns":
      return scoreToTen(
        clampScore(
          100 - Math.min(60, personalPronounMetrics.totalPronounCount * 12)
        )
      )
    case "buzzwords-cliches":
      return scoreToTen(clampScore(100 - repeatedWords * 10))
    case "active-voice":
      return scoreToTen(activeVoiceMetrics.score)
    case "consistency":
      return scoreToTen(consistencyMetrics.score)
    case "date-order":
      return scoreToTen(dateMetrics.score)
    case "spell-check":
      return scoreToTen(spellMetrics.score)
    default:
      return null
  }
}
