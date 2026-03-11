import { rmSync } from "node:fs"
import path from "node:path"

const nextDir = path.join(process.cwd(), ".next")

rmSync(nextDir, {
  force: true,
  recursive: true,
})
