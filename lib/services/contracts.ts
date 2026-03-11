export const serviceContracts = {
  auth: {
    session: "/api/auth/session",
  },
  account: {
    delete: "/api/account/delete",
    export: "/api/account/export",
    plan: "/api/account/plan",
  },
  billing: {
    checkout: "/api/billing/checkout",
    portal: "/api/billing/portal",
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
