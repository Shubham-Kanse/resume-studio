import fs from "node:fs/promises"
import path from "node:path"

import {
  trainSimpleCalibration,
  DEFAULT_ATS_CALIBRATION,
} from "../lib/ats-calibration.ts"

async function main() {
  const inputPath =
    process.argv[2] || path.join(process.cwd(), "data", "ats-calibration.json")
  const outputPath =
    process.argv[3] ||
    path.join(process.cwd(), "data", "ats-calibration.config.json")

  let samples = []
  try {
    const raw = await fs.readFile(inputPath, "utf8")
    const parsed = JSON.parse(raw)
    samples = Array.isArray(parsed) ? parsed : []
  } catch {
    samples = []
  }

  const config =
    samples.length > 0 ? trainSimpleCalibration(samples) : DEFAULT_ATS_CALIBRATION
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`)
  process.stdout.write(
    `Calibration config written to ${outputPath} using ${samples.length} sample(s).\n`
  )
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
