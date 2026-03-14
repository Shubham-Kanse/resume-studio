import type { DeterministicATSResult } from "@/lib/local-ats-scorer"
import type { ATSScoreResponse } from "@/types/ats"

export function buildEvidenceSummary(
  result: DeterministicATSResult
): ATSScoreResponse["evidenceSummary"] {
  return {
    requiredSectionsPresent: result.evidence.requiredSectionsPresent,
    missingSections: result.evidence.missingSections,
    missingOptionalSections: [],
    matchedKeywords: result.keyFindings.presentKeywords ?? [],
    missingKeywords: result.keyFindings.missingKeywords ?? [],
    yearsRequired: result.evidence.qualification.yearsRequired,
    yearsEstimated: result.evidence.qualification.yearsEstimated,
    meetsYearsRequirement: result.evidence.qualification.meetsYearsRequirement,
    degreeRequirement: result.evidence.qualification.degreeRequirement,
    meetsDegreeRequirement:
      result.evidence.qualification.meetsDegreeRequirement,
    requiredCertifications:
      result.evidence.qualification.requiredCertifications,
    missingCertifications: result.evidence.qualification.missingCertifications,
    matchedRoleFamilies: result.evidence.qualification.matchedRoleFamilies,
    expectedSeniority: result.evidence.qualification.expectedSeniority,
    observedSeniority: result.evidence.qualification.observedSeniority,
    seniorityAligned: result.evidence.qualification.seniorityAligned,
    managementRequired: result.evidence.qualification.managementRequired,
    managementObserved: result.evidence.qualification.managementObserved,
    parseabilityIssues: result.atsCompatibility.issues,
    parseabilityWarnings: result.atsCompatibility.warnings,
    keywordCoverageBySection: result.keywordAnalysis?.coverageBySection ?? null,
  }
}
