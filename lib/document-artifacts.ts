import { z } from "zod"

export const documentBlockSchema = z.object({
  page: z.number().int().min(1),
  text: z.string().trim().min(1).max(5000),
  kind: z.enum([
    "heading",
    "paragraph",
    "bullet",
    "tableish",
    "contact",
    "other",
  ]),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().optional(),
  height: z.number().finite().optional(),
  fontSize: z.number().finite().optional(),
})

export const documentLayoutSchema = z.object({
  pageCount: z.number().int().min(1).max(20),
  hasTableEvidence: z.boolean().default(false),
  hasHeaderFooterEvidence: z.boolean().default(false),
  hasMultiColumnEvidence: z.boolean().default(false),
  readingOrderRisk: z.number().min(0).max(1).default(0),
  averageBlocksPerPage: z.number().min(0).max(1000).default(0),
})

export const documentArtifactsSchema = z.object({
  sourceType: z.enum(["pdf", "docx", "doc", "text"]),
  extractedText: z.string().trim().min(1).max(100000),
  layout: documentLayoutSchema,
  blocks: z.array(documentBlockSchema).max(250).default([]),
})

export type DocumentArtifacts = z.infer<typeof documentArtifactsSchema>
export type DocumentBlock = z.infer<typeof documentBlockSchema>
