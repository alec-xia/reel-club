import { bootstrap } from "@/lib/bootstrap"
import { productionConfigError } from "@/lib/config"
import { getDb } from "@/lib/db"

export function healthStatus(): { ok: boolean; status: number; error?: string } {
  const problem = productionConfigError()
  if (problem) return { ok: false, status: 503, error: problem }
  try {
    bootstrap()
    getDb().prepare("SELECT 1 AS ok").get()
    return { ok: true, status: 200 }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unhealthy"
    return { ok: false, status: 503, error: message }
  }
}
