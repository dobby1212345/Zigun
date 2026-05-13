import { access, cp, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, "..")
const sourceDir = path.join(rootDir, "frontend", "dist")
const targetDir = path.join(rootDir, "backend", "dist")

try {
  await access(sourceDir)
} catch {
  console.error(`Source build directory not found: ${sourceDir}`)
  process.exit(1)
}

await rm(targetDir, { recursive: true, force: true })
await cp(sourceDir, targetDir, { recursive: true })

console.log(`Copied frontend build from ${sourceDir} to ${targetDir}`)