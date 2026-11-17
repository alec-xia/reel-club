import { healthStatus } from "@/lib/health"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  const health = healthStatus()
  return Response.json(
    health.ok ? { ok: true } : { ok: false, error: health.error },
    { status: health.status },
  )
}
