import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'

export interface SummaryCardData {
  name: string
  title: string
  jiwa: number
  terlayani: number
  pct: number
  sub: string
  bg?: string
  barColor?: string
}

export interface KelurahanSectionProps {
  items: SummaryCardData[]
  emptyMessage?: ReactNode
  /** Kalau diisi, kartu menjadi tombol yang membuka detail kelurahan. */
  onSelect?: (name: string) => void
}

export function KelurahanSection({
  items,
  emptyMessage,
  onSelect,
}: KelurahanSectionProps) {
  if (items.length === 0) {
    return (
      <section className="mt-5">
        <EmptyState>
          {emptyMessage ??
            'Tidak ada kelurahan aktif — aktifkan di Atur Kelurahan.'}
        </EmptyState>
      </section>
    )
  }
  return (
    <section className="mt-5">
      <div className="grid grid-cols-4 gap-3.5 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1">
        {items.map((d) => {
          const card = (
            <StatCard
              caption={d.title}
              value={`${d.pct}%`}
              sub={d.sub}
              progress={d.pct}
              barColor={d.barColor}
              className={
                onSelect
                  ? 'h-full transition-colors hover:border-accent'
                  : undefined
              }
            />
          )
          return onSelect ? (
            <button
              key={d.name}
              type="button"
              onClick={() => onSelect(d.name)}
              aria-label={`Lihat status prioritas ${d.title}`}
              className="min-w-0 rounded-[10px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {card}
            </button>
          ) : (
            <div key={d.name}>{card}</div>
          )
        })}
      </div>
    </section>
  )
}
