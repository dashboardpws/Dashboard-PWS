import { ProgressBar } from '@/components/ui'
import { cn, CARD_SHELL } from '@/lib/utils'

export interface KelStat {
  kel: string
  n: number
  pct: number
}

export interface KelStatsGridProps {
  stats: KelStat[]
  unit: string
}

export function KelStatsGrid({ stats, unit }: KelStatsGridProps) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-3 max-md:grid-cols-2">
      {stats.map((s) => (
        <div key={s.kel} className={cn(CARD_SHELL, 'p-3.5 shadow-card')}>
          <div className="text-xs font-semibold text-ink">Kel. {s.kel}</div>
          <div className="mt-0.5 text-[11px] text-muted">
            {s.n} {unit}
          </div>
          <ProgressBar value={s.pct} className="mt-2" />
        </div>
      ))}
    </div>
  )
}
