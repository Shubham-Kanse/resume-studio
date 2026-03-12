import { spawnSync } from "node:child_process"

const steps = [
  {
    label: "Environment validation",
    command: "node",
    args: ["scripts/validate-env.mjs"],
  },
  {
    label: "Lint",
    command: "pnpm",
    args: ["lint"],
  },
  {
    label: "Typecheck",
    command: "pnpm",
    args: ["typecheck"],
  },
  {
    label: "Tests",
    command: "pnpm",
    args: ["test:eval"],
    skipEnv: "SKIP_BUILD_TESTS",
  },
  {
    label: "Next.js production build",
    command: "pnpm",
    args: ["build:next"],
  },
  {
    label: "Bundle size check",
    command: "pnpm",
    args: ["bundle:check"],
    skipEnv: "CHECK_BUNDLE_SIZE",
    runWhen: "1",
  },
]

function runStep(step) {
  console.log("")
  console.log(`==> ${step.label}`)

  if (step.skipEnv) {
    const expected = step.runWhen ?? "0"
    const actual = process.env[step.skipEnv] ?? "0"
    if (actual !== expected) {
      console.log(`Skipped because ${step.skipEnv} is not ${expected}`)
      return
    }
  }

  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  })

  if (result.status !== 0) {
    console.error("")
    console.error(`Build failed during: ${step.label}`)
    process.exit(result.status ?? 1)
  }
}

console.log("Starting production build pipeline...")

for (const step of steps) {
  runStep(step)
}

console.log("")
console.log("Build pipeline completed successfully.")
