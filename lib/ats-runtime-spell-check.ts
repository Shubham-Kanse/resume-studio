export type RuntimeSpellIssue = {
  word: string
  count: number
  suggestions: string[]
}

export type RuntimeSpellCheckMetrics = {
  issues: RuntimeSpellIssue[]
  totalMisspellingCount: number
  score: number
}
