import {
  ACTION_VERB_DICTIONARY,
  WEAK_ACTION_VERB_DICTIONARY,
} from "@/lib/action-verb-dictionary"
import {
  NATURAL_STOPWORDS,
  buildNaturalCorpusDocuments,
  findNaturalTermEvidence,
  getNaturalNgramPhrases,
  getNaturalSimilarity,
  rankTermsByTfIdf,
  stemNaturalToken,
  tokenizeNaturalText,
} from "@/lib/ats-natural-language"
import type {
  ATSActionVerbAnalysis,
  ATSBulletLengthAnalysis,
  ATSBuzzwordAnalysis,
  ATSImpactAnalysis,
  ATSJobMatchAnalysis,
  ATSNLPAnalysis,
  ATSRepeatedPhrase,
  ATSRepeatedVerb,
} from "@/lib/ats-nlp-analysis-types"
import { extractBullets, parseResumeSections } from "@/lib/ats-resume-parsing"
import { BUZZWORD_FAMILIES } from "@/lib/buzzword-families"
import { REPETITION_STRONG_ACTION_VERBS } from "@/lib/repetition-exclusions"
const stopwords = new Set(NATURAL_STOPWORDS)
const strongActionVerbs = new Set([
  ...REPETITION_STRONG_ACTION_VERBS.map((verb) => verb.toLowerCase()),
  ...ACTION_VERB_DICTIONARY.map((entry) => entry.verb.toLowerCase()),
])
const knownTechnicalEntities = new Set([
  "sql",
  "python",
  "excel",
  "tableau",
  "power",
  "powerbi",
  "power-bi",
  "aws",
  "snowflake",
  "hadoop",
  "spark",
  "airflow",
  "etl",
  "api",
  "apis",
  "kpi",
  "kpis",
  "okr",
  "okrs",
  "crm",
  "erp",
  "salesforce",
  "looker",
  "bigquery",
  "postgresql",
  "mysql",
  "mongodb",
  "java",
  "javascript",
  "typescript",
  "react",
  "node",
  "docker",
  "kubernetes",
  "azure",
  "gcp",
  "telecom",
  "snowflake",
  "hive",
])
const outcomeStemSet = new Set([
  "improv",
  "increas",
  "reduc",
  "grow",
  "grew",
  "save",
  "rais",
  "boost",
  "acceler",
  "shorten",
  "stabil",
  "expand",
  "gener",
  "lift",
  "decreas",
  "optim",
  "streamlin",
  "enhanc",
])
const scopeStemSet = new Set([
  "team",
  "user",
  "custom",
  "client",
  "revenu",
  "cost",
  "pipelin",
  "platform",
  "system",
  "oper",
  "convert",
  "latenc",
  "account",
  "market",
  "product",
  "workflow",
  "process",
  "sale",
  "profit",
  "margin",
])
const weakImpactPhrases = unique(
  WEAK_ACTION_VERB_DICTIONARY.map((entry) => entry.weak.toLowerCase()).concat([
    "responsible for",
    "tasked with",
    "duties included",
    "part of",
  ])
)
const weakImpactStemPhrases = weakImpactPhrases.map((phrase) =>
  getStemmedTokens(phrase).join(" ")
)
const impactStopwords = new Set([...stopwords, ...NATURAL_STOPWORDS])

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9+-]/g, "")
}

function getExperienceBullets(sections: Map<string, string[]>) {
  const experience = [
    ...(sections.get("experience") ?? []),
    ...(sections.get("work experience") ?? []),
    ...(sections.get("employment") ?? []),
    ...(sections.get("professional experience") ?? []),
  ]

  return extractBullets(experience)
}

function getProjectBullets(sections: Map<string, string[]>) {
  return extractBullets(sections.get("projects") ?? [])
}

function getLeadVerbCounts(bullets: string[]) {
  const counts = new Map<string, number>()

  for (const bullet of bullets) {
    const firstWord = normalizeWord(bullet.split(/\s+/)[0] || "")
    if (!firstWord) continue
    counts.set(firstWord, (counts.get(firstWord) ?? 0) + 1)
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

function countPhraseMatches(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length ?? 0
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function getNormalizedTokens(text: string) {
  return tokenizeNaturalText(text, {
    minLength: 3,
    stopwords,
    excludeStopwords: true,
  }).map(normalizeWord)
}

function getStemmedTokens(text: string) {
  return getNormalizedTokens(text).map((token: string) =>
    stemNaturalToken(token)
  )
}

function countStemMatches(tokens: string[], dictionary: Set<string>) {
  return tokens.reduce((sum, token) => sum + (dictionary.has(token) ? 1 : 0), 0)
}

function hasStemPhraseMatch(tokens: string[], phrases: string[]) {
  const allPhrases = new Set(getNaturalNgramPhrases(tokens, [2, 3, 4]))

  return phrases.some((phrase) => allPhrases.has(phrase))
}

function getTopRepeatedPhrases(bullets: string[]) {
  const stemmedBullets = bullets.map((bullet) => getStemmedTokens(bullet))
  const counts = new Map<string, number>()

  for (const tokens of stemmedBullets) {
    for (const size of [2, 3]) {
      const grams = getNaturalNgramPhrases(tokens, [size])
      for (const phrase of grams) {
        if (
          phrase.split(" ").every((part: string) => strongActionVerbs.has(part))
        ) {
          continue
        }
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([phrase, count]) => ({ phrase, count })) satisfies ATSRepeatedPhrase[]
}

function getTopJobTerms(jobDescription: string) {
  if (!jobDescription.trim()) return []

  const rankedTokens = rankTermsByTfIdf(jobDescription, {
    limit: 18,
    stopwords: impactStopwords,
    corpusDocuments: buildNaturalCorpusDocuments(jobDescription, {
      stopwords: impactStopwords,
    }),
  })
  const tokenScores = new Map(
    rankedTokens.map((item) => [item.token, item.score])
  )
  const normalizedTokens = tokenizeNaturalText(jobDescription, {
    minLength: 2,
    stopwords: impactStopwords,
    excludeStopwords: true,
  })
  const rankedPhrases = getNaturalNgramPhrases(normalizedTokens, [2, 3])
    .map((phrase) => {
      const parts = phrase.split(" ")
      const score = parts.reduce(
        (sum, part) => sum + (tokenScores.get(part) ?? 0),
        0
      )
      return { phrase, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((item) => item.phrase)

  return unique([
    ...rankedPhrases,
    ...rankedTokens.map((item) => item.token),
  ]).slice(0, 18)
}

function getImpactTermMatches(
  bullet: string,
  terms: string[]
): Array<{
  term: string
  matchType: "exact" | "semantic"
  similarity: number
}> {
  const bulletLines = [bullet]
  type ImpactTermMatch = {
    term: string
    matchType: "exact" | "semantic"
    similarity: number
  }

  return terms.flatMap<ImpactTermMatch>((term) => {
    const evidence = findNaturalTermEvidence(bulletLines, term, {
      stopwords: impactStopwords,
    })
    if (evidence.exact) {
      return [
        { term, matchType: "exact" as const, similarity: evidence.similarity },
      ]
    }
    if (evidence.stem || evidence.ngram || evidence.fuzzy) {
      return [
        {
          term,
          matchType: "semantic" as const,
          similarity: evidence.similarity,
        },
      ]
    }
    return []
  })
}

function getTechnicalEntities(bullet: string) {
  const rawTokens = bullet.match(/[A-Za-z0-9+#.-]+/g) ?? []
  const normalized = rawTokens
    .map((token: string) => normalizeWord(token))
    .filter((token: string) => Boolean(token))

  return unique(
    normalized.filter((token) => {
      if (knownTechnicalEntities.has(token)) return true
      if (/[+#]/.test(token)) return true
      if (/^[a-z]{2,}\d+$/.test(token)) return true
      return false
    })
  )
}

function classifyBulletLength(
  bullet: string,
  context: {
    jdTerms: string[]
  }
) {
  const tokens = getNormalizedTokens(bullet)
  const wordCount = tokens.length
  const informativeTokenCount = new Set(tokens).size
  const contentDensity = wordCount > 0 ? informativeTokenCount / wordCount : 0
  const technicalEntities = getTechnicalEntities(bullet)
  const bulletStemSet = new Set(tokens.map((token) => stemNaturalToken(token)))
  const keywordMatches = context.jdTerms.filter((term) =>
    bulletStemSet.has(stemNaturalToken(term))
  )
  const hasMetric = /\b\d[\d.,]*\b|%|\$|£|€|\b(?:kpi|okr|mrr|arr|roi)\b/i.test(
    bullet
  )
  const hasOutcome =
    countStemMatches(
      tokens.map((token: string) => stemNaturalToken(token)),
      outcomeStemSet
    ) > 0
  const leadVerb = normalizeWord(bullet.split(/\s+/)[0] || "")
  const hasStrongLeadVerb = strongActionVerbs.has(leadVerb)
  const informationSignals =
    technicalEntities.length +
    keywordMatches.length +
    (hasMetric ? 1 : 0) +
    (hasOutcome ? 1 : 0) +
    (hasStrongLeadVerb ? 1 : 0)

  let classification: "good" | "short" | "long" = "good"
  const reasons: string[] = []

  if (wordCount <= 6) {
    classification = "short"
    reasons.push("Too little room for context and result.")
  } else if (wordCount <= 9 && informationSignals <= 2) {
    classification = "short"
    reasons.push("Short and low on ATS-detectable proof signals.")
  } else if (wordCount >= 36) {
    classification = "long"
    reasons.push("Length is likely to bury the main claim during scanning.")
  } else if (
    wordCount >= 29 &&
    contentDensity < 0.72 &&
    keywordMatches.length + technicalEntities.length <= 2
  ) {
    classification = "long"
    reasons.push(
      "Long without enough high-value terms to justify the extra length."
    )
  } else {
    reasons.push(
      "Length looks efficient for ATS parsing and recruiter scanning."
    )
  }

  if (classification === "short" && hasMetric && keywordMatches.length > 1) {
    classification = "good"
    reasons.length = 0
    reasons.push("Short, but still dense with strong ATS signals.")
  }

  return {
    bullet,
    wordCount,
    informativeTokenCount,
    contentDensity,
    technicalEntities,
    keywordMatches,
    classification,
    reasons,
  }
}

function scoreImpactBullet(
  bullet: string,
  context: {
    jdTerms: string[]
    roleAlignmentTerms: string[]
  }
) {
  const lower = bullet.toLowerCase()
  const tokens = tokenizeNaturalText(bullet, {
    minLength: 2,
    stopwords: impactStopwords,
    excludeStopwords: true,
  })
  const stemmedTokens = tokens.map((token: string) => stemNaturalToken(token))
  const leadVerb = normalizeWord(bullet.split(/\s+/)[0] || "") || null
  const wordCount = tokens.length
  const bulletStemSet = new Set(stemmedTokens)
  const bulletTfIdfTerms = rankTermsByTfIdf(bullet, {
    limit: 8,
    stopwords: impactStopwords,
  })
  const metricMentions =
    (bullet.match(/\b\d[\d.,]*\b/g)?.length ?? 0) +
    (bullet.match(/%|\$|£|€|\b(?:kpi|okr|mrr|arr|roi)\b/gi)?.length ?? 0) +
    (bullet.match(
      /\b(?:ms|sec|secs|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi
    )?.length ?? 0)
  const outcomeMentions = countStemMatches(stemmedTokens, outcomeStemSet)
  const scopeMentions = countStemMatches(stemmedTokens, scopeStemSet)
  const strongLeadVerb = leadVerb ? strongActionVerbs.has(leadVerb) : false
  const weakLeadPhrase =
    weakImpactPhrases.some(
      (phrase) => lower.startsWith(`${phrase} `) || lower === phrase
    ) || hasStemPhraseMatch(stemmedTokens, weakImpactStemPhrases)
  const passiveVoice =
    /\b(?:was|were|been|being|is|are)\s+\w+(?:ed|en)\b/i.test(bullet)
  const resultPattern =
    /\b(?:by|through|resulting in|resulted in|leading to|led to|which (?:increased|reduced|improved|generated|cut|boosted)|to (?:increase|reduce|improve|generate))\b/i.test(
      lower
    )
  const quantified = metricMentions > 0
  const keywordMatches = getImpactTermMatches(bullet, context.jdTerms)
  const technicalEntities = getTechnicalEntities(bullet)
  const roleAlignmentTerms = getImpactTermMatches(
    bullet,
    context.roleAlignmentTerms
  )
  const exactKeywordMatches = keywordMatches.filter(
    (match) => match.matchType === "exact"
  )
  const semanticKeywordMatches = keywordMatches.filter(
    (match) => match.matchType === "semantic"
  )
  const tfidfAlignedTerms = bulletTfIdfTerms.filter((item) =>
    keywordMatches.some(
      (match) =>
        match.term === item.token ||
        bulletStemSet.has(stemNaturalToken(match.term))
    )
  )
  const keywordRatio =
    context.jdTerms.length > 0
      ? (exactKeywordMatches.length + semanticKeywordMatches.length * 0.75) /
        context.jdTerms.length
      : 0
  const roleAlignmentRatio =
    context.roleAlignmentTerms.length > 0
      ? roleAlignmentTerms.length / context.roleAlignmentTerms.length
      : 0
  const starLike =
    (strongLeadVerb || !weakLeadPhrase) &&
    (quantified || outcomeMentions > 0) &&
    (scopeMentions > 0 || resultPattern)
  const taskHeavy =
    weakLeadPhrase || (!quantified && outcomeMentions === 0 && !resultPattern)

  let score = 12
  score +=
    context.jdTerms.length > 0
      ? keywordRatio * 46
      : Math.min(34, technicalEntities.length * 8 + scopeMentions * 4)
  score +=
    context.roleAlignmentTerms.length > 0
      ? roleAlignmentRatio * 22
      : Math.min(16, outcomeMentions * 4 + (resultPattern ? 4 : 0))
  score += Math.min(
    10,
    exactKeywordMatches.length * 3 + semanticKeywordMatches.length * 2
  )
  score += Math.min(8, tfidfAlignedTerms.length * 2)
  if (strongLeadVerb) score += 12
  else if (leadVerb && !weakLeadPhrase) score += 6
  if (weakLeadPhrase) score -= 10
  score += Math.min(12, metricMentions * 6)
  score += Math.min(10, technicalEntities.length * 3)
  score += Math.min(10, outcomeMentions * 3)
  score += Math.min(6, scopeMentions * 2)
  if (resultPattern) score += 8
  if (starLike) score += 8
  if (wordCount >= 12 && wordCount <= 28) score += 6
  if (wordCount < 9 || wordCount > 34) score -= 6
  if (passiveVoice) score -= 12
  if (taskHeavy) score -= 14

  const analysis: string[] = []
  const feedback: string[] = []

  if (strongLeadVerb) {
    analysis.push(
      `It opens with "${leadVerb}", which gives the bullet a stronger ownership signal right away.`
    )
  } else if (leadVerb) {
    analysis.push(
      `The opening verb "${leadVerb}" is not doing enough to signal clear ownership or pace.`
    )
    feedback.push(
      "Start the bullet with a stronger action verb that reflects what you directly drove."
    )
  }

  if (keywordMatches.length > 0) {
    analysis.push(
      `It matches ATS-relevant terms such as ${keywordMatches
        .slice(0, 4)
        .map((match) => match.term)
        .join(", ")}.`
    )
  } else if (context.jdTerms.length > 0) {
    analysis.push(
      "The bullet is not carrying enough of the job-description language that ATS systems usually reward."
    )
    feedback.push(
      "Work in the most relevant tools, skills, or process terms from the target job description where they are genuinely true."
    )
  }

  if (technicalEntities.length > 0) {
    analysis.push(
      `It names concrete technical entities like ${technicalEntities.slice(0, 4).join(", ")} instead of relying on generic wording.`
    )
  } else {
    feedback.push(
      "Name the actual tools, technologies, platforms, datasets, or processes involved when they matter to the work."
    )
  }

  if (quantified) {
    analysis.push(
      "The bullet includes measurable proof, which makes the claim easier for recruiters to trust."
    )
  } else {
    analysis.push(
      "There is no concrete metric yet, but ATS can still score this line well if the tools, keywords, and role relevance are strong."
    )
    feedback.push(
      "If you can support it, add a number, percentage, time saved, revenue impact, cost effect, or scale indicator for an extra lift."
    )
  }

  if (outcomeMentions > 0) {
    analysis.push(
      "The wording points to an outcome, so the bullet reads beyond a task list."
    )
  } else {
    analysis.push(
      "The bullet describes the work, but the result of that work is still under-explained."
    )
    feedback.push(
      "Clarify what improved, increased, reduced, accelerated, or changed because of your work."
    )
  }

  if (roleAlignmentTerms.length > 0) {
    analysis.push(
      `The content aligns with role-context terms such as ${roleAlignmentTerms
        .slice(0, 3)
        .map((match) => match.term)
        .join(", ")}.`
    )
  } else if (context.roleAlignmentTerms.length > 0) {
    feedback.push(
      "Align the line more clearly to the role by reflecting the responsibilities the target job emphasizes."
    )
  }

  if (scopeMentions > 0) {
    analysis.push(
      "It anchors the work in business or delivery context like users, systems, revenue, or operations."
    )
  } else {
    feedback.push(
      "Add scope so the reader can see where the impact landed, such as users, customers, a platform, a team, or a process."
    )
  }

  if (resultPattern) {
    analysis.push(
      "The structure shows an action-to-result flow, which makes the bullet easier to scan quickly."
    )
  } else {
    feedback.push(
      "Use a clearer action-to-result structure, for example with a result clause after the action."
    )
  }

  if (taskHeavy) {
    analysis.push(
      "Right now it reads more like a responsibility statement than a finished achievement."
    )
  }

  if (passiveVoice) {
    analysis.push(
      "Passive phrasing weakens the sense that you personally drove the result."
    )
    feedback.push(
      "Rewrite the line in active voice so ownership is unmistakable."
    )
  }

  if (wordCount < 9) {
    analysis.push(
      "The bullet is short enough that useful context may be missing."
    )
    feedback.push(
      "Add a little more context so the line captures action, scope, and result in one pass."
    )
  } else if (wordCount > 34) {
    analysis.push(
      "The bullet is long enough that the main result can get buried during recruiter scanning."
    )
    feedback.push(
      "Trim setup or secondary detail so the strongest result stays visible."
    )
  } else {
    analysis.push(
      "The bullet length is in a recruiter-friendly scanning range."
    )
  }

  if (feedback.length === 0) {
    feedback.push(
      "This bullet is already strong. If you revise it further, focus on making the result even more specific rather than rewriting the whole line."
    )
  }

  const finalScore = clampScore(score)

  return {
    achievementLike: finalScore >= 60,
    quantified,
    score: finalScore,
    scoreOutOfTen: Math.max(1, Math.min(10, Math.round(finalScore / 10))),
    analysis,
    feedback,
    reasons: analysis.slice(0, 3),
    signals: {
      leadVerb,
      wordCount,
      metricMentions,
      outcomeMentions,
      scopeMentions,
      strongLeadVerb,
      weakLeadPhrase,
      passiveVoice,
      resultPattern,
      starLike,
      taskHeavy,
      keywordMatches: keywordMatches.map((match) => match.term),
      relevanceRatio: keywordRatio,
      technicalEntities,
      roleAlignmentTerms: roleAlignmentTerms.map((match) => match.term),
    },
  }
}

function analyzeActionVerbs(
  resumeText: string,
  bullets: string[]
): ATSActionVerbAnalysis {
  const leadVerbCounts = getLeadVerbCounts(bullets)
  const totalLeadVerbs = leadVerbCounts.reduce(
    (sum, [, count]) => sum + count,
    0
  )
  const strongLeadVerbs = leadVerbCounts
    .filter(([verb]) => strongActionVerbs.has(verb))
    .reduce((sum, [, count]) => sum + count, 0)

  const weakMatches = WEAK_ACTION_VERB_DICTIONARY.map((entry) => ({
    phrase: entry.weak,
    count: countPhraseMatches(resumeText, entry.weak),
    replacements: entry.replacements.slice(0, 4),
  })).filter((entry) => entry.count > 0)

  const weakLeadVerbs = weakMatches.reduce((sum, entry) => sum + entry.count, 0)
  const repeatedLeadVerbs = leadVerbCounts
    .filter(([verb, count]) => strongActionVerbs.has(verb) && count > 2)
    .slice(0, 6)
    .map(([verb, count]) => ({ verb, count })) satisfies ATSRepeatedVerb[]

  const strongRatio = totalLeadVerbs > 0 ? strongLeadVerbs / totalLeadVerbs : 0
  const weakRatio = totalLeadVerbs > 0 ? weakLeadVerbs / totalLeadVerbs : 0
  const repetitionPenalty = Math.min(0.35, repeatedLeadVerbs.length * 0.08)
  const score = clampScore(
    strongRatio * 100 - weakRatio * 40 - repetitionPenalty * 100 + 20
  )

  return {
    score,
    totalLeadVerbs,
    strongLeadVerbs,
    weakLeadVerbs,
    repeatedLeadVerbs,
    weakMatches,
  }
}

function analyzeRepetition(bullets: string[]): ATSNLPAnalysis["repetition"] {
  const leadVerbCounts = getLeadVerbCounts(bullets).filter(([verb]) =>
    strongActionVerbs.has(verb)
  )
  const totalActionVerbCount = leadVerbCounts.reduce(
    (sum, [, count]) => sum + count,
    0
  )
  const repeatedLeadVerbs = leadVerbCounts
    .filter(([, count]) => count > 2)
    .slice(0, 6)
    .map(([verb, count]) => ({ verb, count })) satisfies ATSRepeatedVerb[]
  const repeatedActionVerbCount = repeatedLeadVerbs.reduce(
    (sum, item) => sum + item.count,
    0
  )
  const repeatedPhrases = getTopRepeatedPhrases(bullets)
  const ratio =
    totalActionVerbCount > 0
      ? repeatedActionVerbCount / totalActionVerbCount
      : 0
  const score =
    repeatedLeadVerbs.length === 0 ? 100 : clampScore((1 - ratio) * 100)

  return {
    score,
    totalActionVerbCount,
    repeatedActionVerbCount,
    repeatedLeadVerbs,
    repeatedPhrases,
  }
}

function analyzeImpact(
  bullets: string[],
  jobDescription: string
): ATSImpactAnalysis {
  const jdTerms = getTopJobTerms(jobDescription)
  const roleAlignmentTerms = jdTerms.slice(0, 8)
  const bulletAnalyses = bullets.map((bullet) => {
    const result = scoreImpactBullet(bullet, { jdTerms, roleAlignmentTerms })
    return { bullet, ...result }
  })
  const quantifiedBullets = bulletAnalyses.filter(
    (item) => item.quantified
  ).length
  const achievementLikeBullets = bulletAnalyses.filter(
    (item) => item.achievementLike
  ).length
  const responsibilityLikeBullets =
    bulletAnalyses.length - achievementLikeBullets
  const missingQuantificationAllowance =
    bulletAnalyses.length >= 6 ? 2 : bulletAnalyses.length >= 3 ? 1 : 0
  const averageScore =
    bulletAnalyses.length > 0
      ? bulletAnalyses.reduce((sum, item) => sum + item.score, 0) /
        bulletAnalyses.length
      : 0

  return {
    score: clampScore(averageScore),
    totalBullets: bulletAnalyses.length,
    quantifiedBullets,
    missingQuantificationAllowance,
    achievementLikeBullets,
    responsibilityLikeBullets,
    bulletAnalyses,
  }
}

function analyzeBulletLength(
  bullets: string[],
  jobDescription: string
): ATSBulletLengthAnalysis {
  const jdTerms = getTopJobTerms(jobDescription)
  const bulletItems = bullets.map((bullet) =>
    classifyBulletLength(bullet, { jdTerms })
  )
  const tooShortCount = bulletItems.filter(
    (item) => item.classification === "short"
  ).length
  const tooLongCount = bulletItems.filter(
    (item) => item.classification === "long"
  ).length
  const goodLengthCount = bulletItems.filter(
    (item) => item.classification === "good"
  ).length
  const averageWords =
    bulletItems.length > 0
      ? bulletItems.reduce((sum, item) => sum + item.wordCount, 0) /
        bulletItems.length
      : 0

  const totalIssues = tooShortCount + tooLongCount
  const issueRatio =
    bulletItems.length > 0 ? totalIssues / bulletItems.length : 0
  const score =
    bulletItems.length === 0
      ? 0
      : clampScore(100 - issueRatio * 65 - Math.max(0, tooLongCount - 1) * 4)

  return {
    score,
    averageWords: Math.round(averageWords),
    tooShortCount,
    tooLongCount,
    goodLengthCount,
    bullets: bulletItems,
  }
}

function analyzeBuzzwords(resumeText: string): ATSBuzzwordAnalysis {
  const normalized = resumeText.toLowerCase()
  const matchedFamilies = BUZZWORD_FAMILIES.map((family) => {
    const matchedTerms = family.terms.filter(
      (term) =>
        countPhraseMatches(normalized, term) > 0 ||
        getNaturalSimilarity(normalized, term) > 0.94
    )

    return {
      family: family.family,
      terms: matchedTerms,
      count: matchedTerms.reduce(
        (sum, term) => sum + countPhraseMatches(normalized, term),
        0
      ),
    }
  }).filter((family) => family.count > 0)

  const repeatedBuzzwords = matchedFamilies.flatMap((family) =>
    family.terms.map((term: string) => ({
      phrase: term,
      count: countPhraseMatches(normalized, term),
    }))
  )

  const buzzwordCount = repeatedBuzzwords.reduce(
    (sum, item) => sum + item.count,
    0
  )
  const score = buzzwordCount === 0 ? 100 : clampScore(100 - buzzwordCount * 12)

  return {
    score,
    repeatedBuzzwords,
    matchedFamilies,
  }
}

function analyzeJobMatch(
  sections: Map<string, string[]>,
  resumeText: string,
  jobDescription: string
): ATSJobMatchAnalysis {
  if (!jobDescription.trim()) {
    return {
      score: 0,
      hasJobDescription: false,
      topJDTerms: [],
      matchedTerms: [],
      missingTerms: [],
      sectionCoverage: {},
    }
  }

  const jdTerms = unique(
    rankTermsByTfIdf(jobDescription, {
      limit: 25,
      stopwords,
      corpusDocuments: [
        ...buildNaturalCorpusDocuments(jobDescription, { stopwords }),
        ...buildNaturalCorpusDocuments(resumeText, { stopwords }),
      ],
    }).map((item) => item.token)
  )

  const resumeTokens = new Set(getStemmedTokens(resumeText))
  const matchedTerms = jdTerms.filter((term) =>
    resumeTokens.has(stemNaturalToken(term))
  )
  const missingTerms = jdTerms.filter(
    (term) => !resumeTokens.has(stemNaturalToken(term))
  )
  const sectionCoverage: Record<string, string[]> = {}

  for (const [section, lines] of sections.entries()) {
    const sectionTokens = new Set(getStemmedTokens(lines.join(" ")))
    sectionCoverage[section] = jdTerms.filter((term) =>
      sectionTokens.has(stemNaturalToken(term))
    )
  }

  const matchRatio =
    jdTerms.length > 0 ? matchedTerms.length / jdTerms.length : 0

  return {
    score: clampScore(matchRatio * 100),
    hasJobDescription: true,
    topJDTerms: jdTerms,
    matchedTerms,
    missingTerms,
    sectionCoverage,
  }
}

function getEmptyJobMatchAnalysis(
  hasJobDescription: boolean
): ATSJobMatchAnalysis {
  return {
    score: 0,
    hasJobDescription,
    topJDTerms: [],
    matchedTerms: [],
    missingTerms: [],
    sectionCoverage: {},
  }
}

export function buildATSNLPAnalysis(input: {
  resumeContent: string
  jobDescription?: string | null
}): ATSNLPAnalysis {
  const resumeContent = input.resumeContent || ""
  const jobDescription = input.jobDescription || ""
  const sections = parseResumeSections(resumeContent)
  const experienceBullets = getExperienceBullets(sections)
  const projectBullets = getProjectBullets(sections)
  const bullets = [...experienceBullets, ...projectBullets]

  let jobMatch: ATSJobMatchAnalysis
  try {
    jobMatch = analyzeJobMatch(sections, resumeContent, jobDescription)
  } catch {
    jobMatch = getEmptyJobMatchAnalysis(Boolean(jobDescription.trim()))
  }

  return {
    actionVerbs: analyzeActionVerbs(resumeContent.toLowerCase(), bullets),
    repetition: analyzeRepetition(bullets),
    quantifyingImpact: analyzeImpact(experienceBullets, jobDescription),
    bulletLength: analyzeBulletLength(bullets, ""),
    buzzwords: analyzeBuzzwords(resumeContent),
    jobMatch,
  }
}
