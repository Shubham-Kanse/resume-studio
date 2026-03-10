import { serviceContracts } from "@/lib/services/contracts"

export const serviceRegistry = [
  {
    domain: "resume",
    description: "AI resume generation and LaTeX verification",
    routes: [serviceContracts.resume.generate],
  },
  {
    domain: "ats",
    description: "Deterministic ATS scoring and optional narrative insights",
    routes: [serviceContracts.ats.score, serviceContracts.ats.insights],
  },
  {
    domain: "document",
    description: "Resume extraction and LaTeX to PDF compilation",
    routes: [serviceContracts.document.extractResume, serviceContracts.document.latexToPdf],
  },
  {
    domain: "account",
    description: "Authenticated export and deletion workflows",
    routes: [serviceContracts.account.export, serviceContracts.account.delete],
  },
] as const
