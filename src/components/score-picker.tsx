"use client"

import { useState } from "react"
import { cn } from "cn"
import { formatScore } from "@/lib/format"

const WHOLE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function ScorePicker({
  name,
  label,
  hint,
  low,
  high,
  defaultValue,
}: {
  name: string
  label: string
  hint: string
  low: string
  high: string
  defaultValue?: number
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null)
  const selectedWhole = value == null ? null : Math.floor(value) === value ? value : Math.floor(value)
  const isHalf = value != null && value % 1 !== 0

  function choose(whole: number) {
    if (value === whole && whole < 10) {
      setValue(whole + 0.5)
      return
    }
    if (value === whole + 0.5) {
      setValue(whole)
      return
    }
    setValue(whole)
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-heading text-xl leading-tight">{label}</legend>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <p className="font-heading text-4xl tabular-nums" aria-live="polite">
        {value == null ? "—" : formatScore(value)}
      </p>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label={label}>
        {WHOLE.map((whole) => {
          const active = selectedWhole === whole
          return (
            <button
              key={whole}
              type="button"
              aria-pressed={active}
              onClick={() => choose(whole)}
              className={cn(
                "h-12 rounded-xl text-base font-medium tabular-nums transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground ring-1 ring-foreground/10 hover:bg-accent",
              )}
            >
              {active && isHalf ? formatScore(value as number) : whole}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs tracking-wide text-muted-foreground uppercase">
        <span>{low}</span>
        <span>{high}</span>
      </div>
      <p className="text-xs text-muted-foreground">Tap a number. Tap it again for a half point.</p>
      <input type="hidden" name={name} value={value ?? ""} required />
    </fieldset>
  )
}
