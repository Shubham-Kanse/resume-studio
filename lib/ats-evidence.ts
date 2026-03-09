import type { ATSScoreResponse } from "@/lib/ats-types"
import type { DeterministicATSResult } from "@/lib/local-ats-scorer"

export function buildEvidenceSummary(
  result: DeterministicATSResult
): ATSScoreResponse["evidenceSummary"] {
  return {
    requiredSectionsPresent: result.evidence.requiredSectionsPresent,
    missingSections: result.evidence.missingSections,
    missingOptionalSections: result.evidence.missingOptionalSections,
    matchedKeywords: result.keyFindings.presentKeywords ?? [],
    missingKeywords: result.keyFindings.missingKeywords ?? [],
    yearsRequired: result.evidence.qualification.yearsRequired,
    yearsEstimated: result.evidence.qualification.yearsEstimated,
    meetsYearsRequirement: result.evidence.qualification.meetsYearsRequirement,
    degreeRequirement: result.evidence.qualification.degreeRequirement,
    meetsDegreeRequirement: result.evidence.qualification.meetsDegreeRequirement,
    requiredCertifications: result.evidence.qualification.requiredCertifications,
    missingCertifications: result.evidence.qualification.missingCertifications,
    matchedRoleFamilies: result.evidence.qualification.matchedRoleFamilies,
    parseabilityIssues: result.atsCompatibility.issues,
    parseabilityWarnings: result.atsCompatibility.warnings,
  }
}
