export type ATSWeakVerbMatch = {
  phrase: string
  count: number
  replacements: string[]
}

export type ATSRepeatedVerb = {
  verb: string
  count: number
}

export type ATSRepeatedPhrase = {
  phrase: string
  count: number
}

export type ATSBulletImpactAnalysis = {
  bullet: string
  achievementLike: boolean
  quantified: boolean
  score: number
  scoreOutOfTen: number
  analysis: string[]
  feedback: string[]
  reasons: string[]
  signals: {
    leadVerb: string | null
    wordCount: number
    metricMentions: number
    outcomeMentions: number
    scopeMentions: number
    strongLeadVerb: boolean
    weakLeadPhrase: boolean
    passiveVoice: boolean
    resultPattern: boolean
    starLike: boolean
    taskHeavy: boolean
    keywordMatches: string[]
    relevanceRatio: number
    technicalEntities: string[]
    roleAlignmentTerms: string[]
  }
}

export type ATSActionVerbAnalysis = {
  score: number
  totalLeadVerbs: number
  strongLeadVerbs: number
  weakLeadVerbs: number
  repeatedLeadVerbs: ATSRepeatedVerb[]
  weakMatches: ATSWeakVerbMatch[]
}

export type ATSRepetitionAnalysis = {
  score: number
  totalActionVerbCount: number
  repeatedActionVerbCount: number
  repeatedLeadVerbs: ATSRepeatedVerb[]
  repeatedPhrases: ATSRepeatedPhrase[]
}

export type ATSImpactAnalysis = {
  score: number
  totalBullets: number
  quantifiedBullets: number
  missingQuantificationAllowance: number
  achievementLikeBullets: number
  responsibilityLikeBullets: number
  bulletAnalyses: ATSBulletImpactAnalysis[]
}

export type ATSBulletLengthItem = {
  bullet: string
  wordCount: number
  informativeTokenCount: number
  contentDensity: number
  technicalEntities: string[]
  keywordMatches: string[]
  classification: "good" | "short" | "long"
  reasons: string[]
}

export type ATSBulletLengthAnalysis = {
  score: number
  averageWords: number
  tooShortCount: number
  tooLongCount: number
  goodLengthCount: number
  bullets: ATSBulletLengthItem[]
}

export type ATSBuzzwordAnalysis = {
  score: number
  repeatedBuzzwords: ATSRepeatedPhrase[]
  matchedFamilies: Array<{
    family: string
    terms: string[]
    count: number
  }>
}

export type ATSJobMatchAnalysis = {
  score: number
  hasJobDescription: boolean
  topJDTerms: string[]
  matchedTerms: string[]
  missingTerms: string[]
  sectionCoverage: Record<string, string[]>
}

export type ATSNLPAnalysis = {
  actionVerbs: ATSActionVerbAnalysis
  repetition: ATSRepetitionAnalysis
  quantifyingImpact: ATSImpactAnalysis
  bulletLength: ATSBulletLengthAnalysis
  buzzwords: ATSBuzzwordAnalysis
  jobMatch: ATSJobMatchAnalysis
}
