import { spawnSync } from "node:child_process"

const budgetKb = Number(process.env.BUNDLE_BUDGET_KB || 150)

const result = spawnSync("pnpm", ["build"], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "pipe",
})

const output = `${result.stdout || ""}${result.stderr || ""}`

if (result.stdout) {
  process.stdout.write(result.stdout)
}

if (result.stderr) {
  process.stderr.write(result.stderr)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const routeLine = output
  .split("\n")
  .find((line) => /^\s*[├┌└│]\s*[○ƒ]\s*\/\s+/.test(line))

if (!routeLine) {
  console.error("Could not find the home route bundle size in build output.")
  process.exit(1)
}

const match = routeLine.match(/\/\s+(\d+(?:\.\d+)?)\s*kB\s+(\d+(?:\.\d+)?)\s*kB/)

if (!match) {
  console.error("Could not parse the home route bundle size.")
  process.exit(1)
}

const routeJsKb = Number(match[1])
const firstLoadJsKb = Number(match[2])

console.log(`Bundle report for /`)
console.log(`- Route JS: ${routeJsKb.toFixed(1)} kB`)
console.log(`- First Load JS: ${firstLoadJsKb.toFixed(1)} kB`)
console.log(`- Budget: ${budgetKb.toFixed(1)} kB`)

if (firstLoadJsKb > budgetKb) {
  console.error(
    `Bundle budget exceeded by ${(firstLoadJsKb - budgetKb).toFixed(1)} kB`
  )
  process.exit(1)
}
