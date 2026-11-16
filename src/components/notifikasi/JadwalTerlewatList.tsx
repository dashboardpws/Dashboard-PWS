import { Link } from '@tanstack/react-router'
import { CalendarClock, Pencil } from 'lucide-react'
import { HistoryRow, Pill } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import type { JadwalItem } from '@/lib/dashboard/warning'

interface Props {
  items: JadwalItem[]
}

/**
 * Daftar record kunjungan yang jadwal ulangnya sudah lewat.
 *
 * Warning di atasnya tetap agregat, sehingga daftar ini yang menjadi jembatan
 * ke record sumber. Tombol edit membuka form kunjungan yang sama; setelah
 * disimpan, cache notifikasi diinvalidasi dan warning dihitung ulang.
 */
export function JadwalTerlewatList({ items }: Props) {
  const urut = [...items].sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  return (
    <ul className="space-y-2">
      {urut.map((item) => (
        <li key={item.id}>
          <HistoryRow className="items-start">
            <span
              className="mt-0.5 shrink-0 rounded-md border border-[var(--color-line-2)] bg-surface p-1"
              aria-hidden="true"
            >
              <CalendarClock
                size={14}
                strokeWidth={1.8}
                className="text-muted"
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{item.nama}</span>
                <Pill variant="tindak" size="xs" bold>
                  Terlambat
                </Pill>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {item.nik ? `NIK ${item.nik}` : 'NIK tidak tersedia'} · Kel.{' '}
                {item.kelurahan}
              </div>
              <div className="text-[11px] text-muted">
                Jadwal {fmtDate(item.tanggal)}
              </div>
            </div>

            <Link
              to="/kunjungan-rumah/$id"
              params={{ id: item.id }}
              className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:border-accent hover:text-accent"
            >
              <Pencil size={12} /> Perbarui isian
            </Link>
          </HistoryRow>
        </li>
      ))}
    </ul>
  )
}
