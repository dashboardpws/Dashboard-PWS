import type { TooltipPayloadEntry } from 'recharts'
import { cn } from '@/lib/utils'
import type { MonthlyKegiatanStat } from '@/hooks/dashboard/use-kegiatan-trend'

interface KegiatanTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<TooltipPayloadEntry>
  label?: string | number
}

export function KegiatanTooltip({
  active,
  payload,
  label,
}: KegiatanTooltipProps) {
  if (!active || !payload || !label) return null

  const entry = payload[0]?.payload as MonthlyKegiatanStat | undefined
  if (!entry) return null

  // Fallback ke array kosong jika byJenis undefined/null dari backend atau fill item
  const { totalKegiatan = 0, byJenis = [] } = entry

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface p-3 shadow-lg min-w-[200px]',
        'animate-slide-down',
      )}
    >
      {/* Header Bulan */}
      <div className="font-semibold text-ink text-xs mb-2 pb-1 border-b border-line">
        {label}{' '}
      </div>

      {/* Total Kunjungan */}
      <div className="flex justify-between items-center text-[12px] mb-2 font-medium">
        <span className="text-muted">Total Kunjungan</span>
        <span className="text-ink font-semibold">{totalKegiatan}</span>
      </div>

      {/* Breakdown Per Puskesmas / Posyandu */}
      {byJenis.length > 0 && (
        <div className="border-t border-line pt-2 space-y-1">
          {byJenis.map(({ jenis, count }) => (
            <div
              key={jenis}
              className="flex justify-between items-center text-[11px]"
            >
              <span className="text-muted capitalize">{jenis}</span>
              <span className="font-medium text-ink">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}