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
  let braceCount = 0
  let bracketCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      const prev = j > 0 ? line[j - 1] : ""

      if (char === "{" && prev !== "\\") braceCount++
      if (char === "}" && prev !== "\\") braceCount--
      if (char === "[" && prev !== "\\") bracketCount++
      if (char === "]" && prev !== "\\") bracketCount--

      if (braceCount < 0) {
        errors.push({ type: "error", message: "Unmatched }. Remove or add {", line: lineNum })
        braceCount = 0
      }
      if (bracketCount < 0) {
        errors.push({ type: "error", message: "Unmatched ]. Remove or add [", line: lineNum })
        bracketCount = 0
      }
    }

    const beginMatch = line.match(/\\begin\{([^}]+)\}/)
    if (beginMatch) envStack.push({ name: beginMatch[1], line: lineNum })

    const endMatch = line.match(/\\end\{([^}]+)\}/)
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

    if (line.includes("_") && !line.includes("\\_") && !line.match(/\$.*_.*\$/)) {
      errors.push({
        type: "warning",
        message: "Underscore outside math. Use \\_ or $ $",
        line: lineNum,
      })
    }

    if (
      line.includes("&") &&
      !line.includes("\\&") &&
      !line.match(/\\begin\{(tabular|array|align)/)
    ) {
      errors.push({
        type: "warning",
        message: "Ampersand outside table. Use \\&",
        line: lineNum,
      })
    }

    if (line.includes("%") && !line.includes("\\%")) {
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

  if (braceCount > 0) {
    errors.push({ type: "error", message: `${braceCount} unclosed {. Add closing }` })
  }

  if (bracketCount > 0) {
    errors.push({ type: "error", message: `${bracketCount} unclosed [. Add closing ]` })
  }

  return errors
}
