import { seedDemoIfEmpty } from "@/lib/seed"

export function bootstrap(): void {
  if (process.env.SEED_DEMO === "0") return
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "1") return
  seedDemoIfEmpty()
}
