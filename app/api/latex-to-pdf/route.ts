import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { latex, preview } = await request.json()

    if (!latex || typeof latex !== "string") {
      return NextResponse.json(
        { error: "No LaTeX content provided." },
        { status: 400 }
      )
    }

    const response = await fetch("https://latex.ytotech.com/builds/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler: "pdflatex",
        resources: [
          {
            main: true,
            content: latex,
          },
        ],
      }),
      cache: "no-store",
    })

    const arrayBuffer = await response.arrayBuffer()

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Empty response from LaTeX compiler." },
        { status: 500 }
      )
    }

    const bytes = new Uint8Array(arrayBuffer)
    const header = new TextDecoder().decode(bytes.slice(0, 4))

    if (header !== "%PDF") {
      const text = new TextDecoder().decode(bytes)

      return NextResponse.json(
        {
          error: "LaTeX compilation failed.",
          details: text.slice(0, 2000),
        },
        { status: 400 }
      )
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": preview
          ? 'inline; filename="resume.pdf"'
          : 'attachment; filename="resume.pdf"',
      },
    })
  } catch (error) {
    console.error("Latex API error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to compile LaTeX",
      },
      { status: 500 }
    )
  }
}
