import { cn } from "cn"
import { formatDelta } from "@/lib/format"

export function Delta({ value, className }: { value: number; className?: string }) {
  const tone = value > 0.049 ? "delta-up" : value < -0.049 ? "delta-down" : "text-muted-foreground"
  return <span className={cn("tabular-nums", tone, className)}>{formatDelta(value)}</span>
}
