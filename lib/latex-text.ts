export function latexToPlainText(latex: string): string {
  return latex
    .replace(/\\%/g, "__LATEX_PERCENT__")
    .replace(/%.*$/gm, "")
    .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]*\}/g, " ")
    .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]*\}/g, " ")
    .replace(/\\(?:begin|end)\{[^}]*\}/g, "\n")
    .replace(/\\section\*?\{([^}]*)\}/g, "\n$1\n")
    .replace(
      /\\resumeSubheading\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g,
      "\n$1 | $2\n$3 | $4\n"
    )
    .replace(/\\resumeSubSubheading\{([^}]*)\}\{([^}]*)\}/g, "\n$1 | $2\n")
    .replace(/\\resumeProjectHeading\{([^}]*)\}\{([^}]*)\}/g, "\n$1 | $2\n")
    .replace(/\\resumeItem\{([^}]*)\}/g, "\n- $1\n")
    .replace(/\\resumeSubItem\{([^}]*)\}/g, "\n- $1\n")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\(textbf|textit|emph|texttt|myuline)\{([^}]*)\}/g, "$2")
    .replace(
      /\\(?:faPhone\*|faEnvelope|faMapMarker\*|faLinkedin|faGithub)\b/g,
      " "
    )
    .replace(
      /\\(?:Huge|huge|Large|large|small|normalsize|bfseries|raggedright)\b/g,
      " "
    )
    .replace(/\\(?:hspace|vspace)\*?\{[^}]*\}/g, " ")
    .replace(
      /\\(?:color|definecolor|renewcommand|newcommand|setlength|addtolength|pagestyle|fancyhf|fancyfoot|fancyhead|urlstyle|contourlength|titleformat)\b[^\n]*/g,
      " "
    )
    .replace(/\\item\b/g, "\n- ")
    .replace(/\\\\(?:\[[^\]]*\])?/g, "\n")
    .replace(/\$[|]/g, "|")
    .replace(/\\[%&#_$]/g, (match) => match.slice(1))
    .replace(/__LATEX_PERCENT__/g, "%")
    .replace(/\\[A-Za-z@]+/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}
