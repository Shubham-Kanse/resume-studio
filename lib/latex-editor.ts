export const AUTO_COMPILE_DELAY = 900
export const MAX_LATEX_LENGTH = 100000

export interface LaTeXError {
  type: "error" | "warning"
  message: string
  line?: number
}

export function validateLaTeX(content: string): LaTeXError[] {
  const errors: LaTeXError[] = []
  if (!content.trim()) return errors

  const lines = content.split("\n")
  const hasDocumentClass = content.includes("\\documentclass")
  const hasBeginDocument = content.includes("\\begin{document}")
  const hasEndDocument = content.includes("\\end{document}")

  if (!hasDocumentClass) {
    errors.push({
      type: "error",
      message: "Missing \\documentclass. Add: \\documentclass{article}",
      line: 1,
    })
  }
  if (hasBeginDocument && !hasEndDocument) {
    errors.push({
      type: "error",
      message: "Missing \\end{document}. Add it at the end.",
      line: lines.findIndex((line) => line.includes("\\begin{document}")) + 1,
    })
  }
  if (!hasBeginDocument && hasEndDocument) {
    errors.push({
      type: "error",
      message: "Missing \\begin{document}. Add it before content.",
      line: lines.findIndex((line) => line.includes("\\end{document}")) + 1,
    })
  }

  const envStack: Array<{ name: string; line: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const escapedLine = line.replace(/\\%/g, "__ESCAPED_PERCENT__")
    const commentStart = escapedLine.indexOf("%")
    const codePortion =
      commentStart >= 0 ? line.slice(0, commentStart).replace(/__ESCAPED_PERCENT__/g, "\\%") : line

    const beginMatch = codePortion.match(/\\begin\{([^}]+)\}/)
    if (beginMatch) envStack.push({ name: beginMatch[1], line: lineNum })

    const inAlignmentEnv = envStack.some((env) =>
      ["tabular", "tabular*", "array", "align", "align*", "aligned"].includes(env.name)
    )

    const endMatch = codePortion.match(/\\end\{([^}]+)\}/)
    if (endMatch) {
      const envName = endMatch[1]
      if (envStack.length === 0) {
        errors.push({
          type: "error",
          message: `Unmatched \\end{${envName}}. Add \\begin{${envName}} before.`,
          line: lineNum,
        })
      } else {
        const last = envStack.pop()!
        if (last.name !== envName) {
          errors.push({
            type: "error",
            message: `\\begin{${last.name}} at line ${last.line} closed with \\end{${envName}}. Use \\end{${last.name}}.`,
            line: lineNum,
          })
        }
      }
    }

    if (codePortion.includes("_") && !codePortion.includes("\\_") && !codePortion.match(/\$.*_.*\$/)) {
      errors.push({
        type: "warning",
        message: "Underscore outside math. Use \\_ or $ $",
        line: lineNum,
      })
    }

    if (
      codePortion.includes("&") &&
      !codePortion.includes("\\&") &&
      !inAlignmentEnv &&
      !codePortion.match(/\\(begin|end)\{(tabular|array|align|align\\*|aligned|tabular\*)/) &&
      !codePortion.includes("\\extracolsep")
    ) {
      errors.push({
        type: "warning",
        message: "Ampersand outside table. Use \\&",
        line: lineNum,
      })
    }

    if (/(?:\d|[A-Za-z])%(?![A-Za-z])/.test(codePortion.replace(/\\%/g, ""))) {
      errors.push({
        type: "warning",
        message: "Percent sign should be \\%",
        line: lineNum,
      })
    }
  }

  envStack.forEach((env) =>
    errors.push({
      type: "error",
      message: `Unclosed \\begin{${env.name}} at line ${env.line}. Add \\end{${env.name}}`,
      line: env.line,
    })
  )

  return errors
}
