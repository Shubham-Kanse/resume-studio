export const serviceContracts = {
  account: {
    delete: "/api/account/delete",
    export: "/api/account/export",
  },
  ats: {
    insights: "/api/ats-insights",
    score: "/api/ats-score",
  },
  document: {
    extractResume: "/api/extract-resume",
    latexToPdf: "/api/latex-to-pdf",
  },
  resume: {
    generate: "/api/generate-resume",
  },
} as const

export type ServiceContracts = typeof serviceContracts
