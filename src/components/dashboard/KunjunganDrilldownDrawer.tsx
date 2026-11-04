import { useEffect, useState } from 'react'
import { Download, Search, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useOverlayClose } from '@/hooks/use-overlay-close'
import { getKunjunganRumahDashboardPage } from '@/lib/api/server-fns'
import { cachedKunjunganRumahDashboardPage } from '@/lib/kunjungan-rumah/dashboard-cache'
import type {
  KunjunganRumahDashboardKategori,
  KunjunganRumahDashboardStatus,
} from '@/lib/kunjungan-rumah/dashboard'
import type { KunjunganRumahRecord } from '@/lib/kunjungan-rumah/types'
import { downloadCsv } from '@/lib/utils'

interface Props {
  month: string
  onClose: () => void
}

const PAGE_SIZE = 10
const PAGE_CATEGORIES: Array<{
  value: KunjunganRumahDashboardKategori
  label: string
}> = [
  { value: 'all', label: 'Semua kategori' },
  { value: 'balita', label: 'Balita' },
  { value: 'ibu-hamil', label: 'Ibu hamil' },
  { value: 'lansia', label: 'Lansia' },
]

function monthLabel(month: string) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
}

function categoryLabel(record: KunjunganRumahRecord) {
  const keys = [...new Set(record.penilaian.map((item) => item.sasaran))]
  return keys.length ? keys.join(', ') : '—'
}

function hasRisk(record: KunjunganRumahRecord) {
  return record.masalah.some((item) => item.masalah || item.tindakLanjut)
}

function statusLabel(record: KunjunganRumahRecord) {
  if (record.masalah.some((item) => item.tindakLanjut))
    return 'Ada tindak lanjut'
  return hasRisk(record) ? 'Perlu pendampingan' : 'Selesai'
}

export function KunjunganDrilldownDrawer({ month, onClose }: Props) {
  useOverlayClose(true, onClose)
  const [records, setRecords] = useState<KunjunganRumahRecord[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    flagged: 0,
    followedUp: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] =
    useState<KunjunganRumahDashboardKategori>('all')
  const [risk, setRisk] = useState<KunjunganRumahDashboardStatus>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let aktif = true
    setLoading(true)
    setError(null)
    const input = { month, page, search, category, status: risk }
    void cachedKunjunganRumahDashboardPage(input, () =>
      getKunjunganRumahDashboardPage({ data: input }),
    )
      .then((result) => {
        if (!aktif) return
        setRecords(result.records)
        setSummary(result.summary)
        setTotal(result.total)
      })
      .catch((err: unknown) => {
        if (!aktif) return
        setRecords([])
        setTotal(0)
        setError(
          err instanceof Error ? err.message : 'Gagal memuat kunjungan rumah',
        )
      })
      .finally(() => {
        if (aktif) setLoading(false)
      })
    return () => {
      aktif = false
    }
  }, [month, page, search, category, risk])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = records

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label="Tutup detail kunjungan"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Detail kunjungan rumah ${monthLabel(month)}`}
        className="absolute inset-y-0 right-0 flex w-full max-w-[70vw] flex-col overflow-hidden border-l border-line bg-surface shadow-elev max-md:max-w-full"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">
              Detail Kunjungan Rumah
            </h2>
            <p className="mt-1 text-xs text-muted">
              Periode: {monthLabel(month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {[
              ['Total kunjungan tersimpan', summary.total],
              ['Kunjungan dengan masalah', summary.flagged],
              ['Memiliki tindak lanjut', summary.followedUp],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-line bg-surface-2 p-3"
              >
                <div className="text-[11px] text-muted">{label}</div>
                <div className="mt-1 text-xl font-bold text-ink">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <label className="relative min-w-56 flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Cari nama KK atau NIK"
                aria-label="Cari nama KK atau NIK"
                className="w-full rounded-md border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink"
              />
            </label>
            <select
              value={category}
              onChange={(event) => {
                const selected = PAGE_CATEGORIES.find(
                  (item) => item.value === event.target.value,
                )
                if (selected) setCategory(selected.value)
                setPage(1)
              }}
              aria-label="Filter kategori sasaran"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {PAGE_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={risk}
              onChange={(event) => {
                const status = event.target.value
                if (
                  status === 'all' ||
                  status === 'sehat' ||
                  status === 'berisiko'
                ) {
                  setRisk(status)
                }
                setPage(1)
              }}
              aria-label="Filter status kesehatan"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="all">Semua status</option>
              <option value="sehat">Sehat</option>
              <option value="berisiko">Berisiko</option>
            </select>
            <button
              type="button"
              disabled={!records.length}
              onClick={() =>
                downloadCsv(
                  `kunjungan-rumah-${month}.csv`,
                  [
                    'Nama KK',
                    'NIK',
                    'Alamat',
                    'Tanggal',
                    'Posyandu',
                    'Kader',
                    'Kategori',
                    'Status',
                    'Tindak lanjut',
                  ],
                  records.map((record) => [
                    record.info.namaKK,
                    record.info.nik,
                    record.info.alamat,
                    record.info.tglPengumpulan,
                    record.info.posyandu,
                    record.info.petugasNama,
                    categoryLabel(record),
                    statusLabel(record),
                    record.masalah
                      .map((item) => item.tindakLanjut)
                      .filter(Boolean)
                      .join('; '),
                  ]),
                )
              }
              className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              <Download size={15} /> Ekspor halaman
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
          {loading ? (
            <p className="py-12 text-center text-sm text-muted">
              Memuat data kunjungan…
            </p>
          ) : rows.length ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-190 text-left text-xs">
                <thead className="bg-surface-2 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    {[
                      'Nama KK / Alamat',
                      'Tanggal',
                      'Posyandu / Kader',
                      'Target anggota',
                      'Temuan / tindak lanjut',
                      'Aksi',
                    ].map((head) => (
                      <th key={head} className="px-3 py-3">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((record) => (
                    <tr key={record.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">
                          {record.info.namaKK || 'Tanpa nama'}
                        </div>
                        <div className="mt-1 text-muted">
                          {record.info.alamat || 'Alamat tidak tersedia'}
                        </div>
                        <div className="text-muted">
                          NIK {record.info.nik || '—'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink">
                        {record.info.tglPengumpulan || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-ink">
                          {record.info.posyandu || '—'}
                        </div>
                        <div className="mt-1 text-muted">
                          {record.info.petugasNama || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink">
                        {categoryLabel(record)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">
                          {statusLabel(record)}
                        </div>
                        {record.masalah.map((item) => (
                          <div key={item.id} className="mt-1 text-muted">
                            {item.masalah || item.tindakLanjut}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          to="/kunjungan-rumah/$id"
                          params={{ id: record.id }}
                          className="font-semibold text-accent hover:text-accent-hover"
                        >
                          Lihat form
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted">
              {summary.total
                ? 'Tidak ada kunjungan yang cocok dengan filter.'
                : `Belum ada kunjungan tersimpan pada ${monthLabel(month)}.`}
            </p>
          )}

          {!loading && total > PAGE_SIZE ? (
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>
                {total} kunjungan cocok · halaman {page} dari {pageCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded border border-line px-3 py-1.5 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded border border-line px-3 py-1.5 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
