"use client"

import { useEffect, useMemo, useState } from "react"

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  MessageSquare,
  Search,
  Sparkles,
  Target,
} from "lucide-react"

import {
  ACTION_VERB_CATEGORIES,
  ACTION_VERB_DICTIONARY,
  type ActionVerbCategory,
  WEAK_ACTION_VERB_DICTIONARY,
} from "@/lib/action-verb-dictionary"
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
import type {
  ATSBulletImpactAnalysis,
  ATSNLPAnalysis,
} from "@/lib/ats-nlp-analysis-types"
import {
  extractExperienceBullets,
  getSectionBulletCounts,
} from "@/lib/ats-resume-parsing"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"
import { REPETITION_STRONG_ACTION_VERBS } from "@/lib/repetition-exclusions"
import { cn } from "@/lib/utils"
import type { ATSScoreResponse } from "@/types/ats"

type ATSPanelSectionId =
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

type InsightBlock = {
  title: string
  summary: string
  bullets: Array<
    | string
    | {
        label: string
        tone?: "default" | "danger"
      }
  >
  highlights?: Array<{
    label: string
    value: string
    tone?: "default" | "success" | "danger"
  }>
  details?: Array<
    | string
    | {
        label: string
        targetSection: ATSPanelSectionId
      }
  >
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

function getScoreRingColor(score: number) {
  if (score >= 90) return "rgba(34, 197, 94, 0.9)"
  if (score >= 60) return "rgba(245, 158, 11, 0.9)"
  return "rgba(239, 68, 68, 0.9)"
}

function getScoreTextColor(score: number) {
  if (score >= 90) return "text-green-500"
  if (score >= 60) return "text-amber-500"
  return "text-red-500"
}

type SectionContent = {
  title: string
  description: string
  analysis: InsightBlock
  recruiterInsights: InsightBlock
  feedback: InsightBlock
}

type JobMatchTab = "missing" | "found"

const SAMPLE_CV_LINE_LIBRARY = [
  "Reduced loan-processing turnaround time by 32% by redesigning handoff workflows between underwriting and operations, which improved customer approval speed during peak banking periods.",
  "Increased branch cross-sell conversions by 18% after analyzing customer account behavior and introducing targeted outreach scripts for relationship managers.",
  "Prevented recurring reconciliation delays by automating daily exception reporting, allowing the finance team to close month-end two days earlier.",
  "Improved fraud detection response time by 40% by building an alert-prioritization workflow that helped investigators focus on the highest-risk transactions first.",
  "Raised quarterly SaaS renewal rates by 11% after identifying churn patterns and launching a customer success playbook for at-risk enterprise accounts.",
  "Cut warehouse picking errors by 27% through barcode-validation checks and updated floor processes, improving shipment accuracy during seasonal demand spikes.",
  "Stabilized API response times during traffic surges by rewriting caching logic, reducing median latency from 480ms to 190ms for customer-facing services.",
  "Expanded clinic appointment capacity by 22% after mapping patient no-show trends and introducing a same-day backfill scheduling process.",
  "Increased e-commerce add-to-cart conversion by 14% by testing simplified product-page copy and clearer pricing presentation across key categories.",
  "Reduced invoice dispute volume by 35% after standardizing billing documentation and training account teams on cleaner client handoff procedures.",
  "Improved audit readiness by centralizing compliance evidence across five departments, cutting document retrieval time from hours to minutes.",
  "Boosted restaurant table turnover by 16% by reorganizing server station coverage and adjusting prep sequencing during evening rush periods.",
  "Lowered cloud infrastructure spend by 21% after identifying underused compute resources and implementing autoscaling policies across production workloads.",
  "Raised student course completion by 19% through early-risk outreach campaigns and clearer weekly progress nudges in the learning platform.",
  "Reduced customer support backlog by 38% by grouping repeat ticket types and launching reusable response macros for frontline agents.",
  "Shortened procurement cycle time by 25% after replacing email-based approvals with a centralized intake and routing workflow.",
  "Improved manufacturing defect detection by 30% by introducing first-pass quality checkpoints before final assembly packaging.",
  "Increased ad campaign ROAS by 24% after reallocating spend toward high-intent segments and rewriting low-performing creative variations.",
  "Reduced employee onboarding time from 15 days to 9 by consolidating training materials and sequencing access requests in advance.",
  "Improved donor retention by 13% after segmenting outreach by giving history and launching follow-up campaigns tied to program outcomes.",
  "Decreased patient claim denials by 17% by correcting intake data capture issues and retraining staff on insurance verification standards.",
  "Expanded B2B pipeline coverage by 28% after building a cleaner lead-scoring model that surfaced high-fit accounts for the sales team.",
  "Reduced retail stockouts by 23% through weekly demand reviews and revised replenishment thresholds for fast-moving SKUs.",
  "Improved newsroom publishing speed by 26% by removing duplicate editorial approvals and clarifying responsibilities across desks.",
  "Raised hotel guest satisfaction scores by 0.6 points by redesigning check-in communication and escalating service recovery faster.",
  "Decreased recruiting time-to-fill by 18 days after standardizing interview scorecards and tightening recruiter-to-manager feedback loops.",
  "Improved field technician productivity by 20% by reorganizing route planning and bundling service calls by geography and urgency.",
  "Reduced returned shipments by 29% after identifying packaging failure patterns and updating material standards for fragile orders.",
  "Increased nonprofit grant win rate by 15% by creating reusable proposal evidence libraries and tighter submission review timelines.",
  "Shortened legal contract review turnaround by 33% through clause templates and a routing model based on deal complexity.",
  "Improved grocery spoilage control by 18% by tightening receiving checks and rotating inventory based on shelf-life data.",
  "Reduced classroom admin workload by 7 hours per week by automating attendance summaries and parent communication templates.",
  "Raised marketplace seller activation by 21% after simplifying onboarding tasks and clarifying first-week success milestones.",
  "Improved call-center first-contact resolution by 12% through script redesign and a better knowledge-base search structure.",
  "Reduced project delivery slippage by 31% by surfacing weekly risk flags earlier and resetting milestone ownership across the team.",
  "Expanded laboratory sample throughput by 17% after sequencing bench work more efficiently and removing duplicate logging steps.",
  "Improved real estate lead qualification by 20% through faster response workflows and revised intake questions for buyer readiness.",
  "Cut social content production time by 35% by introducing reusable templates and batching review cycles by campaign.",
  "Reduced mechanical downtime by 22% after analyzing failure logs and scheduling preventive maintenance before peak operating windows.",
  "Increased mobile app retention by 9% by simplifying first-session onboarding and adding clearer feature guidance for new users.",
]

const BUZZWORDS = [
  "hardworking",
  "team player",
  "go-getter",
  "self-starter",
  "results-driven",
  "dynamic",
  "synergy",
  "detail-oriented",
  "fast-paced",
  "passionate",
]

const PERSONAL_PRONOUNS = ["i", "me", "my", "mine", "we", "our", "ours"]

const STANDARD_SECTION_HEADERS = [
  "summary",
  "professional summary",
  "experience",
  "work experience",
  "employment",
  "projects",
  "skills",
  "education",
  "certifications",
]

const REPETITION_ACTION_VERB_ALLOWLIST = new Set<string>(
  REPETITION_STRONG_ACTION_VERBS
)

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9+-]/g, "")
}

function toWords(text: string) {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean)
}

function getLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function isLikelySectionHeader(line: string) {
  const normalized = line
    .trim()
    .toLowerCase()
    .replace(/[:\s]+$/g, "")
  const words = normalized.split(/\s+/).filter(Boolean)
  const alphaOnly = line.replace(/[^A-Za-z]/g, "")
  const isMostlyUppercase =
    alphaOnly.length > 0 && alphaOnly === alphaOnly.toUpperCase()

  return (
    STANDARD_SECTION_HEADERS.includes(normalized) ||
    (isMostlyUppercase && words.length <= 4)
  )
}

function getBulletLines(text: string) {
  return getLines(text).filter(
    (line) =>
      !isLikelySectionHeader(line) && /^([-*•]|[A-Za-z0-9].{0,4})/.test(line)
  )
}

function getImpactGapDrivers(bullet: ATSBulletImpactAnalysis) {
  const drivers: string[] = []
  const signals = bullet.signals

  if (signals.taskHeavy || signals.outcomeMentions === 0) {
    drivers.push("Result is under-explained")
  }
  if (!signals.resultPattern) {
    drivers.push("No explicit action-to-result connector")
  }
  if (signals.scopeMentions === 0) {
    drivers.push("Scope/coverage context is thin")
  }
  if (!bullet.quantified) {
    drivers.push("No measurable metric in line")
  }
  if (signals.passiveVoice) {
    drivers.push("Passive voice weakens ownership")
  }
  if (signals.wordCount < 9 || signals.wordCount > 34) {
    drivers.push("Length is outside optimal scanning range")
  }

  return drivers.slice(0, 3)
}

type ImpactFeedbackPoint = {
  title: string
  status: "strong" | "needs-work"
  evidence: string
  action: string
}

function buildImpactFeedbackPoints(
  bullet: ATSBulletImpactAnalysis
): ImpactFeedbackPoint[] {
  const points: ImpactFeedbackPoint[] = []
  const signals = bullet.signals

  points.push({
    title: "Ownership signal",
    status:
      signals.strongLeadVerb || (!!signals.leadVerb && !signals.weakLeadPhrase)
        ? "strong"
        : "needs-work",
    evidence: signals.leadVerb
      ? `Lead verb detected: "${signals.leadVerb}".`
      : "No clear lead verb detected at bullet start.",
    action:
      signals.strongLeadVerb || (!!signals.leadVerb && !signals.weakLeadPhrase)
        ? "Keep the current ownership-first opening."
        : "Start with a stronger direct action verb that reflects what you drove.",
  })

  points.push({
    title: "Metric strength",
    status: bullet.quantified ? "strong" : "needs-work",
    evidence: bullet.quantified
      ? `${signals.metricMentions} metric signal(s) found in the bullet.`
      : "No measurable metric signal detected.",
    action: bullet.quantified
      ? "Strengthen with baseline -> delta -> business effect where possible."
      : "Add a measurable result (%, latency, revenue, cost, volume, or time).",
  })

  points.push({
    title: "Outcome clarity",
    status: signals.outcomeMentions > 0 ? "strong" : "needs-work",
    evidence:
      signals.outcomeMentions > 0
        ? `Outcome language detected (${signals.outcomeMentions} match${signals.outcomeMentions === 1 ? "" : "es"}).`
        : "Result language is weak or missing.",
    action:
      signals.outcomeMentions > 0
        ? "Keep outcome phrasing explicit and concrete."
        : "State what improved, reduced, increased, accelerated, or changed.",
  })

  points.push({
    title: "Scope and context",
    status: signals.scopeMentions > 0 ? "strong" : "needs-work",
    evidence:
      signals.scopeMentions > 0
        ? `Scope signal detected (${signals.scopeMentions} context cue${signals.scopeMentions === 1 ? "" : "s"}).`
        : "Scope context is thin (users, systems, team, process, region, etc.).",
    action:
      signals.scopeMentions > 0
        ? "Keep naming where the impact landed."
        : "Add where the impact landed: users, platform, team, operations, or process.",
  })

  points.push({
    title: "Action-to-result flow",
    status: signals.resultPattern ? "strong" : "needs-work",
    evidence: signals.resultPattern
      ? "Action-to-result connector detected."
      : "No clear result connector detected (for example: by, resulting in, leading to).",
    action: signals.resultPattern
      ? "Preserve this structure for scanability."
      : "Use a clearer action -> result link so impact is easy to scan in one pass.",
  })

  points.push({
    title: "Readability and tone",
    status:
      !signals.passiveVoice && signals.wordCount >= 9 && signals.wordCount <= 34
        ? "strong"
        : "needs-work",
    evidence: `${signals.wordCount} words${signals.passiveVoice ? ", passive voice detected." : ", active voice."}`,
    action:
      !signals.passiveVoice && signals.wordCount >= 9 && signals.wordCount <= 34
        ? "Length and voice are in a recruiter-friendly range."
        : "Use active voice and keep length tight enough for quick recruiter scanning.",
  })

  return points
}

function buildImpactDeductionBreakdown(
  bullet: ATSBulletImpactAnalysis,
  marksDeducted: number
) {
  const raw: Array<{ label: string; weight: number; reason: string }> = []
  const signals = bullet.signals

  if (!bullet.quantified) {
    raw.push({
      label: "No measurable metric",
      weight: 1.2,
      reason: "Impact is harder to benchmark without numeric proof.",
    })
  }
  if (signals.outcomeMentions === 0) {
    raw.push({
      label: "Outcome under-defined",
      weight: 1.1,
      reason: "The result of the work is not explicit enough.",
    })
  }
  if (!signals.resultPattern) {
    raw.push({
      label: "Weak action-to-result link",
      weight: 0.9,
      reason: "The sentence does not clearly connect action to effect.",
    })
  }
  if (signals.scopeMentions === 0) {
    raw.push({
      label: "Scope/context thin",
      weight: 0.7,
      reason: "It does not clearly show where or for whom impact landed.",
    })
  }
  if (signals.weakLeadPhrase) {
    raw.push({
      label: "Weak opening phrase",
      weight: 0.6,
      reason: "Opening language softens ownership.",
    })
  }
  if (signals.passiveVoice) {
    raw.push({
      label: "Passive voice",
      weight: 0.7,
      reason: "Ownership is less direct in passive construction.",
    })
  }
  if (signals.wordCount < 9 || signals.wordCount > 34) {
    raw.push({
      label: "Length friction",
      weight: 0.5,
      reason: "Line length reduces scan efficiency.",
    })
  }

  if (marksDeducted <= 0 || raw.length === 0) return []

  const totalWeight = raw.reduce((sum, item) => sum + item.weight, 0)
  return raw
    .map((item) => ({
      ...item,
      marks: (item.weight / totalWeight) * marksDeducted,
    }))
    .sort((a, b) => b.marks - a.marks)
    .slice(0, 3)
}

function QuantifyingImpactSection({
  resumeContent,
  nlpAnalysis,
}: {
  resumeContent: string
  nlpAnalysis?: ATSNLPAnalysis | null
}) {
  const impactBullets =
    nlpAnalysis?.quantifyingImpact.bulletAnalyses ??
    extractExperienceBullets(resumeContent).map((bullet) => ({
      bullet,
      achievementLike: false,
      quantified: false,
      score: 10,
      scoreOutOfTen: 1,
      analysis: [
        "The shared NLP impact analysis has not loaded yet for this bullet.",
      ],
      feedback: [
        "Run the ATS analysis again if this state persists so the bullet can be scored properly.",
      ],
      reasons: [],
      signals: {
        leadVerb: null,
        wordCount: 0,
        metricMentions: 0,
        outcomeMentions: 0,
        scopeMentions: 0,
        strongLeadVerb: false,
        weakLeadPhrase: false,
        passiveVoice: false,
        resultPattern: false,
        starLike: false,
        taskHeavy: false,
        keywordMatches: [],
        relevanceRatio: 0,
        technicalEntities: [],
        roleAlignmentTerms: [],
      },
    }))
  const [activeBulletIndex, setActiveBulletIndex] = useState(0)

  const safeIndex =
    impactBullets.length === 0
      ? 0
      : Math.min(activeBulletIndex, impactBullets.length - 1)
  const activeBullet = impactBullets[safeIndex] ?? null
  const marksDeducted = activeBullet
    ? Math.max(0, 10 - activeBullet.scoreOutOfTen)
    : 0
  const impactGapDrivers = activeBullet ? getImpactGapDrivers(activeBullet) : []
  const impactFeedbackPoints = activeBullet
    ? buildImpactFeedbackPoints(activeBullet)
    : []
  const deductionBreakdown = activeBullet
    ? buildImpactDeductionBreakdown(activeBullet, marksDeducted)
    : []

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">
          Quantifying Impact
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This section reviews only the bullet points from your experience
          section and scores how impactful each one feels out of 10.
        </p>
      </div>

      {impactBullets.length > 0 ? (
        <>
          <div className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() =>
                  setActiveBulletIndex((current) => Math.max(0, current - 1))
                }
                disabled={safeIndex === 0}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-foreground transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous bullet"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                  Experience Bullet {safeIndex + 1} of {impactBullets.length}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveBulletIndex((current) =>
                    Math.min(impactBullets.length - 1, current + 1)
                  )
                }
                disabled={safeIndex === impactBullets.length - 1}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-foreground transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next bullet"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {activeBullet
              ? (() => {
                  return (
                    <section className="mx-auto max-w-4xl rounded-[24px] border border-white/8 bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm leading-7 text-foreground">
                            {activeBullet.bullet}
                          </p>
                        </div>
                        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-center">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                            Impact
                          </div>
                          <div className="mt-1 text-3xl font-semibold text-foreground">
                            {activeBullet.scoreOutOfTen}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <MessageSquare className="h-4 w-4 text-primary" />
                            Analysis
                          </div>
                          <ul className="mt-4 space-y-3">
                            {activeBullet.analysis.map((item) => (
                              <li
                                key={item}
                                className="text-sm leading-6 text-muted-foreground"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Feedback
                          </div>
                          <div className="mt-3 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
                            {marksDeducted > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-100">
                                  {marksDeducted} mark
                                  {marksDeducted === 1 ? "" : "s"} below 10
                                </span>
                                {impactGapDrivers.map((reason) => (
                                  <span
                                    key={reason}
                                    className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-100"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs text-green-100">
                                  Full impact score (10/10)
                                </span>
                              </div>
                            )}
                            <ul className="space-y-3">
                              {marksDeducted > 0 ? (
                                <li className="text-sm leading-6 text-red-100">
                                  Score gap reason: this bullet is{" "}
                                  {marksDeducted} mark
                                  {marksDeducted === 1 ? "" : "s"} below 10 due
                                  to the highlighted impact gaps above.
                                </li>
                              ) : null}
                              {deductionBreakdown.map((item) => (
                                <li
                                  key={`${item.label}-${item.reason}`}
                                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-100"
                                >
                                  <span className="font-medium">
                                    {item.label}
                                  </span>{" "}
                                  (~{item.marks.toFixed(1)} mark): {item.reason}
                                </li>
                              ))}
                            </ul>

                            <div className="space-y-2">
                              {impactFeedbackPoints.map((point) => (
                                <div
                                  key={point.title}
                                  className={
                                    point.status === "strong"
                                      ? "rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2"
                                      : "rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2"
                                  }
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-medium text-foreground">
                                      {point.title}
                                    </div>
                                    <span
                                      className={
                                        point.status === "strong"
                                          ? "rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-green-100"
                                          : "rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-red-100"
                                      }
                                    >
                                      {point.status === "strong"
                                        ? "Strong"
                                        : "Needs work"}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                    Evidence: {point.evidence}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-foreground">
                                    Fix: {point.action}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <ul className="space-y-3">
                              {activeBullet.feedback.map((item) => (
                                <li
                                  key={item}
                                  className="text-sm leading-6 text-muted-foreground"
                                >
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </section>
                  )
                })()
              : null}
          </div>

          <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb className="h-4 w-4 text-primary" />
              Recruiter Insights
            </div>
            <ul className="mt-4 space-y-3">
              <li className="text-sm leading-6 text-muted-foreground">
                Recruiters trust experience bullets faster when the result is
                visible on the page, not implied between the lines.
              </li>
              <li className="text-sm leading-6 text-muted-foreground">
                In most hiring funnels, a quantified bullet usually beats a
                broader but unmeasured claim because it is easier to compare and
                easier to believe.
              </li>
              <li className="text-sm leading-6 text-muted-foreground">
                The strongest resumes do not quantify every bullet, but they do
                quantify the lines that matter most in the latest and most
                relevant role.
              </li>
            </ul>
          </section>
        </>
      ) : (
        <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <p className="text-sm leading-7 text-muted-foreground">
            I could not detect bullet points inside the experience section yet.
            Add standard experience bullets under a heading like Experience or
            Work Experience and this panel will score them one by one.
          </p>
        </section>
      )}
    </div>
  )
}

function ActionVerbDictionarySection() {
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<
    ActionVerbCategory | "All"
  >("All")

  const categories: Array<ActionVerbCategory | "All"> = [
    "All",
    ...ACTION_VERB_CATEGORIES,
  ]
  const normalizedQuery = query.trim().toLowerCase()
  const suggestedQuery = useMemo(
    () => findClosestVerbQuery(normalizedQuery),
    [normalizedQuery]
  )
  const searchQuery =
    suggestedQuery && suggestedQuery !== normalizedQuery
      ? suggestedQuery
      : normalizedQuery

  const weakMatches = useMemo(() => {
    if (!searchQuery) return []

    return WEAK_ACTION_VERB_DICTIONARY.filter((entry) => {
      const haystack = [entry.weak, entry.note, ...entry.replacements]
        .join(" ")
        .toLowerCase()

      return haystack.includes(searchQuery)
    })
  }, [searchQuery])

  const results = useMemo(() => {
    return ACTION_VERB_DICTIONARY.filter((entry) => {
      if (
        activeCategory !== "All" &&
        !entry.categories.includes(activeCategory)
      ) {
        return false
      }

      if (!searchQuery) return true

      const haystack = [
        entry.verb,
        entry.categories.join(" "),
        entry.useWhen,
        ...entry.replaces,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(searchQuery)
    })
  }, [activeCategory, searchQuery])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">Action Verbs</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this searchable dictionary to find strong non-buzzword action
          verbs and swap out weaker wording in your CV.
        </p>
      </div>

      <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search verbs, weak phrases, or categories..."
            className="h-11 w-full rounded-2xl border border-white/12 bg-black/20 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-white/30 focus:border-primary/35 focus:bg-white/[0.04]"
          />
        </div>

        {suggestedQuery && suggestedQuery !== normalizedQuery ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Did you mean</span>
            <button
              type="button"
              onClick={() => setQuery(suggestedQuery)}
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/15"
            >
              {suggestedQuery}
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => {
            const active = activeCategory === category

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-primary/35 bg-primary/12 text-primary"
                    : "border-white/10 bg-transparent text-muted-foreground hover:border-white/18 hover:text-foreground"
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>

        {weakMatches.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb className="h-4 w-4 text-primary" />
              Replace Weak Verbs
            </div>
            <div className="mt-4 space-y-4">
              {weakMatches.map((entry) => (
                <article
                  key={entry.weak}
                  className="rounded-2xl border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/55">
                      Weak
                    </span>
                    <h4 className="text-base font-semibold text-foreground">
                      {entry.weak}
                    </h4>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {entry.note}
                  </p>

                  <div className="mt-4">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                      Better Replacements
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.replacements.map((replacement) => (
                        <span
                          key={`${entry.weak}-${replacement}`}
                          className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                        >
                          {replacement}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((entry) => (
            <article
              key={`${entry.verb}-${entry.categories.join("-")}-${entry.useWhen}`}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-foreground">
                  {entry.verb}
                </h4>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                  {entry.categories.join(", ")}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Use this when {entry.useWhen}.
              </p>

              <div className="mt-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                  Replace
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.replaces.map((word) => (
                    <span
                      key={`${entry.verb}-${word}`}
                      className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        {results.length === 0 && weakMatches.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-muted-foreground">
            No verb matches yet. Try a weaker phrase like `helped`, `worked on`,
            or `responsible for`, or browse a category such as `Technical`,
            `Business`, or `Management`.
          </div>
        ) : null}
      </section>
    </div>
  )
}

function countPhraseOccurrences(text: string, phrases: string[]) {
  return phrases
    .map((phrase) => ({
      label: phrase,
      count: countPhraseMatches(text, phrase),
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
}

function getLeadVerbCounts(bullets: string[]) {
  const counts = new Map<string, number>()

  for (const bullet of bullets) {
    const firstWord = normalizeWord(
      bullet.replace(/^[-*•]\s*/, "").split(/\s+/)[0] || ""
    )
    if (!firstWord) continue
    counts.set(firstWord, (counts.get(firstWord) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

function bulletsWithMetrics(bullets: string[]) {
  return bullets.filter((bullet) =>
    /\d|%|\$|x|ms|sec|kpi|mrr|arr/i.test(bullet)
  )
}

function bulletsWithoutMetrics(bullets: string[]) {
  return bullets.filter(
    (bullet) => !/\d|%|\$|x|ms|sec|kpi|mrr|arr/i.test(bullet)
  )
}

function averageBulletWordCount(bullets: string[]) {
  if (bullets.length === 0) return 0

  const total = bullets.reduce((sum, bullet) => sum + toWords(bullet).length, 0)
  return Math.round(total / bullets.length)
}

function makeHighlights(items: Array<[string, number]>, suffix = "") {
  return items.slice(0, 6).map(([label, value]) => ({
    label,
    value: `${value}${suffix}`,
  }))
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countPhraseMatches(text: string, phrase: string) {
  const regex = new RegExp(`\\b${escapeRegex(phrase.toLowerCase())}\\b`, "g")
  return text.toLowerCase().match(regex)?.length ?? 0
}

function levenshteinDistance(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0)
  )

  for (let index = 0; index <= left.length; index += 1)
    matrix[index]![0] = index
  for (let index = 0; index <= right.length; index += 1)
    matrix[0]![index] = index

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + cost
      )
    }
  }

  return matrix[left.length]![right.length]!
}

function findClosestVerbQuery(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  const candidates = [
    ...ACTION_VERB_DICTIONARY.map((entry) => entry.verb.toLowerCase()),
    ...WEAK_ACTION_VERB_DICTIONARY.map((entry) => entry.weak.toLowerCase()),
  ]

  let best: { candidate: string; distance: number } | null = null

  for (const candidate of candidates) {
    const distance = levenshteinDistance(normalized, candidate)
    if (!best || distance < best.distance) {
      best = { candidate, distance }
    }
  }

  if (!best) return null
  return best.distance <= Math.max(2, Math.floor(normalized.length * 0.25))
    ? best.candidate
    : null
}

function renderBlock(
  label: string,
  icon: React.ComponentType<{ className?: string }>,
  block: InsightBlock,
  onSelectSection?: (sectionId: ATSPanelSectionId) => void
) {
  const Icon = icon

  return (
    <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {block.summary}
      </p>

      {block.highlights && block.highlights.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {block.highlights.map((item) => (
            <span
              key={`${item.label}-${item.value}`}
              className={
                item.tone === "danger"
                  ? "rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-100"
                  : item.tone === "success"
                    ? "rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs text-green-100"
                    : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-foreground"
              }
            >
              {item.label}
              {item.value ? (
                <>
                  {" "}
                  <span
                    className={
                      item.tone === "danger"
                        ? "text-red-200/80"
                        : item.tone === "success"
                          ? "text-green-200/80"
                          : "text-muted-foreground"
                    }
                  >
                    {item.value}
                  </span>
                </>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {block.bullets.map((bullet) => {
          if (typeof bullet === "string") {
            return (
              <li
                key={bullet}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-muted-foreground"
              >
                {bullet}
              </li>
            )
          }

          return (
            <li
              key={bullet.label}
              className={`
                rounded-2xl border px-4 py-3 text-sm leading-6
                ${
                  bullet.tone === "danger"
                    ? "border-red-500/20 bg-red-500/10 text-red-100"
                    : "border-white/8 bg-white/[0.03] text-muted-foreground"
                }
              `}
            >
              {bullet.label}
            </li>
          )
        })}
      </ul>

      {block.details && block.details.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
            More Details
          </div>
          <ul className="mt-3 space-y-2">
            {block.details.map((detail) => {
              if (typeof detail === "string") {
                return (
                  <li
                    key={detail}
                    className="text-sm leading-6 text-muted-foreground"
                  >
                    {detail}
                  </li>
                )
              }

              return (
                <li key={`${detail.targetSection}-${detail.label}`}>
                  <button
                    type="button"
                    onClick={() => onSelectSection?.(detail.targetSection)}
                    className="text-sm leading-6 text-primary transition-colors hover:text-primary/85"
                  >
                    {detail.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function sample<T>(items: T[], count: number) {
  return items.slice(0, count)
}

function formatConsistencyCategory(category: string) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatSectionName(section: string) {
  return section
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function groupIssuesByLine<
  T extends { line: string; phrase: string; reason: string },
>(issues: T[]) {
  const grouped = new Map<
    string,
    {
      line: string
      phrases: string[]
      reasons: string[]
    }
  >()

  for (const issue of issues) {
    const current = grouped.get(issue.line) ?? {
      line: issue.line,
      phrases: [],
      reasons: [],
    }

    if (!current.phrases.includes(issue.phrase)) {
      current.phrases.push(issue.phrase)
    }
    if (!current.reasons.includes(issue.reason)) {
      current.reasons.push(issue.reason)
    }

    grouped.set(issue.line, current)
  }

  return [...grouped.values()]
}

function getJobMatchSummary(score: number) {
  if (score >= 85) {
    return "Strong match. Your CV is carrying the core language and qualification signals this job is screening for."
  }
  if (score >= 70) {
    return "Reasonable match. The CV is covering part of the target role, but there are still missing terms and weaker sections to tighten."
  }
  if (score >= 55) {
    return "Needs improvement. The CV is missing enough role-specific language that ATS and recruiter relevance will likely suffer."
  }
  return "Weak match. Your CV is not yet targeted closely enough to the job description to compete well in automated screening."
}

function buildKeywordEntries(
  terms: string[],
  category: "missing" | "found",
  scoreData: ATSScoreResponse,
  jobDescription: string
) {
  const requiredTerms = new Set(
    scoreData.keywordAnalysis?.matchedByCategory.required ?? []
  )
  const missingRequiredTerms = new Set(
    scoreData.keywordAnalysis?.missingByCategory.required ?? []
  )
  const titleTerms = new Set(
    scoreData.keywordAnalysis?.matchedByCategory.title ?? []
  )

  return terms.map((term) => ({
    term,
    count: Math.max(1, countPhraseMatches(jobDescription, term)),
    isKeySkill:
      category === "missing"
        ? missingRequiredTerms.has(term)
        : requiredTerms.has(term) || titleTerms.has(term),
  }))
}

function renderHighlightedJobDescription(
  jobDescription: string,
  foundTerms: string[],
  missingTerms: string[]
) {
  if (!jobDescription.trim()) {
    return (
      <p className="text-sm leading-7 text-muted-foreground">
        Paste a job description to see keyword highlighting here.
      </p>
    )
  }

  const found = [...new Set(foundTerms)].sort(
    (left, right) => right.length - left.length
  )
  const missing = [...new Set(missingTerms)].sort(
    (left, right) => right.length - left.length
  )
  const allTerms = [
    ...missing.map((term) => ({ term, tone: "missing" as const })),
    ...found.map((term) => ({ term, tone: "found" as const })),
  ]
  const lines = jobDescription.split("\n")

  return (
    <div className="space-y-3">
      {lines.map((line, lineIndex) => {
        if (!line.trim())
          return <div key={`empty-${lineIndex}`} className="h-2" />

        const nodes: React.ReactNode[] = []
        let cursor = 0

        while (cursor < line.length) {
          const lowerLine = line.toLowerCase()
          const match = allTerms.find(({ term }) =>
            lowerLine.slice(cursor).startsWith(term.toLowerCase())
          )

          if (match) {
            const matchedText = line.slice(cursor, cursor + match.term.length)
            nodes.push(
              <span
                key={`${lineIndex}-${cursor}-${match.term}`}
                className={cn(
                  "rounded-full px-2 py-0.5",
                  match.tone === "found"
                    ? "bg-green-500/12 text-green-100"
                    : "bg-amber-500/12 text-amber-100"
                )}
              >
                {matchedText}
              </span>
            )
            cursor += match.term.length
            continue
          }

          let nextIndex = line.length
          for (const { term } of allTerms) {
            const foundIndex = lowerLine.indexOf(term.toLowerCase(), cursor)
            if (foundIndex !== -1 && foundIndex < nextIndex)
              nextIndex = foundIndex
          }

          const plainText = line.slice(cursor, nextIndex)
          if (plainText) {
            nodes.push(
              <span key={`${lineIndex}-${cursor}-plain`}>{plainText}</span>
            )
          }
          cursor = nextIndex
        }

        return (
          <p
            key={`line-${lineIndex}`}
            className="text-sm leading-7 text-muted-foreground"
          >
            {nodes}
          </p>
        )
      })}
    </div>
  )
}

function JobMatchSection({
  scoreData,
  jobDescription,
}: {
  scoreData: ATSScoreResponse
  jobDescription: string
}) {
  const [activeTab, setActiveTab] = useState<JobMatchTab>("missing")
  const targetScore =
    scoreData.targetRoleScore ?? scoreData.keywordAnalysis?.matchPercentage ?? 0
  const foundTerms = scoreData.keyFindings.presentKeywords ?? []
  const missingTerms = scoreData.keyFindings.missingKeywords ?? []
  const hasJobDescription = Boolean(jobDescription.trim())
  const foundEntries = buildKeywordEntries(
    foundTerms,
    "found",
    scoreData,
    jobDescription
  )
  const missingEntries = buildKeywordEntries(
    missingTerms,
    "missing",
    scoreData,
    jobDescription
  )
  const activeEntries = activeTab === "missing" ? missingEntries : foundEntries
  const isAnimated = useAnimatedEntry(`job-match:${Math.round(targetScore)}`)
  const animatedScore = useAnimatedNumber(
    targetScore,
    `job-match:${Math.round(targetScore)}`
  )
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - (isAnimated ? targetScore : 0) / 100)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">Job Match</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Target-role relevance based on missing and found job-description
          keywords.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
        <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <div className="grid gap-5 md:grid-cols-[160px_1fr] md:items-center">
              <div className="mx-auto flex h-40 w-40 items-center justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full">
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
                      stroke={getScoreRingColor(targetScore)}
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
                        "text-4xl font-semibold transition-colors",
                        getScoreTextColor(targetScore)
                      )}
                    >
                      {Math.round(animatedScore)}
                    </div>
                    <div className="mt-2 text-[9px] uppercase tracking-[0.18em] text-white/42">
                      Relevance
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Relevancy Score
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {getJobMatchSummary(Math.round(targetScore))}
                </p>
                {hasJobDescription ? (
                  <p className="text-sm leading-7 text-muted-foreground">
                    Aim for stronger coverage in the summary, skills, and latest
                    relevant experience bullets before re-scoring.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex gap-4 border-b border-white/8">
              {(["missing", "found"] as const).map((tab) => {
                const isActive = activeTab === tab
                const count =
                  tab === "missing"
                    ? missingEntries.length
                    : foundEntries.length

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "missing" ? "Missing Keywords" : "Found Keywords"}{" "}
                    {count > 0 ? `(${count})` : ""}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03]">
              <div className="grid grid-cols-[minmax(0,1fr)_84px_84px] gap-3 border-b border-white/8 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                <div>Keyword Or Skill</div>
                <div>Count</div>
                <div>Key Skill</div>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {activeEntries.length > 0 ? (
                  activeEntries.map((entry) => (
                    <div
                      key={`${activeTab}-${entry.term}`}
                      className="grid grid-cols-[minmax(0,1fr)_84px_84px] gap-3 border-b border-white/8 px-4 py-3 text-sm text-muted-foreground last:border-b-0"
                    >
                      <div className="min-w-0 break-words text-foreground">
                        {entry.term}
                      </div>
                      <div>{entry.count}</div>
                      <div>
                        {entry.isKeySkill ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="text-white/20">-</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    {activeTab === "missing"
                      ? "No missing keywords detected for the current job description."
                      : "No matched keywords detected yet."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="h-4 w-4 text-primary" />
            Job Description Highlights
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            {renderHighlightedJobDescription(
              jobDescription,
              foundTerms,
              missingTerms
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function buildSectionContent(
  sectionId: ATSPanelSectionId,
  scoreData: ATSScoreResponse,
  resumeContent: string,
  jobDescription: string,
  nlpAnalysis?: ATSNLPAnalysis | null,
  runtimeSpellMetrics?: RuntimeSpellCheckMetrics | null
): SectionContent {
  const bullets = getBulletLines(resumeContent)
  const experienceBullets = extractExperienceBullets(resumeContent)
  const bulletCounts = getSectionBulletCounts(resumeContent)
  const experienceBulletCount = bulletCounts.experienceBulletCount
  const oversizedOtherSections = bulletCounts.otherSectionCounts
    .filter((entry) => entry.bulletCount >= 8)
    .sort((left, right) => right.bulletCount - left.bulletCount)
  const lines = getLines(resumeContent)
  const contentLines = lines.filter((line) => !isLikelySectionHeader(line))
  const repeatedLeadVerbs = getLeadVerbCounts(bullets).filter(
    ([, count]) => count > 2
  )
  const repetitionHighlights = repeatedLeadVerbs
    .filter(([word]) => REPETITION_ACTION_VERB_ALLOWLIST.has(word))
    .slice(0, 6)
  const accomplishmentMetrics = getAccomplishmentMetrics(resumeContent)
  const actionVerbMetrics = getActionVerbMetrics(resumeContent)
  const actionVerbIssueLines = groupIssuesByLine(actionVerbMetrics.issues)
  const quantifiedBullets = bulletsWithMetrics(experienceBullets)
  const unquantifiedBullets = bulletsWithoutMetrics(experienceBullets)
  const activeVoiceMetrics = getActiveVoiceMetrics(resumeContent)
  const consistencyMetrics = getConsistencyMetrics(resumeContent)
  const fillerWordMetrics = getFillerWordMetrics(resumeContent)
  const buzzwordHits = countPhraseOccurrences(resumeContent, BUZZWORDS)
  const pronounHits = countPhraseOccurrences(resumeContent, PERSONAL_PRONOUNS)
  const dateMetrics = getDateOrderMetrics(resumeContent)
  const lengthMetrics = getLengthMetrics(resumeContent)
  const spellMetrics =
    runtimeSpellMetrics ?? getSpellCheckMetrics(resumeContent)
  const sectionMetrics = getSectionMetrics(resumeContent, {
    missingRequiredSections: scoreData.evidenceSummary?.missingSections ?? [],
    missingOptionalSections: [],
  })
  const averageBulletLength = averageBulletWordCount(bullets)
  const repetitionPanel = nlpAnalysis?.repetition ?? null
  const impactPanel = nlpAnalysis?.quantifyingImpact ?? null
  const bulletLengthPanel = nlpAnalysis?.bulletLength ?? null
  const buzzwordPanel = nlpAnalysis?.buzzwords ?? null
  const hasTargetMyCVScore = scoreData.targetRoleScore !== null
  const hasJobDescription = Boolean(jobDescription.trim())
  const keywordAnalysis = scoreData.keywordAnalysis
  const foundTerms = scoreData.keyFindings.presentKeywords ?? []
  const missingTerms = scoreData.keyFindings.missingKeywords ?? []

  const baseInsights: Record<
    ATSPanelSectionId,
    { title: string; description: string; recruiter: string[] }
  > = {
    "sample-cv-lines": {
      title: "Sample CV Lines",
      description: "Representative lines from the resume and how they read.",
      recruiter: [
        "Recruiters usually prefer bullets that open with a clear action, add scope, and end with a result.",
        "Strong lines are easy to scan in one pass and avoid stacking too many clauses together.",
        "Most companies expect the clearest impact to show up in the first few words of each bullet.",
      ],
    },
    "action-verbs": {
      title: "Action Verbs",
      description: "Checks how forceful and varied the bullet openings are.",
      recruiter: [
        "Recruiters expect bullets to start with direct verbs rather than soft filler phrases.",
        "Across most companies, repeated weak openings make a CV feel templated quickly.",
        "Good action verbs show ownership, scope, and pace without sounding inflated.",
      ],
    },
    "job-match": {
      title: "Job Match",
      description:
        "Checks how well the resume language aligns with the job description.",
      recruiter: [
        "Recruiters expect the strongest resumes to mirror the target role language without stuffing keywords unnaturally.",
        "Strong job-match signals usually appear in the summary, latest experience bullets, and skills section first.",
        "The market standard is not keyword spam. It is visible relevance in the sections recruiters scan fastest.",
      ],
    },
    "quantifying-impact": {
      title: "Quantifying Impact",
      description:
        "Checks whether the resume proves results with numbers and scope.",
      recruiter: [
        "In the current market, recruiters heavily reward metrics because they make achievements easier to trust.",
        "Top resumes usually attach numbers to delivery speed, scale, cost, revenue, or efficiency.",
        "Large companies especially look for evidence that the candidate can measure outcomes.",
      ],
    },
    "action-verb-use": {
      title: "Action Verb Use",
      description:
        "Looks at verb strength, variation, and repeated lead words.",
      recruiter: [
        "Recruiters expect visible ownership words like built, led, delivered, optimized, or launched.",
        "Strong resumes rotate verbs naturally instead of repeating the same opener across sections.",
        "The standard is clarity first: the verb should tell me what you actually drove.",
      ],
    },
    accomplishments: {
      title: "Accomplishments",
      description:
        "Checks whether the bullets sound like achievements instead of responsibilities.",
      recruiter: [
        "Recruiters want accomplishment language, not just task inventory.",
        "Strong market-standard bullets usually answer what changed because of your work.",
        "The best resumes show results, ownership, and business effect in the same line.",
      ],
    },
    repetition: {
      title: "Repetition",
      description:
        "Highlights repeated wording and patterns that weaken variety.",
      recruiter: [
        "Repeated language is one of the fastest ways a resume starts to feel generic.",
        "Recruiters usually tolerate some repetition around technical terms, but not around verbs and filler language.",
        "The market standard is controlled repetition for keywords and varied phrasing for achievements.",
      ],
    },
    length: {
      title: "Length",
      description:
        "Checks overall density and whether the resume is carrying too much or too little.",
      recruiter: [
        "Recruiters generally expect concise one-page or tightly justified two-page resumes depending on seniority.",
        "Standard resumes avoid oversized summaries and overly dense bullets.",
        "The best resumes leave enough space for the important evidence to stand out.",
      ],
    },
    "filler-words": {
      title: "Filler Words",
      description: "Looks for vague language that does not add proof.",
      recruiter: [
        "Recruiters quickly tune out filler because it slows scanning without adding evidence.",
        "The market standard is specific nouns, metrics, and outcomes instead of soft qualifiers.",
        "Companies care more about what changed than about generic descriptors of effort.",
      ],
    },
    "total-bullet-points": {
      title: "Total Bullet Points",
      description:
        "Checks whether bullet volume is balanced for resume scanning.",
      recruiter: [
        "Recruiters usually prefer enough bullets to show evidence, but not so many that nothing stands out.",
        "A strong market pattern is fewer, sharper bullets under each role.",
        "At most companies, overloaded sections reduce scan speed and retention.",
      ],
    },
    "bullet-points-length": {
      title: "Bullet Points Length",
      description:
        "Looks for bullets that are too short to prove value or too long to scan cleanly.",
      recruiter: [
        "Recruiters generally prefer bullets that are short enough to scan but long enough to prove impact.",
        "The market standard is one main idea per bullet, with context and result in the same line where possible.",
        "Long bullets usually need trimming, while very short bullets usually need evidence.",
      ],
    },
    sections: {
      title: "Sections",
      description:
        "Checks whether the resume uses clear, standard resume sections.",
      recruiter: [
        "Recruiters expect standard section headers because they make scanning easier immediately.",
        "ATS systems and recruiters both respond better to familiar labels like Summary, Experience, Skills, and Education.",
        "The market standard is clear structure before design flair.",
      ],
    },
    "personal-pronouns": {
      title: "Personal Pronouns",
      description:
        "Looks for first-person writing that makes the tone less resume-like.",
      recruiter: [
        "Recruiters usually expect resume bullets to drop personal pronouns entirely.",
        "The market standard is implied ownership through action verbs, not conversational phrasing.",
        "Most company resumes read more crisply when they remove I, my, and we unless context requires it.",
      ],
    },
    "buzzwords-cliches": {
      title: "Buzzwords & Cliches",
      description: "Checks for market-worn phrases that weaken credibility.",
      recruiter: [
        "Recruiters are used to seeing the same vague phrases over and over, so they rarely help.",
        "The market standard is proof over branding language.",
        "Companies respond better to specifics than to self-descriptions that anyone can claim.",
      ],
    },
    "active-voice": {
      title: "Active Voice",
      description: "Checks whether bullets sound direct or passive.",
      recruiter: [
        "Recruiters prefer direct active phrasing because it makes ownership obvious.",
        "The market standard is action-result language, not passive narration.",
        "Across companies, active voice makes achievements easier to remember and easier to trust.",
      ],
    },
    consistency: {
      title: "Consistency",
      description:
        "Checks whether the writing style stays steady across the document.",
      recruiter: [
        "Recruiters notice tense changes, punctuation drift, and style shifts faster than most candidates expect.",
        "The market standard is consistent bullet style, punctuation, and tense across equivalent sections.",
        "Clean consistency creates trust before a recruiter reads the details.",
      ],
    },
    "date-order": {
      title: "Date Order",
      description: "Checks date formatting and visible chronology signals.",
      recruiter: [
        "Recruiters expect reverse-chronological ordering unless there is a very specific reason not to.",
        "The market standard is one consistent date format across the whole resume.",
        "Most companies lose trust quickly when dates look inconsistent or hard to parse.",
      ],
    },
    "spell-check": {
      title: "Spell Check",
      description: "Surfaces obvious misspellings and suspicious terms.",
      recruiter: [
        "Recruiters treat spelling mistakes as an avoidable quality signal.",
        "The market standard is zero obvious spelling errors in visible headings and bullets.",
        "Even strong resumes lose credibility fast when common misspellings slip through.",
      ],
    },
  }

  const base = baseInsights[sectionId]

  const analysisBySection: Record<ATSPanelSectionId, InsightBlock> = {
    "sample-cv-lines": {
      title: "Analysis",
      summary:
        "Here are representative lines from your CV that a recruiter is likely to notice early. I’m looking at whether they scan quickly, prove value, and sound like real outcomes instead of generic resume language.",
      bullets: contentLines.slice(0, 5),
      details: [
        `I picked these from ${lines.length} non-empty lines because early scan value matters most in recruiter review.`,
        "The strongest sample lines usually combine action, context, and result in one pass.",
        "If a line sounds like setup without proof, it will usually underperform against stronger resumes.",
      ],
    },
    "action-verbs": {
      title: "Analysis",
      summary:
        "These are the lead verbs showing up most often in your bullets right now. I’m focusing on whether the openings feel repetitive, generic, or strong enough to signal ownership.",
      bullets: getLeadVerbCounts(bullets)
        .slice(0, 6)
        .map(([verb, count]) => `${verb} appears ${count} times.`) || [
        "I could not detect enough bullet-style lines to evaluate action verb usage properly.",
      ],
      highlights: makeHighlights(repeatedLeadVerbs),
      details: [
        `I detected ${bullets.length} bullet-style lines to judge opening verbs.`,
        "Repeated strong verbs are less damaging than repeated weak verbs, but both still reduce variety.",
        "The first word in a bullet heavily influences how quickly a recruiter forms a quality judgment.",
      ],
    },
    "job-match": {
      title: "Analysis",
      summary: hasJobDescription
        ? hasTargetMyCVScore
          ? `Your Target My CV score is ${scoreData.targetRoleScore}/100. I used token normalization and TF-IDF style term weighting to compare your resume against the supplied job description.`
          : "I used token normalization and TF-IDF style term weighting to compare your resume against the supplied job description."
        : "Add a job description to activate the job-match analysis. This section works best when it can compare your resume against a real target role.",
      bullets: hasJobDescription
        ? [
            ...(hasTargetMyCVScore
              ? [`Target My CV score: ${scoreData.targetRoleScore}/100.`]
              : []),
            keywordAnalysis?.matchedByCategory.required.length ||
            keywordAnalysis?.matchedByCategory.title.length
              ? `Matched role terms already present: ${[
                  ...(keywordAnalysis?.matchedByCategory.title ?? []),
                  ...(keywordAnalysis?.matchedByCategory.required ?? []),
                ]
                  .slice(0, 8)
                  .join(", ")}.`
              : "I am not seeing many of the strongest job-description terms in the resume yet.",
            missingTerms.length > 0
              ? `Missing or underrepresented terms: ${missingTerms.slice(0, 6).join(", ")}.`
              : "The resume is already covering most of the highest-value job-description terms.",
          ]
        : ["Paste a job description before relying on this panel."],
      highlights: hasJobDescription
        ? [
            ...(hasTargetMyCVScore
              ? [
                  {
                    label: "Target My CV",
                    value: `${scoreData.targetRoleScore}`,
                    tone: "success" as const,
                  },
                ]
              : []),
            {
              label: "Matched",
              value: `${foundTerms.length}`,
              tone: "success" as const,
            },
            {
              label: "Missing",
              value: `${missingTerms.length}`,
              tone: "danger" as const,
            },
          ]
        : [],
      details: hasJobDescription
        ? [
            ...Object.entries(keywordAnalysis?.coverageBySection ?? {})
              .filter(([, terms]) => terms.length > 0)
              .slice(0, 4)
              .map(
                ([section, terms]) =>
                  `${section}: ${terms.slice(0, 5).join(", ")}`
              ),
            "The strongest ATS alignment usually comes from distributing important terms across the summary, skills, and the latest relevant experience bullets.",
          ]
        : ["This panel stays dormant until a job description is available."],
    },
    "quantifying-impact": {
      title: "Analysis",
      summary: impactPanel
        ? `I classified ${impactPanel.totalBullets} experience bullets using NLP signals for metrics, outcomes, and achievement language. ${impactPanel.achievementLikeBullets} read achievement-like and ${impactPanel.responsibilityLikeBullets} still read more like responsibilities.`
        : `I found ${quantifiedBullets.length} bullets with measurable signals and ${unquantifiedBullets.length} without them. This section is about whether your impact feels proven, not just claimed.`,
      bullets: impactPanel
        ? [
            impactPanel.quantifiedBullets > 0
              ? `${impactPanel.quantifiedBullets} bullets already include measurable proof.`
              : "I am not seeing many quantified bullets yet, but that is not the only thing driving this score.",
            impactPanel.responsibilityLikeBullets > 0
              ? `${impactPanel.responsibilityLikeBullets} bullets still read more like responsibilities than outcomes.`
              : "Most bullets already read more like achievements than responsibilities.",
            ...impactPanel.bulletAnalyses
              .filter((item) => !item.achievementLike)
              .slice(0, 3)
              .map((item) => `Bullet to strengthen: "${item.bullet}"`),
          ]
        : [
            quantifiedBullets.length > 0
              ? `${quantifiedBullets.length} bullets already include numbers, percentages, money, timing, or scale.`
              : "I am not seeing many quantified bullets yet, but tools, relevance, and action language still matter heavily here.",
            unquantifiedBullets.length > 0
              ? `${unquantifiedBullets.length} bullets still read as claims without concrete measurement.`
              : "Most bullets already include some measurable signal.",
            ...sample(
              unquantifiedBullets.map(
                (bullet) =>
                  `This bullet is a good candidate for a metric: "${bullet}"`
              ),
              3
            ),
          ],
      details: [
        "Quantification does not always mean percentages. It can also mean scale, users, latency, throughput, revenue, cost, frequency, or team size.",
        "Recruiters usually trust quantified bullets faster because they can compare them against stronger candidates more easily.",
      ],
    },
    "action-verb-use": {
      title: "Analysis",
      summary:
        actionVerbIssueLines.length > 0
          ? `I found ${actionVerbIssueLines.length} bullet${actionVerbIssueLines.length === 1 ? "" : "s"} with weak action wording.`
          : "I did not find obvious weak action wording in the experience and project bullets I checked, but this score also reflects how consistently bullets open with strong action verbs.",
      bullets:
        actionVerbIssueLines.length > 0
          ? actionVerbIssueLines.map((issue) => ({
              label: issue.line,
              tone: "danger" as const,
            }))
          : [
              "I am not seeing obvious weak action verbs from the tracked replacement list, which is a strong sign.",
              `${actionVerbMetrics.strongLeadCount} of ${actionVerbMetrics.totalBullets} checked bullets start with a tracked strong action verb.`,
            ],
      highlights: [
        {
          label: "Strong Opens",
          value: `${actionVerbMetrics.strongLeadCount}/${actionVerbMetrics.totalBullets}`,
          tone: "success" as const,
        },
        {
          label: "Weak",
          value: `${actionVerbIssueLines.length}`,
          tone: "danger" as const,
        },
        ...makeHighlights(
          actionVerbMetrics.phraseCounts.map((entry): [string, number] => [
            String(entry.phrase),
            entry.count,
          ]),
          ""
        )
          .slice(0, 4)
          .map((item) => ({ ...item, tone: "danger" as const })),
      ],
      details: [
        actionVerbMetrics.weakLeadCount > 0
          ? `${actionVerbMetrics.weakLeadCount} bullet opening${actionVerbMetrics.weakLeadCount === 1 ? "" : "s"} start with weak action wording, which hurts the score more than mid-line phrasing issues.`
          : "I am not seeing weak bullet openings, which is the most important signal in this section.",
        actionVerbMetrics.weakPhraseCount > 0
          ? `${actionVerbMetrics.weakPhraseCount} additional weak phrase${actionVerbMetrics.weakPhraseCount === 1 ? "" : "s"} appear later in bullets and soften ownership.`
          : "I am not seeing extra weak action phrasing later in the bullets.",
        actionVerbMetrics.phraseCounts.length > 0
          ? `Most frequent weak phrases: ${actionVerbMetrics.phraseCounts
              .slice(0, 4)
              .map((item) => `${item.phrase} (${item.count})`)
              .join(", ")}.`
          : "No repeated weak action phrases were detected.",
        `Strong lead-verb coverage is ${Math.round(actionVerbMetrics.strongLeadRatio * 100)}% across the bullets I checked.`,
        "The fastest improvement is usually to replace the first 1 to 3 words of each flagged bullet with the exact action you drove.",
        {
          label:
            actionVerbIssueLines.length > 0
              ? "Go to Action Verbs to find stronger replacements for the weak verbs I found."
              : "Go to Action Verbs to browse stronger verbs before you refine more bullets.",
          targetSection: "action-verbs",
        },
      ],
    },
    accomplishments: {
      title: "Analysis",
      summary:
        accomplishmentMetrics.issues.length > 0
          ? `I found ${accomplishmentMetrics.issues.length} bullet${accomplishmentMetrics.issues.length === 1 ? "" : "s"} using responsibility-oriented language.`
          : "I did not find responsibility-oriented wording in the bullets I checked.",
      bullets:
        accomplishmentMetrics.issues.length > 0
          ? accomplishmentMetrics.issues.map((issue) => ({
              label: issue.line,
              tone: "danger" as const,
            }))
          : [
              "No responsibility-oriented language found in the bullets I checked.",
            ],
      highlights: [
        {
          label: "Accomplishment-like",
          value: `${accomplishmentMetrics.accomplishmentLikeCount}`,
          tone: "success" as const,
        },
        {
          label: "Responsibility-oriented",
          value: `${accomplishmentMetrics.issues.length}`,
          tone: "danger" as const,
        },
        ...makeHighlights(
          accomplishmentMetrics.phraseCounts.map((entry): [string, number] => [
            String(entry.phrase),
            entry.count,
          ]),
          ""
        )
          .slice(0, 4)
          .map((item) => ({ ...item, tone: "danger" as const })),
      ],
      details: [
        accomplishmentMetrics.issues.length > 0
          ? `${accomplishmentMetrics.issues.length} bullet${accomplishmentMetrics.issues.length === 1 ? "" : "s"} still read more like assigned duties than outcomes.`
          : "I am not seeing duty-style wording in the bullets I checked.",
        `Accomplishment-like coverage is ${Math.round(
          accomplishmentMetrics.accomplishmentRatio * 100
        )}% across the bullets I checked.`,
        accomplishmentMetrics.phraseCounts.length > 0
          ? `Most frequent responsibility-oriented phrases: ${accomplishmentMetrics.phraseCounts
              .slice(0, 4)
              .map((item) => `${item.phrase} (${item.count})`)
              .join(", ")}.`
          : "No repeated responsibility-oriented phrases were detected.",
        "The strongest fix is to replace duty wording with the action taken and the result it produced.",
      ],
    },
    repetition: {
      title: "Analysis",
      summary: repetitionPanel
        ? "I am focusing this section strictly on repeated action verbs plus repeated phrase patterns, using NLP normalization so stem-level repeats are caught more reliably."
        : "I am focusing this section strictly on repeated action verbs. Technical skills, domain terms, and generic non-action wording are intentionally excluded so the signal stays useful.",
      bullets:
        (repetitionPanel?.repeatedLeadVerbs.length ??
          repetitionHighlights.length) > 0
          ? [
              "The highlighted pills above are the repeated action verbs most worth rewriting first.",
              repetitionPanel && repetitionPanel.repeatedPhrases.length > 0
                ? `I also found repeated phrase patterns such as ${repetitionPanel.repeatedPhrases
                    .slice(0, 2)
                    .map((item) => `"${item.phrase}"`)
                    .join(", ")}.`
                : "Technical skills, frameworks, domain terms, and generic non-action words are filtered out here.",
            ]
          : [
              "I am not seeing heavy repetition in action verbs once skills and domain vocabulary are excluded.",
            ],
      highlights: makeHighlights(
        (repetitionPanel?.repeatedLeadVerbs ?? repetitionHighlights).map(
          (item) => [
            "verb" in item ? item.verb : item[0],
            "count" in item ? item.count : item[1],
          ]
        )
      ).map((item) => ({
        ...item,
        tone: "danger" as const,
      })),
      details: [
        "Not all repetition is bad. Repeating critical technical keywords can help ATS matching.",
        "The part that usually hurts is recycled action-verb choice across bullets that should feel distinct.",
        `I found ${repetitionPanel?.repeatedLeadVerbs.length ?? repetitionHighlights.length} repeated verb-pattern ${(repetitionPanel?.repeatedLeadVerbs.length ?? repetitionHighlights.length) === 1 ? "issue" : "issues"} worth reviewing after excluding skills and domain terms.`,
        {
          label:
            (repetitionPanel?.repeatedLeadVerbs.length ??
              repetitionHighlights.length) > 0
              ? "Go to Action Verbs to find stronger alternatives for the repeated wording."
              : "Go to Action Verbs if you want stronger wording alternatives while refining bullets.",
          targetSection: "action-verbs",
        },
      ],
    },
    length: {
      title: "Analysis",
      summary:
        lengthMetrics.assessment === "optimal"
          ? `Your CV has ${lengthMetrics.wordCount} words and an estimated ${lengthMetrics.estimatedPages} page${lengthMetrics.estimatedPages === 1 ? "" : "s"}, which sits in a strong length range.`
          : lengthMetrics.assessment === "good"
            ? `Your CV has ${lengthMetrics.wordCount} words and an estimated ${lengthMetrics.estimatedPages} page${lengthMetrics.estimatedPages === 1 ? "" : "s"}. It is slightly compact but still in a workable range.`
            : lengthMetrics.assessment === "slightly-short"
              ? `Your CV has ${lengthMetrics.wordCount} words and an estimated ${lengthMetrics.estimatedPages} page. It looks a bit short for a strong evidence-driven resume.`
              : lengthMetrics.assessment === "slightly-long"
                ? `Your CV has ${lengthMetrics.wordCount} words and an estimated ${lengthMetrics.estimatedPages} pages. It is starting to run long for fast recruiter scanning.`
                : lengthMetrics.assessment === "too-short"
                  ? `Your CV has ${lengthMetrics.wordCount} words and reads too short to carry enough evidence.`
                  : `Your CV has ${lengthMetrics.wordCount} words and an estimated ${lengthMetrics.estimatedPages} pages, which is longer than the strongest scanning range.`,
      bullets: [
        lengthMetrics.assessment === "optimal"
          ? "Optimal length."
          : lengthMetrics.assessment === "good"
            ? "Length is still acceptable, but there is less room for evidence depth."
            : lengthMetrics.assessment === "slightly-short"
              ? "The document may not be carrying enough proof from recent roles."
              : lengthMetrics.assessment === "slightly-long"
                ? "The document is dense enough that stronger bullets may start losing visibility."
                : lengthMetrics.assessment === "too-short"
                  ? "The document is too short to present enough role-relevant evidence."
                  : "The document is too long for efficient recruiter scanning.",
      ],
      highlights: [
        {
          label: "Words",
          value: `${lengthMetrics.wordCount}`,
        },
        {
          label: "Pages",
          value: `${lengthMetrics.estimatedPages}`,
        },
      ],
      details: [
        "This score is driven mainly by total word count, estimated page count, and whether the document is getting too dense to scan quickly.",
        "A strong ATS-friendly CV usually lands in a 1 to 2 page range, which is roughly 450 to 900 words for this estimator.",
        `Estimated page range: ${lengthMetrics.recommendedPageRange}. Current estimate: ${lengthMetrics.estimatedPages}.`,
        `Non-empty lines: ${lengthMetrics.lineCount}. Average bullet length is about ${averageBulletLength} words.`,
        lengthMetrics.lineCount > 80
          ? `The resume also has ${lengthMetrics.lineCount} non-empty lines, which adds visible density even before a recruiter reads the bullets.`
          : "The line density still looks manageable for recruiter scanning.",
      ],
    },
    "filler-words": {
      title: "Analysis",
      summary:
        fillerWordMetrics.issues.length > 0
          ? `I found ${fillerWordMetrics.issues.length} low-signal phrase issue${fillerWordMetrics.issues.length === 1 ? "" : "s"} in bullets or summary lines.`
          : "I did not find obvious low-signal filler phrasing in the summary or achievement bullets.",
      bullets:
        fillerWordMetrics.issues.length > 0
          ? fillerWordMetrics.issues.slice(0, 4).map((issue) => ({
              label: issue.line,
              tone: "danger" as const,
            }))
          : [
              "I am not seeing obvious filler-language issues in the current text.",
            ],
      highlights: fillerWordMetrics.phraseCounts.slice(0, 6).map((item) => ({
        label: item.phrase,
        value: `${item.count}x`,
        tone: "danger" as const,
      })),
      details: [
        "This check focuses on weak ownership language and vague modifiers that reduce ATS-visible specificity.",
        "Scanner-style resume review tools usually penalize these phrases indirectly because they lower action clarity and keyword precision.",
        ...fillerWordMetrics.issues
          .slice(0, 6)
          .map((issue) => `${issue.line} - ${issue.reason}`),
      ],
    },
    "total-bullet-points": {
      title: "Analysis",
      summary:
        experienceBulletCount > 0
          ? `I counted ${experienceBulletCount} bullet${experienceBulletCount === 1 ? "" : "s"} in Work Experience.`
          : `I could not detect experience bullets reliably, so this fallback is using ${bullets.length} bullet-style lines across the resume.`,
      bullets: [
        (experienceBulletCount > 0 ? experienceBulletCount : bullets.length) < 8
          ? "The experience bullet count looks light, so recent roles may not have enough evidence."
          : (experienceBulletCount > 0
                ? experienceBulletCount
                : bullets.length) > 24
            ? "The experience bullet count is high, which can make the resume harder to skim."
            : "The bullet count sits in a workable range for scanability.",
        `Your quantified experience-bullet count is ${quantifiedBullets.length}, which helps indicate how much of that volume is actually carrying proof.`,
        ...oversizedOtherSections
          .slice(0, 1)
          .map(
            (entry) =>
              `${formatSectionName(entry.section)} also has ${entry.bulletCount} bullets. That is not part of the score, but it is worth a quick review.`
          ),
      ],
      details: [
        "This score is driven mainly by bullet count in Work Experience.",
        "Too few experience bullets can make the resume feel thin. Too many can flatten the best evidence.",
        "Other sections are tracked only for unusually large bullet lists and surface as a warning, not as the main score driver.",
      ],
    },
    "bullet-points-length": {
      title: "Analysis",
      summary: bulletLengthPanel
        ? `Your bullets average ${bulletLengthPanel.averageWords} words each.`
        : `Your bullets average ${averageBulletLength} words each.`,
      bullets: (() => {
        const tooShortCount =
          bulletLengthPanel?.tooShortCount ??
          bullets.filter((bullet) => toWords(bullet).length < 10).length
        const tooLongCount =
          bulletLengthPanel?.tooLongCount ??
          bullets.filter((bullet) => toWords(bullet).length > 28).length
        const issueExamples =
          bulletLengthPanel?.bullets
            .filter((item) => item.classification !== "good")
            .map((item) =>
              item.classification === "long"
                ? {
                    label: `Long bullet to trim: ${item.bullet}`,
                    tone: "danger" as const,
                  }
                : {
                    label: `Short bullet to strengthen: ${item.bullet}`,
                    tone: "danger" as const,
                  }
            ) ??
          bullets
            .filter((bullet) => toWords(bullet).length > 28)
            .map((bullet) => ({
              label: `Long bullet to trim: ${bullet}`,
              tone: "danger" as const,
            }))

        return [
          ...(tooShortCount > 0
            ? [
                `${tooShortCount} ${
                  tooShortCount === 1 ? "bullet is" : "bullets are"
                } probably too short.`,
              ]
            : []),
          ...(tooLongCount > 0
            ? [
                `${tooLongCount} ${
                  tooLongCount === 1 ? "bullet is" : "bullets are"
                } probably too long.`,
              ]
            : []),
          ...sample(issueExamples, 2),
        ]
      })(),
      details: [
        "Very short bullets usually lack proof. Very long bullets usually hide the main claim.",
        "The best bullet length is the shortest version that still preserves context and result.",
        ...(bulletLengthPanel
          ? [
              `${bulletLengthPanel.goodLengthCount} bullets currently sit in a good ATS scanning range.`,
              "This section now looks at more than raw word count. It also checks information density, keyword presence, technical entities, and whether the extra length is justified.",
              "Scoring strategy: bullets lose points when they are too short and low on ATS signals, or too long without enough dense proof to justify the length.",
              "Scoring strategy: bullets keep a strong score when they are compact but still carry tools, keywords, entities, and visible result language.",
            ]
          : []),
      ],
    },
    sections: {
      title: "Analysis",
      summary:
        sectionMetrics.issues.length > 0
          ? `I found ${sectionMetrics.issues.length} section-structure issue${sectionMetrics.issues.length === 1 ? "" : "s"}.`
          : "I did not find any obvious section-structure issues.",
      bullets:
        sectionMetrics.issues.length > 0
          ? sectionMetrics.issues.slice(0, 4).map((issue) => ({
              label: issue.label,
              tone: "danger" as const,
            }))
          : ["Core ATS sections are present and ordered reasonably well."],
      highlights:
        sectionMetrics.issues.length > 0
          ? Array.from(
              new Set(
                sectionMetrics.issues.map((issue) =>
                  issue.category === "missing-required"
                    ? "Missing Required"
                    : issue.category === "missing-optional"
                      ? "Missing Optional"
                      : "Order"
                )
              )
            ).map((category) => ({
              label: category,
              value: "",
              tone: "danger" as const,
            }))
          : [],
      details: [
        ...(sectionMetrics.presentSections.length > 0
          ? [`Detected sections: ${sectionMetrics.presentSections.join(", ")}.`]
          : []),
        ...sectionMetrics.issues.map((issue) => issue.detail),
      ],
    },
    "personal-pronouns": {
      title: "Analysis",
      summary:
        "I checked for first-person language that can make the resume sound less polished.",
      bullets:
        pronounHits.length > 0
          ? [
              "The highlighted pills above are the personal pronouns most worth removing first.",
            ]
          : ["I am not seeing visible first-person pronouns in the main text."],
      highlights: pronounHits.map((item) => ({
        label: item.label,
        value: `${item.count}`,
        tone: "danger" as const,
      })),
      details: [
        ...(pronounHits.length > 0
          ? pronounHits.map(
              (item) => `${item.label} appears ${item.count} times.`
            )
          : []),
        "Pronouns are not usually fatal, but they do make the document feel less polished than a standard resume.",
        "Action verbs usually do the same job with a cleaner tone.",
      ],
    },
    "buzzwords-cliches": {
      title: "Analysis",
      summary: buzzwordPanel
        ? "I looked for repeated weak phrase families and semantic variants, not just exact buzzword matches."
        : "I looked for generic self-marketing language that can feel interchangeable.",
      bullets: buzzwordPanel
        ? buzzwordPanel.repeatedBuzzwords.length > 0
          ? [
              "The highlighted pills above are the weak phrases most worth rewriting first.",
            ]
          : [
              "I am not seeing obvious buzzword families or repeated weak phrase variants.",
            ]
        : buzzwordHits.length > 0
          ? buzzwordHits.map(
              (item) => `${item.label} appears ${item.count} times.`
            )
          : ["I am not seeing obvious resume cliches from the standard list."],
      highlights: buzzwordPanel
        ? buzzwordPanel.repeatedBuzzwords.slice(0, 6).map((item) => ({
            label: item.phrase,
            value: `${item.count}`,
            tone: "danger" as const,
          }))
        : buzzwordHits.map((item) => ({
            label: item.label,
            value: `${item.count}`,
          })),
      details: [
        "Cliches hurt most when they take the place of specifics that could have been used instead.",
        "The more senior the role, the less tolerance recruiters usually have for generic branding language.",
        ...(hasJobDescription && missingTerms.length > 0
          ? [
              `Your job-match analysis still shows missing role terms such as ${missingTerms
                .slice(0, 5)
                .join(", ")}.`,
            ]
          : []),
      ],
    },
    "active-voice": {
      title: "Analysis",
      summary:
        activeVoiceMetrics.issues.length > 0
          ? `I found ${activeVoiceMetrics.issues.length} line${activeVoiceMetrics.issues.length === 1 ? "" : "s"} that read in passive voice.`
          : "I did not find any lines that clearly read in passive voice.",
      bullets:
        activeVoiceMetrics.issues.length > 0
          ? activeVoiceMetrics.issues.slice(0, 4).map((issue) => ({
              label: issue.line,
              tone: "danger" as const,
            }))
          : ["Most bullets currently read in active voice."],
      highlights:
        activeVoiceMetrics.issues.length > 0
          ? [
              {
                label: "Passive lines",
                value: `${activeVoiceMetrics.issues.length}`,
                tone: "danger" as const,
              },
            ]
          : [],
      details: [
        ...activeVoiceMetrics.issues.map(
          (issue) => `${issue.line} - ${issue.reason}`
        ),
      ],
    },
    consistency: {
      title: "Analysis",
      summary:
        consistencyMetrics.issues.length > 0
          ? `I found ${consistencyMetrics.issues.length} formatting or chronology inconsistency${consistencyMetrics.issues.length === 1 ? "" : "ies"}.`
          : "I did not find any obvious formatting or chronology inconsistencies.",
      bullets:
        consistencyMetrics.issues.length > 0
          ? consistencyMetrics.issues.slice(0, 4).map((issue) => ({
              label: issue.label,
              tone: "danger" as const,
            }))
          : ["Formatting, bullet style, and dates look consistent."],
      highlights:
        consistencyMetrics.issues.length > 0
          ? Array.from(
              new Set(
                consistencyMetrics.issues.map((issue) =>
                  formatConsistencyCategory(issue.category)
                )
              )
            )
              .slice(0, 4)
              .map((category) => ({
                label: category,
                value: "",
                tone: "danger" as const,
              }))
          : [],
      details: [...consistencyMetrics.issues.map((issue) => issue.detail)],
    },
    "date-order": {
      title: "Analysis",
      summary:
        "I checked two things here: whether your date formats stay consistent, and whether dated entries remain in reverse chronology within each section.",
      bullets: [
        dateMetrics.formatTypes.length > 1
          ? `I found ${dateMetrics.formatTypes.length} different date formats, which weakens consistency.`
          : "Your date format looks consistent across the dated lines I detected.",
        dateMetrics.chronologyIssues.length > 0
          ? `I found ${dateMetrics.chronologyIssues.length} chronology issue${dateMetrics.chronologyIssues.length === 1 ? "" : "s"} where a more recent entry appears below an older one.`
          : "The dated sections I checked appear to stay in reverse chronology.",
      ],
      highlights: [
        ...(dateMetrics.formatTypes.length > 1
          ? dateMetrics.formatTypes.map((type) => ({
              label: type.replaceAll("_", " "),
              value: "format",
              tone: "danger" as const,
            }))
          : []),
        ...dateMetrics.chronologyIssues.slice(0, 4).map((issue) => ({
          label: issue.section,
          value: "order",
          tone: "danger" as const,
        })),
      ],
      details: [
        "Chronology problems slow recruiters down because they have to reconstruct the timeline manually.",
        "The standard expectation is reverse-chronological ordering with one stable date format.",
        ...dateMetrics.chronologyIssues
          .slice(0, 3)
          .map(
            (issue) =>
              `${issue.section}: "${issue.currentLine}" appears below "${issue.previousLine}" even though it looks more recent.`
          ),
      ],
    },
    "spell-check": {
      title: "Analysis",
      summary:
        "Please review the spellings below and confirm whether any are incorrect.",
      bullets:
        spellMetrics.issues.length > 0
          ? spellMetrics.issues.slice(0, 6).map((issue) => ({
              label:
                "correct" in issue
                  ? `Replace "${issue.wrong}" -> "${issue.correct}"`
                  : `Check "${issue.word}"${
                      issue.suggestions.length > 0
                        ? ` -> ${issue.suggestions.join(", ")}`
                        : ""
                    }`,
              tone: "danger" as const,
            }))
          : [
              runtimeSpellMetrics
                ? "I did not catch any obvious misspellings from the runtime spell checker."
                : "I did not catch any obvious resume misspellings from the current deterministic list.",
            ],
      highlights: spellMetrics.issues.slice(0, 6).map((issue) => ({
        label: "wrong" in issue ? issue.wrong : issue.word,
        value: `${issue.count}`,
        tone: "danger" as const,
      })),
      details: [],
    },
  }

  const feedbackBySection: Record<ATSPanelSectionId, string[]> = {
    "sample-cv-lines": [
      "Keep the strongest quantified line near the top of the most recent role.",
      "Trim setup words so each line reaches the result faster.",
      "If a line sounds generic, anchor it with scale, ownership, or outcome.",
    ],
    "action-verbs": [
      "Rotate repeated lead verbs across adjacent bullets.",
      "Prefer direct verbs like built, led, launched, improved, or reduced when they are true.",
      "Replace softer openings like helped or worked on with the actual ownership verb.",
    ],
    "job-match": [
      "Move the highest-value missing role terms into the summary, skills, and latest relevant bullets.",
      "Prefer role-specific language from the job description when it is honestly supported by your experience.",
      "Improve section coverage before adding more terms, because distribution matters as much as raw overlap.",
    ],
    "quantifying-impact": [
      "Add metrics to the bullets that already sound strong but still lack proof.",
      "Use percentage, time, revenue, cost, scale, or reliability where it is honest.",
      "Make sure at least the top bullets in your latest role are quantified.",
    ],
    "action-verb-use": [
      "Use verbs that show ownership before collaboration or support.",
      "Avoid repeating the same opener more than twice in a section.",
      "If a bullet starts vaguely, rewrite the first 3 to 5 words first.",
    ],
    accomplishments: [
      "Turn task-based bullets into result-based bullets by adding what changed.",
      "Where possible, connect work to business, customer, or team outcomes.",
      "Lead with the outcome or strongest action when the bullet feels flat.",
    ],
    repetition: [
      "Keep technical keyword repetition where it helps ATS, but vary the surrounding language.",
      "Rewrite the most repeated verbs first because recruiters notice those fastest.",
      "If a word appears 3 or more times without adding precision, swap it out.",
    ],
    length: [
      "Trim lower-value detail before cutting the strongest quantified bullets.",
      "Keep the summary tight and let the experience section carry the proof.",
      "If a section feels dense, reduce lines before reducing evidence quality.",
    ],
    "filler-words": [
      "Replace vague phrases with specific tools, scope, or measurable outputs.",
      "Cut every filler phrase that can be removed without changing meaning.",
      "When in doubt, choose a noun plus result over a soft qualifier.",
    ],
    "total-bullet-points": [
      "Keep enough bullets to prove relevance, but not so many that they blur together.",
      "Prioritize recent and relevant roles when deciding where bullets should stay.",
      "Trim duplicate bullets before trimming high-impact bullets.",
    ],
    "bullet-points-length": [
      "Expand the short bullets that currently sound generic or incomplete.",
      "Trim the long bullets until each one carries only one main story.",
      "Aim for bullets that can be scanned in one breath.",
    ],
    sections: [
      "Use standard section names before trying creative labels.",
      "Make sure Summary, Experience, Skills, and Education are easy to find immediately.",
      "If a section is weak, fix the content after the structure is clear.",
    ],
    "personal-pronouns": [
      "Drop I, my, and we from bullet lines unless a sentence really needs them.",
      "Let the action verb imply ownership instead of spelling it out.",
      "If the summary sounds conversational, tighten it into resume language.",
    ],
    "buzzwords-cliches": [
      "Replace every cliche with evidence or remove it entirely.",
      "If a phrase can apply to anyone, it is probably not helping.",
      "Use outcomes, tools, and scope to build credibility instead of labels.",
    ],
    "active-voice": [
      "Rewrite passive bullets so they start with the action you took.",
      "Put the subject of the achievement up front, even when implied.",
      "If a bullet sounds like narration, make it sound like delivery instead.",
    ],
    consistency: [
      "Pick one bullet style, one tense pattern, and one punctuation style, then hold it.",
      "Align date formatting before fine-tuning design details.",
      "Use the same level of specificity across similar roles.",
    ],
    "date-order": [
      "Keep the most recent role and education entries first.",
      "Use one date format across the full resume.",
      "Double-check date ranges anywhere the chronology feels easy to question.",
    ],
    "spell-check": [
      "Fix every obvious misspelling before making higher-level wording changes.",
      "Re-run a spelling pass after each heavy edit because errors often get reintroduced.",
      "Pay extra attention to headings, role titles, and technology names.",
    ],
  }

  const feedbackBullets = feedbackBySection[sectionId]
  const hideDetailsForSpellCheck = sectionId === "spell-check"
  const weakMetricCount =
    scoreData.evidenceSummary?.advancedSignals?.credibility?.weakMetrics ?? null
  const strongMetricCount =
    scoreData.evidenceSummary?.advancedSignals?.credibility?.strongMetrics ??
    null
  const tooShortBullets =
    bulletLengthPanel?.tooShortCount ??
    bullets.filter((bullet) => toWords(bullet).length < 10).length
  const tooLongBullets =
    bulletLengthPanel?.tooLongCount ??
    bullets.filter((bullet) => toWords(bullet).length > 28).length
  const repeatedVerbCount =
    repetitionPanel?.repeatedLeadVerbs.length ?? repetitionHighlights.length
  const repeatedBuzzwordCount =
    buzzwordPanel?.repeatedBuzzwords.length ?? buzzwordHits.length

  const dynamicFeedbackBySection: Record<ATSPanelSectionId, string[]> = {
    "sample-cv-lines": [
      contentLines.length >= 5
        ? "Promote the strongest quantified line from your latest role into the first 3 visible lines."
        : "Add at least 3 strong outcome lines so recruiters can evaluate impact quickly.",
      quantifiedBullets.length > 0
        ? `Reuse the pattern from your quantified bullets (${quantifiedBullets.length} found): action + scope + result.`
        : "Add concrete scale, time, or outcome to at least one top line so it reads as evidence.",
    ],
    "action-verbs": [
      repeatedLeadVerbs.length > 0
        ? `Replace the most repeated lead verbs first (${repeatedLeadVerbs
            .slice(0, 2)
            .map(([verb]) => verb)
            .join(", ")}).`
        : "Keep rotating lead verbs across adjacent bullets to maintain scan variety.",
      actionVerbMetrics.weakLeadCount > 0
        ? `Rewrite ${actionVerbMetrics.weakLeadCount} weak openings with direct ownership verbs.`
        : "Lead-verb strength looks good; preserve this while tightening weaker bullets.",
    ],
    "job-match": hasJobDescription
      ? [
          missingTerms.length > 0
            ? `Add the top missing terms to summary, skills, and recent bullets: ${missingTerms
                .slice(0, 4)
                .join(", ")}.`
            : "Keyword coverage is strong; keep terms distributed naturally across core sections.",
          hasTargetMyCVScore && (scoreData.targetRoleScore ?? 0) < 80
            ? `Raise Target My CV from ${scoreData.targetRoleScore ?? 0} by adding evidence-backed terms in experience bullets, not only in skills.`
            : "Maintain term-to-evidence alignment so coverage stays credible for ATS and recruiter review.",
        ]
      : [
          "Add a job description to generate role-specific keyword and relevance feedback.",
        ],
    "quantifying-impact": [
      impactPanel
        ? impactPanel.quantifiedBullets < impactPanel.totalBullets
          ? `Quantified coverage is ${impactPanel.quantifiedBullets}/${impactPanel.totalBullets}. Quantify ${Math.max(1, Math.min(3, impactPanel.totalBullets - impactPanel.quantifiedBullets))} more high-visibility bullets in your latest role.`
          : `Quantified coverage is ${impactPanel.quantifiedBullets}/${impactPanel.totalBullets}. Focus next on metric specificity (baseline -> outcome).`
        : unquantifiedBullets.length > 0
          ? `Add measurable outcomes to ${Math.min(3, unquantifiedBullets.length)} unquantified bullets first.`
          : "Impact quantification looks healthy; preserve this density when editing.",
      weakMetricCount !== null && strongMetricCount !== null
        ? weakMetricCount > strongMetricCount
          ? `Metric quality is weak-heavy (${weakMetricCount} weak vs ${strongMetricCount} strong). Upgrade weak metrics to include baseline, delta, and scope.`
          : `Metric quality is balanced (${strongMetricCount} strong vs ${weakMetricCount} weak). Keep using specific baseline -> outcome evidence.`
        : impactPanel?.responsibilityLikeBullets
          ? `${impactPanel.responsibilityLikeBullets} bullets still read like responsibilities, so rewrite them as outcome statements.`
          : "Most bullets already read outcome-oriented.",
    ],
    "action-verb-use": [
      actionVerbIssueLines.length > 0
        ? `Fix the ${Math.min(actionVerbIssueLines.length, 3)} weakest bullet openings first to lift this score fastest.`
        : "Action-verb quality is stable; keep openings precise and ownership-first.",
      actionVerbMetrics.strongLeadRatio < 0.65
        ? `Increase strong lead openings (currently ${Math.round(actionVerbMetrics.strongLeadRatio * 100)}%) in recent experience bullets.`
        : `Strong lead-verb coverage is ${Math.round(actionVerbMetrics.strongLeadRatio * 100)}%; maintain this consistency.`,
    ],
    accomplishments: [
      accomplishmentMetrics.issues.length > 0
        ? `Convert ${Math.min(accomplishmentMetrics.issues.length, 3)} duty-style bullets into result-focused bullets.`
        : "Accomplishment orientation is strong; retain action + business outcome framing.",
      accomplishmentMetrics.accomplishmentRatio < 0.5
        ? `Increase accomplishment-style coverage above 50% (currently ${Math.round(
            accomplishmentMetrics.accomplishmentRatio * 100
          )}%).`
        : `Accomplishment-style coverage is ${Math.round(
            accomplishmentMetrics.accomplishmentRatio * 100
          )}%; keep this standard.`,
    ],
    repetition: [
      repeatedVerbCount > 0
        ? `Rewrite repeated action verbs (${repeatedVerbCount} pattern${repeatedVerbCount === 1 ? "" : "s"}) before touching minor wording.`
        : "Action-verb repetition is controlled; keep technical keyword repetition intentional.",
      repetitionPanel?.repeatedPhrases.length
        ? `Reduce repeated phrase patterns such as "${repetitionPanel.repeatedPhrases[0]?.phrase}".`
        : "Phrase-level repetition looks acceptable.",
    ],
    length: [
      lengthMetrics.assessment === "too-long" ||
      lengthMetrics.assessment === "slightly-long"
        ? "Trim lower-value bullets from older roles before editing high-impact recent bullets."
        : lengthMetrics.assessment === "too-short" ||
            lengthMetrics.assessment === "slightly-short"
          ? "Add missing evidence in recent roles before adding stylistic polish."
          : "Overall length is in a workable range; focus on evidence quality over resizing.",
      `Current footprint: ${lengthMetrics.wordCount} words across ~${lengthMetrics.estimatedPages} page${lengthMetrics.estimatedPages === 1 ? "" : "s"}.`,
    ],
    "filler-words": [
      fillerWordMetrics.issues.length > 0
        ? `Rewrite ${Math.min(3, fillerWordMetrics.issues.length)} low-signal lines by replacing vague phrases with tools, scope, or outcomes.`
        : "Low-signal filler language is limited; keep wording specific and concrete.",
      fillerWordMetrics.phraseCounts.length > 0
        ? `Start with the most repeated filler phrase: "${fillerWordMetrics.phraseCounts[0]?.phrase}".`
        : "No frequent filler phrase clusters detected.",
    ],
    "total-bullet-points": [
      experienceBulletCount > 24
        ? `Work Experience has ${experienceBulletCount} bullets. Consolidate overlapping points to improve scan speed.`
        : experienceBulletCount > 0 && experienceBulletCount < 8
          ? `Work Experience has ${experienceBulletCount} bullets. Add more role-relevant evidence to avoid looking under-detailed.`
          : "Bullet volume in Work Experience is in a healthy scan range.",
      quantifiedBullets.length > 0
        ? `Prioritize keeping quantified bullets (${quantifiedBullets.length}) when trimming.`
        : "When adding bullets, include at least one measurable outcome per recent role.",
    ],
    "bullet-points-length": [
      tooLongBullets > 0
        ? `Trim ${Math.min(3, tooLongBullets)} long bullets first; keep one idea per bullet.`
        : "Long-bullet risk is low.",
      tooShortBullets > 0
        ? `Expand ${Math.min(3, tooShortBullets)} short bullets with context + result so they carry enough evidence.`
        : "Short-bullet risk is low.",
    ],
    sections: [
      sectionMetrics.issues.length > 0
        ? `Resolve section structure issues first (${sectionMetrics.issues.length} detected), starting with missing required headers.`
        : "Section structure is ATS-safe; keep standard headings and current order.",
      sectionMetrics.presentSections.length > 0
        ? `Detected sections: ${sectionMetrics.presentSections.join(", ")}.`
        : "Use standard sections: Summary, Experience, Skills, Education.",
    ],
    "personal-pronouns": [
      pronounHits.length > 0
        ? `Remove first-person pronouns (${pronounHits.reduce((sum, item) => sum + item.count, 0)} instances) from bullets and summary lines.`
        : "Pronoun usage is clean; maintain implied ownership through action verbs.",
      "Keep resume tone concise and achievement-focused rather than conversational.",
    ],
    "buzzwords-cliches": [
      repeatedBuzzwordCount > 0
        ? `Replace repeated buzzwords/cliches (${repeatedBuzzwordCount} signal${repeatedBuzzwordCount === 1 ? "" : "s"}) with concrete evidence.`
        : "Buzzword risk is low; keep language evidence-first.",
      hasJobDescription && missingTerms.length > 0
        ? "Where possible, swap generic descriptors for missing role-specific terms backed by experience."
        : "Prefer tools, scope, and outcomes over self-description phrases.",
    ],
    "active-voice": [
      activeVoiceMetrics.issues.length > 0
        ? `Rewrite ${Math.min(activeVoiceMetrics.issues.length, 3)} passive lines into direct action-result phrasing.`
        : "Active voice usage is strong; preserve this style across all bullets.",
      "Start flagged bullets with the action you drove.",
    ],
    consistency: [
      consistencyMetrics.issues.length > 0
        ? `Fix consistency issues first (${consistencyMetrics.issues.length} found), especially date and punctuation drift.`
        : "Consistency is strong across style, punctuation, and chronology signals.",
      consistencyMetrics.issues.find(
        (issue) => issue.category === "punctuation"
      )
        ? "Use one bullet-ending punctuation style across all bullet lists."
        : "Keep the same tense and formatting pattern across similar roles.",
    ],
    "date-order": [
      dateMetrics.formatTypes.length > 1
        ? `Standardize to one date format (currently ${dateMetrics.formatTypes.length} formats detected).`
        : "Date format consistency looks good; keep using a single format.",
      dateMetrics.chronologyIssues.length > 0
        ? `Reorder ${Math.min(dateMetrics.chronologyIssues.length, 3)} chronology issue${dateMetrics.chronologyIssues.length === 1 ? "" : "s"} to maintain reverse order.`
        : "Chronology order appears stable.",
    ],
    "spell-check": [
      spellMetrics.issues.length > 0
        ? `Fix ${Math.min(spellMetrics.issues.length, 6)} flagged spelling issues before wording refinements.`
        : "No obvious spelling issues found in the current pass.",
      "Prioritize corrections in headings, job titles, and skill names.",
    ],
  }

  const dynamicFeedbackBullets = dynamicFeedbackBySection[sectionId]
  const hasDynamicFeedback = dynamicFeedbackBullets.length > 0
  const quantCoverageNumerator = impactPanel
    ? impactPanel.quantifiedBullets
    : quantifiedBullets.length
  const quantCoverageDenominator = impactPanel
    ? impactPanel.totalBullets
    : quantifiedBullets.length + unquantifiedBullets.length
  const quantifyingImpactHighlights =
    sectionId === "quantifying-impact"
      ? [
          {
            label: "Quantified",
            value:
              quantCoverageDenominator > 0
                ? `${quantCoverageNumerator}/${quantCoverageDenominator}`
                : "0/0",
            tone:
              quantCoverageDenominator > 0 &&
              quantCoverageNumerator / quantCoverageDenominator >= 0.6
                ? ("success" as const)
                : ("danger" as const),
          },
          ...(strongMetricCount !== null && weakMetricCount !== null
            ? [
                {
                  label: "Strong metrics",
                  value: `${strongMetricCount}`,
                  tone:
                    strongMetricCount >= weakMetricCount
                      ? ("success" as const)
                      : ("default" as const),
                },
                {
                  label: "Weak metrics",
                  value: `${weakMetricCount}`,
                  tone:
                    weakMetricCount > 0
                      ? ("danger" as const)
                      : ("default" as const),
                },
              ]
            : []),
          ...(impactPanel && impactPanel.responsibilityLikeBullets > 0
            ? [
                {
                  label: "Responsibility-like",
                  value: `${impactPanel.responsibilityLikeBullets}`,
                  tone: "danger" as const,
                },
              ]
            : []),
        ]
      : []
  const quantifyingImpactDetails =
    sectionId === "quantifying-impact"
      ? [
          ...(impactPanel
            ? [
                `Evidence: quantified bullets ${impactPanel.quantifiedBullets}/${impactPanel.totalBullets}; achievement-like ${impactPanel.achievementLikeBullets}; responsibility-like ${impactPanel.responsibilityLikeBullets}.`,
              ]
            : []),
          ...(weakMetricCount !== null && strongMetricCount !== null
            ? [
                `Metric quality: ${strongMetricCount} strong metrics, ${weakMetricCount} weak metrics.`,
              ]
            : []),
        ]
      : []

  return {
    title: base.title,
    description: base.description,
    analysis: analysisBySection[sectionId],
    recruiterInsights: {
      title: "Recruiter Insights",
      summary:
        "This is section-specific recruiter preference guidance. It explains what hiring teams typically expect to see here.",
      bullets: base.recruiter,
      details: hideDetailsForSpellCheck
        ? []
        : [
            "Use this as expectation context, then apply the Feedback panel to this resume's actual issues.",
          ],
    },
    feedback: {
      title: "Feedback",
      summary: hasDynamicFeedback
        ? "These section-specific actions are generated from your current resume signals and aligned to this section's score drivers."
        : "Use these focused section actions to improve score and clarity.",
      bullets: hasDynamicFeedback
        ? dynamicFeedbackBullets.map((item) => ({
            label: item,
            tone: /\b(strong|good|clean|healthy|stable|looks good|acceptable)\b/i.test(
              item
            )
              ? "default"
              : ("danger" as const),
          }))
        : feedbackBullets.map((item) => ({
            label: item,
            tone: "danger" as const,
          })),
      highlights: quantifyingImpactHighlights,
      details: hideDetailsForSpellCheck
        ? []
        : sectionId === "quantifying-impact"
          ? quantifyingImpactDetails
          : [
              "Feedback is section-scoped and evidence-driven from current deterministic/NLP checks.",
            ],
    },
  }
}

export function renderDeterministicATSSection(
  sectionId: ATSPanelSectionId,
  scoreData: ATSScoreResponse,
  resumeContent: string,
  jobDescription: string,
  nlpAnalysis?: ATSNLPAnalysis | null,
  runtimeSpellMetrics?: RuntimeSpellCheckMetrics | null,
  onSelectSection?: (sectionId: ATSPanelSectionId) => void
) {
  if (sectionId === "sample-cv-lines") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-semibold text-foreground">
            Sample CV Lines
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            These lines can give you inspiration when writing your own CV.
          </p>
        </div>

        <section className="rounded-[24px] border border-white/8 bg-black/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Experience Bullet Bank
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Each example follows the same pattern recruiters like to see:
            situation or context, the action you took, and the result it
            created. Use these as structural references, not as copy-paste
            content.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {SAMPLE_CV_LINE_LIBRARY.map((line) => (
              <div
                key={line}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-muted-foreground"
              >
                {line}
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (sectionId === "action-verbs") {
    return <ActionVerbDictionarySection />
  }

  if (sectionId === "quantifying-impact") {
    return (
      <QuantifyingImpactSection
        resumeContent={resumeContent}
        nlpAnalysis={nlpAnalysis}
      />
    )
  }

  if (sectionId === "job-match") {
    return (
      <JobMatchSection scoreData={scoreData} jobDescription={jobDescription} />
    )
  }

  const content = buildSectionContent(
    sectionId,
    scoreData,
    resumeContent,
    jobDescription,
    nlpAnalysis,
    runtimeSpellMetrics
  )

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">
          {content.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {content.description}
        </p>
      </div>

      <div className="space-y-4">
        {renderBlock(
          "Analysis",
          MessageSquare,
          content.analysis,
          onSelectSection
        )}
        {renderBlock("Feedback", Sparkles, content.feedback, onSelectSection)}
        {renderBlock(
          "Recruiter Insights",
          Lightbulb,
          content.recruiterInsights,
          onSelectSection
        )}
      </div>
    </div>
  )
}
