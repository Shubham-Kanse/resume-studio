import { fetchWithPolicy } from "@/lib/http"

export interface LatexCompileSuccess {
  ok: true
  pdf: ArrayBuffer
  provider: string
}

export interface LatexCompileFailure {
  ok: false
  details: string
  provider: string
}

export type LatexCompileResult = LatexCompileSuccess | LatexCompileFailure

function getLatexCompilerProvider() {
  return process.env.LATEX_COMPILER_PROVIDER || "ytotech"
}

export async function compileLatexDocument(
  latex: string
): Promise<LatexCompileResult> {
  const provider = getLatexCompilerProvider()

  if (provider !== "ytotech") {
    return {
      ok: false,
      details: `Unsupported LaTeX compiler provider: ${provider}`,
      provider,
    }
  }

  const response = await fetchWithPolicy(
    "https://latex.ytotech.com/builds/sync",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        compiler: "pdflatex",
        resources: [
          {
            main: true,
            content: latex,
          },
        ],
      },
      cache: "no-store",
      timeoutMs: 18_000,
      retries: 1,
    }
  )

  const arrayBuffer = await response.arrayBuffer()
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return {
      ok: false,
      details: "Empty response from LaTeX compiler.",
      provider,
    }
  }

  const bytes = new Uint8Array(arrayBuffer)
  const header = new TextDecoder().decode(bytes.slice(0, 4))
  if (header === "%PDF") {
    return {
      ok: true,
      pdf: arrayBuffer,
      provider,
    }
  }

  return {
    ok: false,
    details: new TextDecoder().decode(bytes).slice(0, 3000),
    provider,
  }
}
