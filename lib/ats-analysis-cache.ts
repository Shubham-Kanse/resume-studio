import type { ATSNLPAnalysis } from "@/lib/ats-nlp-analysis-types"
import type { RuntimeSpellCheckMetrics } from "@/lib/ats-runtime-spell-check"

export const runtimeSpellMetricsCache = new Map<
  string,
  Promise<RuntimeSpellCheckMetrics | null>
>()

export const nlpAnalysisCache = new Map<
  string,
  Promise<ATSNLPAnalysis | null>
>()

export function clearATSAnalysisCaches() {
  runtimeSpellMetricsCache.clear()
  nlpAnalysisCache.clear()
}
