export interface ATSScoreResponse {
  analysisMode: "resume-only" | "resume-with-jd"
  resumeQualityScore: number
  targetRoleScore: number | null
  overallScore: number
  categoryScores: {
    keywordMatch: { score: number; maxScore: number } | null
    formatting: { score: number; maxScore: number }
    contentQuality: { score: number; maxScore: number }
    professionalSummary: { score: number; maxScore: number }
    skills: { score: number; maxScore: number }
    structure: { score: number; maxScore: number } | null
  }
  rating: "Excellent" | "Very Good" | "Good" | "Fair" | "Poor"
  keyFindings: {
    strengths: string[]
    weaknesses: string[]
    missingKeywords: string[] | null
    presentKeywords: string[] | null
  }
  detailedIssues: ATSIssue[]
  recommendations: ATSRecommendation[]
  sectionReviews: ATSSectionReview[]
  atsCompatibility: {
    parseability: number
    issues: string[]
    warnings: string[]
  }
  keywordAnalysis: {
    totalKeywordsInJD: number
    matchedKeywords: number
    matchPercentage: number
    keywordDensity: number
    overusedKeywords: string[]
    underusedKeywords: string[]
    matchedByCategory: {
      title: string[]
      required: string[]
      preferred: string[]
      culture: string[]
    }
    missingByCategory: {
      required: string[]
      preferred: string[]
    }
  } | null
  debugAnalysis: ATSDebugSection[]
}

export interface ATSDebugSection {
  id: string
  title: string
  summary: string
  items: ATSDebugItem[]
}

export interface ATSDebugItem {
  label: string
  detail: string
  suggestion?: string
  severity: "good" | "info" | "warning" | "critical"
}

export interface ATSIssue {
  severity: "critical" | "high" | "medium" | "low"
  category: string
  issue: string
  impact: string
  howToFix: string
  example: string
}

export interface ATSRecommendation {
  priority: "high" | "medium" | "low"
  action: string
  benefit: string
  implementation: string
}

export interface ATSSectionReview {
  id: "professionalSummary" | "workExperience" | "skills" | "education" | "keywords" | "formatting"
  title: string
  score: number
  status: "strong" | "good" | "needs-work" | "weak"
  diagnosis: string
  whatWorks: string[]
  gaps: string[]
  actions: string[]
}
