import { memberColor } from "@/lib/format"
import type { WeekResult } from "@/lib/ranking"

export function EloChart({
  members,
  history,
  start,
}: {
  members: string[]
  history: WeekResult[]
  start: number
}) {
  const width = 680
  const height = 220
  const pad = { left: 44, right: 12, top: 16, bottom: 28 }
  const series = members.map((member) => {
    const values = [start, ...history.map((week) => week.elo_after[member] ?? start)]
    return { member, values }
  })
  const flat = series.flatMap((item) => item.values)
  const min = Math.min(...flat, start)
  const max = Math.max(...flat, start)
  const span = Math.max(20, max - min)
  const yMin = min - span * 0.12
  const yMax = max + span * 0.12
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const steps = Math.max(1, history.length)

  function x(index: number) {
    return pad.left + (index / steps) * innerW
  }
  function y(value: number) {
    return pad.top + ((yMax - value) / (yMax - yMin)) * innerH
  }

  const ticks = [yMax, (yMax + yMin) / 2, yMin]

  return (
    <figure className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Elo over scored movies">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.7">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {series.map((item) => {
          const d = item.values
            .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
            .join(" ")
          const color = memberColor(item.member, members)
          const last = item.values.length - 1
          return (
            <g key={item.member}>
              <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last)} cy={y(item.values[last])} r="3.5" fill={color} />
            </g>
          )
        })}
        <text x={x(0)} y={height - 8} fontSize="11" fill="currentColor" opacity="0.65">
          Start
        </text>
        {history.length > 0 ? (
          <text x={x(history.length)} y={height - 8} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.65">
            Latest
          </text>
        ) : null}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {members.map((member) => (
          <li key={member} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: memberColor(member, members) }} />
            {member}
          </li>
        ))}
      </ul>
    </figure>
  )
}
