import { ensureBootstrapAdmin } from "@/lib/auth"
import { isNextBuild, productionConfigError } from "@/lib/config"
import { seedDemoIfEmpty } from "@/lib/seed"

let ready = false

export function bootstrap(): void {
  if (isNextBuild()) return
  const problem = productionConfigError()
  if (problem) throw new Error(problem)
  if (ready) return
  if (process.env.SEED_DEMO === "1") seedDemoIfEmpty()
  ensureBootstrapAdmin()
  ready = true
}

export function resetBootstrapForTests(): void {
  ready = false
}
