import fs from "node:fs"
import { registerHooks } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = process.cwd()
const supportedExtensions = [".ts", ".tsx", ".js", ".mjs", ".cjs"]

function resolveWithExtensions(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath
  }

  for (const extension of supportedExtensions) {
    const candidate = `${basePath}${extension}`
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  for (const extension of supportedExtensions) {
    const candidate = path.join(basePath, `index${extension}`)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let candidatePath = null

    if (specifier === "next/server") {
      candidatePath = path.join(
        projectRoot,
        "scripts",
        "test-shims",
        "next-server.mjs"
      )
    } else if (specifier.startsWith("@/")) {
      candidatePath = resolveWithExtensions(
        path.join(projectRoot, specifier.slice(2))
      )
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL
    ) {
      const parentPath = fileURLToPath(context.parentURL)
      candidatePath = resolveWithExtensions(
        path.resolve(path.dirname(parentPath), specifier)
      )
    }

    if (candidatePath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidatePath).href,
      }
    }

    return nextResolve(specifier, context)
  },
})
