import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { EmptyState, HistoryRow, Pill } from '@/components/ui'
import {
  SEVERITY_META,
  WARNING_TYPE_ICON,
  WARNING_TYPE_LABEL,
} from '@/components/dashboard/severity'
import { warningTarget } from '@/lib/dashboard/warning'
import type { Warning } from '@/lib/dashboard/warning'
import { cn } from '@/lib/utils'

export interface NotifikasiListProps {
  warnings: Warning[]
  /** Kosong setelah user menekan "Tandai sudah dibaca". */
  kosong?: ReactNode
  /** Menghilangkan deskripsi panjang; dipakai dropdown lonceng yang sempit. */
  ringkas?: boolean
  className?: string
}

/**
 * Daftar warning yang dipakai dua tempat: dropdown lonceng Topbar dan halaman
 * notifikasi. Satu komponen supaya tampilan dan urutan tidak bisa berbeda antara
 * keduanya.
 *
 * Setiap baris adalah link ke data yang memicu warning itu — `warningTarget()`
 * yang menentukan tujuannya, sama seperti kartu "Perlu Perhatian" di dashboard.
 */
export function NotifikasiList({
  warnings,
  kosong,
  ringkas,
  className,
}: NotifikasiListProps) {
  if (warnings.length === 0) {
    return (
      <EmptyState className={className}>
        {kosong ?? 'Tidak ada notifikasi aktif.'}
      </EmptyState>
    )
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {warnings.map((w) => {
        const target = warningTarget(w)
        const Ikon = WARNING_TYPE_ICON[w.type]
        return (
          <li key={w.id}>
            <HistoryRow className="items-start">
              <span
                className="mt-0.5 shrink-0 rounded-md border border-[var(--color-line-2)] bg-surface p-1"
                aria-hidden="true"
              >
                <Ikon size={14} strokeWidth={1.8} className="text-muted" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill
                    variant={SEVERITY_META[w.severity].variant}
                    size="xs"
                    bold
                  >
                    {SEVERITY_META[w.severity].label}
                  </Pill>
                  {!ringkas ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      {WARNING_TYPE_LABEL[w.type]}
                    </span>
                  ) : null}
                </div>
                {/* `search as never`: tipe search TanStack Router per-route; sempit di sini
                    karena target ditentukan dinamis oleh warningTarget */}
                <Link
                  to={target.to}
                  search={target.search as never}
                  hash={target.hash}
                  className="mt-0.5 block font-semibold text-ink hover:underline"
                >
                  {w.title}
                </Link>
                {w.description && !ringkas ? (
                  <div className="text-[11px] text-muted">{w.description}</div>
                ) : null}
              </div>

              {w.region ? (
                <Pill
                  variant="pending"
                  shape="pill"
                  size="xs"
                  className="mt-0.5 shrink-0"
                >
                  {w.region}
                </Pill>
              ) : null}
            </HistoryRow>
          </li>
        )
      })}
    </ul>
  )
}
