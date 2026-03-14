import { NextResponse } from "next/server"

import { buildATSNLPAnalysis } from "@/lib/ats-nlp-analysis"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    resumeContent?: string
    jobDescription?: string | null
  } | null

  const resumeContent =
    typeof body?.resumeContent === "string" ? body.resumeContent : ""
  const jobDescription =
    typeof body?.jobDescription === "string" ? body.jobDescription : ""

  return NextResponse.json(
    buildATSNLPAnalysis({
      resumeContent,
      jobDescription,
    })
  )
}
