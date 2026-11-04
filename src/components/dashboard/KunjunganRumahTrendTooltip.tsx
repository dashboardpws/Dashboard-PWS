import type { TooltipPayloadEntry } from 'recharts'
import { cn } from '@/lib/utils'
import type { MonthlyKunjunganRumahStat } from '@/lib/kunjungan-rumah/dashboard'

interface KegiatanTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<TooltipPayloadEntry>
  label?: string | number
  onOpenDetails?: (month: string) => void
}

export function KunjunganRumahTrendTooltip({
  active,
  payload,
  label,
}: KegiatanTooltipProps) {
  if (!active || !payload || !label) return null

  const entry = payload[0]?.payload as MonthlyKunjunganRumahStat | undefined
  if (!entry) return null

  const { totalKunjungan = 0, byPosyandu = [] } = entry

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface p-3 shadow-lg min-w-50',
        'animate-slide-down',
      )}
    >
      {/* Header Bulan */}
      <div className="font-semibold text-ink text-xs mb-2 pb-1 border-b border-line">
        {label}{' '}
      </div>

      {/* Total Kunjungan */}
      <div className="flex justify-between items-center text-[12px] mb-2 font-medium">
        <span className="text-muted">Total kunjungan rumah</span>
        <span className="text-ink font-semibold">{totalKunjungan}</span>
      </div>

      {/* Breakdown Per Puskesmas / Posyandu */}
      {byPosyandu.length > 0 && (
        <div className="border-t border-line pt-2 space-y-1">
          {byPosyandu.map(({ nama, count }) => (
            <div
              key={nama}
              className="flex justify-between items-center text-[11px]"
            >
              <span className="text-muted">{nama}</span>
              <span className="font-medium text-ink">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
