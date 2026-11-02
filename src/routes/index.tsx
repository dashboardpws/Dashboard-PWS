import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RoutePending } from '@/components/ui/RoutePending'
import { getDashboardData } from '@/lib/api/server-fns'
import { fmtDate } from '@/lib/utils'
import { PAGE_SIZE } from '@/lib/constants'
import { requireAuth } from '@/lib/auth/auth'
import { AppShell } from '@/components/layout'
import {
  DataTable,
  KelurahanSection,
  PerluPerhatian,
} from '@/components/shared'
import { MobileRow, Td, Tr } from '@/components/shared/DataTable'
import type { SummaryCardData } from '@/components/shared'
import {
  PageHeader,
  SectionCard,
  StatCard,
  Toolbar,
  Select,
  StatusBadge,
} from '@/components/ui'
import { paginate } from '@/lib/laporan/report-shared'
import { useKegiatanTrend } from '@/hooks/dashboard/use-kegiatan-trend'
import { KegiatanTrendChart } from '@/components/dashboard/KegiatanTrendChart'
import { buildWarnings, computePeriod } from '@/lib/dashboard/warning'

export const Route = createFileRoute('/')({
  beforeLoad: requireAuth,
  loader: async () => await getDashboardData(),
  pendingComponent: () => <RoutePending>Memuat dashboard…</RoutePending>,
  component: Dashboard,
})

function Dashboard() {
  const data = Route.useLoaderData()
  const { data: trendData, loading: trendLoading } = useKegiatanTrend()

  const [statusF, setStatusF] = useState('all')
  const [wilayahF, setWilayahF] = useState('all')
  const [sortKey, setSortKey] = useState<string | null>('tgl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const items: SummaryCardData[] = useMemo(
    () =>
      data.kelurahan.map((k) => ({
        name: k.name,
        title: `Kelurahan ${k.name}`,
        jiwa: k.total,
        terlayani: k.dikunjungi,
        pct: k.pct,
        sub: k.sub,
      })),
    [data.kelurahan],
  )

  // Dependency kosong: objek stabil, tidak memicu recompute tiap render
  const period = useMemo(() => computePeriod(), [])

  // Hanya cakupan yang dihitung di dashboard. Jadwal & tindak lanjut membutuhkan
  // seluruh record kunjungan, jadi tidak ditarik di halaman ini — keduanya
  // ditangani di /notifikasi (lihat lib/notifikasi/sumber-warning.ts).
  const warnings = useMemo(
    () =>
      buildWarnings(
        { regions: data.kelurahan },
        { region: wilayahF === 'all' ? undefined : wilayahF },
      ),
    [data.kelurahan, wilayahF],
  )

  const filtered = useMemo(() => {
    const list = data.recent.filter(
      (r) => statusF === 'all' || r.petugas === statusF,
    )
    if (sortKey === 'tgl') {
      list.sort(
        (a, b) =>
          a.tanggal.localeCompare(b.tanggal) * (sortDir === 'asc' ? 1 : -1),
      )
    }
    return list
  }, [data.recent, statusF, sortKey, sortDir])

  const paginated = paginate(filtered, page, PAGE_SIZE)
  const { maxPage, pageClamped, pageRows, info } = paginated

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <AppShell>
      <PageHeader title="Dashboard PWS" />
      <p className="mt-1 text-xs text-muted">
        Periode {fmtDate(period.startDate)} – {fmtDate(period.endDate)} ·{' '}
        {period.daysRemaining} hari tersisa ·{' '}
        {Math.round(period.progress * 100)}% berjalan
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-2">
        <StatCard
          caption="Warga terdata"
          value={data.totals.warga}
          sub="data_warga"
        />
        <StatCard
          caption="Sudah dikunjungi"
          value={data.totals.dikunjungi}
          sub="punya ≥1 isian form"
        />
        <StatCard
          caption="Total isian form"
          value={data.totals.kunjunganRumah}
          sub="baris surveys yang menunjuk warga"
        />
      </div>

      <KelurahanSection items={items} />

      <PerluPerhatian
        warnings={warnings}
        regions={data.kelurahan.map((k) => k.name)}
        region={wilayahF}
        onRegionChange={setWilayahF}
      />

      <SectionCard
        title="Trend Kunjungan Rumah (12 Bulan Terakhir)"
        sub="Klik titik pada grafik untuk melihat laporan kunjungan bulan tersebut di halaman Laporan."
      >
        <KegiatanTrendChart data={trendData} loading={trendLoading} />
      </SectionCard>

      <SectionCard
        title="Isian Form Terbaru"
        sub="50 isian terakhir dari database, dari semua form. Nama form diambil dari form asalnya."
      >
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Belum ada isian form di database. Isi lewat halaman Isi Formulir
            atau jalankan seed.
          </p>
        ) : (
          <DataTable
            className="mt-3.5"
            columns={[
              { key: 'tgl', label: 'Tanggal', sortable: true },
              { key: 'form', label: 'Form' },
              { key: 'kel', label: 'Kelurahan' },
              { key: 'nama', label: 'Sasaran' },
              { key: 'petugas', label: 'Petugas' },
              { key: 'status', label: 'Status' },
              { key: 'aksi', label: 'Aksi' },
            ]}
            rows={pageRows}
            renderRow={(row) => (
              <Tr key={row.id}>
                <Td className="whitespace-nowrap">{fmtDate(row.tanggal)}</Td>
                <Td>
                  <div className="font-semibold text-ink">{row.formNama}</div>
                  <div className="text-muted">Kel. {row.kelurahan}</div>
                </Td>
                <Td>
                  <div className="font-semibold text-ink">{row.nama}</div>
                  <div className="text-[11px] text-muted">
                    {row.nik ? `NIK ${row.nik}` : 'Tanpa warga'}
                  </div>
                </Td>
                <Td className="text-muted">{row.petugas}</Td>
                <Td>
                  <StatusBadge value="Selesai" />
                </Td>
                <Td>
                  {row.nik ? (
                    <Link
                      to="/sasaran/$id"
                      params={{ id: row.nik }}
                      className="text-[11px] font-semibold text-accent hover:text-accent-hover"
                    >
                      Lihat
                    </Link>
                  ) : (
                    <span className="text-[11px] text-muted">—</span>
                  )}
                </Td>
              </Tr>
            )}
            renderMobileRow={(row) => (
              <MobileRow key={row.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{row.nama}</div>
                    <div className="text-[11px] text-muted">
                      Kel. {row.kelurahan}
                    </div>
                  </div>
                  <StatusBadge value="Selesai" />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted">
                    {fmtDate(row.tanggal)}
                  </span>
                  <span className="text-[11px] text-muted">
                    · {row.petugas}
                  </span>
                </div>
                {row.nik ? (
                  <Link
                    to="/sasaran/$id"
                    params={{ id: row.nik }}
                    className="mt-2 inline-flex text-[11px] font-semibold text-accent hover:text-accent-hover"
                  >
                    Lihat Detail
                  </Link>
                ) : null}
              </MobileRow>
            )}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            toolbar={
              <Toolbar>
                <Select
                  value={statusF}
                  onChange={(e) => {
                    setStatusF(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter petugas"
                  className="max-w-52.5"
                >
                  <option value="all">Semua petugas</option>
                  {[...new Set(data.recent.map((r) => r.petugas))].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <span className="ml-auto text-xs font-semibold text-muted">
                  {filtered.length} isian form
                </span>
              </Toolbar>
            }
            info={info}
            page={pageClamped}
            canPrev={pageClamped > 1}
            canNext={pageClamped < maxPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(maxPage, p + 1))}
          />
        )}
      </SectionCard>
    </AppShell>
  )
}
