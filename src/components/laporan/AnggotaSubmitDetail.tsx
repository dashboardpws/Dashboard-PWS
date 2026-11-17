/**
 * Daftar ART untuk satu submit, dipakai collapse "Pratinjau Data" di `/laporan`.
 *
 * Data diambil saat baris dibuka dan di-cache pemanggil, jadi komponen ini hanya
 * menerima tiga keadaan: memuat, gagal, atau hasil (termasuk hasil kosong).
 * Baris form selain Kunjungan Rumah tidak membuka collapse ini sama sekali,
 * karena hanya form itu yang menyimpan ART di `record_legacy`.
 */
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import type { AnggotaRingkas } from '@/lib/laporan/anggota-submit'

interface Props {
  anggota: AnggotaRingkas[] | undefined
  memuat: boolean
  galat: boolean
  onCoba: () => void
}

const KOLOM = ['Nama', 'NIK', 'Tgl lahir', 'JK', 'Hubungan KK']

export function AnggotaSubmitDetail({ anggota, memuat, galat, onCoba }: Props) {
  if (memuat) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted">
        <Loader2 size={13} className="animate-spin" />
        Memuat anggota keluarga…
      </div>
    )
  }
  if (galat) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-1 py-2 text-[11px] text-danger">
        Gagal memuat anggota keluarga.
        <Button variant="ghost" size="sm" onClick={onCoba}>
          Coba lagi
        </Button>
      </div>
    )
  }
  if (!anggota || anggota.length === 0) {
    return (
      <p className="px-1 py-2 text-[11px] text-muted">
        Tidak ada data ART pada isian ini.
      </p>
    )
  }
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold text-muted">
        Anggota keluarga ({anggota.length})
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {KOLOM.map((label) => (
                <th
                  key={label}
                  className="whitespace-nowrap border-b border-line-2 px-2 py-1.5 text-left font-semibold text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {anggota.map((a, i) => (
              <tr
                key={`${a.nik}-${i}`}
                className="border-b border-surface-2 last:border-none"
              >
                <td className="px-2 py-1.5 font-semibold text-ink">
                  {a.nama || '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-muted">
                  {a.nik || '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  {a.tglLahir ? fmtDate(a.tglLahir) : '—'}
                </td>
                <td className="px-2 py-1.5">{a.jk || '—'}</td>
                <td className="px-2 py-1.5">{a.hubKK || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
