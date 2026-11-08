import { useMemo, useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RoutePending } from '@/components/ui/RoutePending'
import {
  getFormAdaSubmit,
  getLaporanKunjunganRumah,
  getRiwayatSubmit,
  listKegiatan,
} from '@/lib/api/server-fns'
import type { KegiatanRecord } from '@/hooks/survey/use-kegiatan'
import { formIdOf } from '@/lib/laporan/report-filter'
import { JENIS_KEGIATAN, KELS, PAGE_SIZE, POSY } from '@/lib/constants'
import { downloadCsv, fmtDate, pctOf } from '@/lib/utils'
import { useToast } from '@/providers/toast'
import { AppShell } from '@/components/layout'
import { DataTable } from '@/components/shared'
import { MobileRow, Td, Tr } from '@/components/shared/DataTable'
import {
  DateRange,
  KelurahanSelect,
  PageHeader,
  SectionCard,
  StatCard,
  Input,
  Select,
  StatusBadge,
} from '@/components/ui'
import { requireAuth } from '@/lib/auth/auth'
import { RiwayatSubmitSection } from '@/components/laporan/RiwayatSubmitSection'
import { FilterToolbar } from '@/components/laporan/FilterToolbar'
import { KelStatsGrid } from '@/components/laporan/KelStatsGrid'
import { KopSection } from '@/components/laporan/KopSection'
import { KopSurat } from '@/components/laporan/KopSurat'
import { KopTable } from '@/components/laporan/KopTable'
import { paginate } from '@/lib/laporan/report-shared'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'

// Search param di-narrow dari `unknown` ke `string`. Tanpa return type eksplisit,
// `validateSearch` membuat `period` jadi `{}` dan `period.split` gagal.
function opsiSearch(search: Record<string, unknown>): {
  period: string
  section: string
} {
  return {
    period: typeof search.period === 'string' ? search.period : '',
    section: typeof search.section === 'string' ? search.section : '',
  }
}

export const Route = createFileRoute('/laporan')({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => opsiSearch(search),
  loader: async () => {
    const [kunjunganRumah, kegiatan, riwayatSubmit, formAdaSubmit] =
      await Promise.all([
        getLaporanKunjunganRumah(),
        listKegiatan(),
        getRiwayatSubmit({ data: {} }),
        getFormAdaSubmit(),
      ])
    return { kunjunganRumah, kegiatan, riwayatSubmit, formAdaSubmit }
  },
  pendingComponent: () => <RoutePending>Memuat laporan…</RoutePending>,
  component: Laporan,
})

function Laporan() {
  const {
    kunjunganRumah: rows,
    kegiatan: kegiatanRaw,
    riwayatSubmit,
    formAdaSubmit,
  } = Route.useLoaderData()
  const kegiatanRows = kegiatanRaw as unknown as KegiatanRecord[]
  const toast = useToast()
  const { period, section } = Route.useSearch()

  // Compute date range from period (YYYY-MM) if provided
  const hasPeriod = period !== ''
  // Tanpa `period`, rentang default mengikuti tahun berjalan. Nilai sebelumnya
  // di-hardcode "2026", jadi laporan tanpa `period` diam-diam kosong di 2027.
  const tahunIni = new Date().getFullYear()
  const defaultDari = `${tahunIni}-01-01`
  const defaultSampai = `${tahunIni}-12-31`
  // `noUncheckedIndexedAccess` membuat hasil split bisa `undefined`, jadi
  // `period` yang tidak berbentuk "YYYY-MM" jatuh ke rentang default.
  const [tahun, bulan] = period.split('-').map(Number)
  const periodDari =
    hasPeriod && tahun && bulan
      ? `${tahun}-${bulan.toString().padStart(2, '0')}-01`
      : defaultDari
  const periodSampai =
    hasPeriod && tahun && bulan
      ? (() => {
          // new Date(y, m, 0) = hari terakhir bulan m (m 1-based, 0 mundur ke akhir bulan sebelumnya).
          const lastDay = new Date(tahun, bulan, 0).getDate()
          return `${tahun}-${bulan.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
        })()
      : defaultSampai

  // Common filters (shared by Section 1, 2, 4)
  const [dari, setDari] = useState(periodDari)
  const [sampai, setSampai] = useState(periodSampai)
  const [kel, setKel] = useState('all')

  // Section 1: Isian Form (Kunjungan Rumah)
  const [formId, setFormId] = useState<number | 'all'>('all')
  const [cari, setCari] = useState('')
  const [page, setPage] = useState(1)
  const [judul, setJudul] = useState(
    'LAPORAN KUNJUNGAN RUMAH PWS — KOTA PASURUAN',
  )

  // Section 2: Kegiatan Pemberdayaan
  const [gJenis, setGJenis] = useState('all')
  const [gPosy, setGPosy] = useState('all')
  const [gCari, setGCari] = useState('')
  const [gPage, setGPage] = useState(1)
  const [gJudul, setGJudul] = useState(
    'LAPORAN KEGIATAN PEMBERDAYAAN — KOTA PASURUAN',
  )

  // Shared TTD (empty for physical signature)
  const [ttdNama, setTtdNama] = useState('')
  const [ttdJabatan, setTtdJabatan] = useState('')

  // Auto-expand sections based on URL param
  const [openSection1, setOpenSection1] = useState(
    section !== 'kegiatan' && section !== 'rekap' && section !== 'riwayat',
  )
  const [openSection2, setOpenSection2] = useState(section === 'kegiatan')
  const [openSection4, setOpenSection4] = useState(section === 'riwayat')

  // If period is set, update date range and lock it for Section 2
  useEffect(() => {
    if (hasPeriod) {
      setDari(periodDari)
      setSampai(periodSampai)
    }
  }, [period, periodDari, periodSampai])

  // ========== SECTION 1: Isian Form ==========
  const filtered = useMemo(() => {
    return rows.filter(
      (r) =>
        r.tanggal >= dari &&
        r.tanggal <= sampai &&
        (kel === 'all' || r.kelurahan === kel) &&
        (formId === 'all' || formIdOf(r, formAdaSubmit) === formId) &&
        (!cari ||
          r.nama.toLowerCase().includes(cari.toLowerCase()) ||
          (r.nik ?? '').includes(cari) ||
          (r.nikKk ?? '').includes(cari) ||
          r.formNama.toLowerCase().includes(cari.toLowerCase())),
    )
  }, [rows, dari, sampai, kel, formId, cari, formAdaSubmit])

  const wargaUnik = new Set(
    filtered.map((r) => r.nik).filter((n): n is string => n !== null),
  ).size

  const namaFormFilter =
    formId === 'all'
      ? 'semua form'
      : (formAdaSubmit.find((f) => f.formId === formId)?.nama ?? 'form')

  const kelStats = KELS.map((k) => {
    const sub = filtered.filter((r) => r.kelurahan === k)
    return {
      kel: k,
      n: sub.length,
      pct: pctOf(sub.length, filtered.length),
    }
  })

  const { maxPage, pageClamped, pageRows, info } = paginate(
    filtered,
    page,
    PAGE_SIZE,
  )
  const kopRows = filtered.slice(0, 60)

  const downloadCsvKunjunganRumah = () => {
    const head = [
      'No',
      'Tanggal',
      'Form',
      'Nama',
      'NIK',
      'Kelurahan',
      'Petugas',
    ]
    const csvRows = filtered.map((r, i) => [
      i + 1,
      r.tanggal,
      r.formNama,
      r.nama,
      r.nikKk ?? r.nik ?? '—',
      r.kelurahan,
      r.petugas,
    ])
    downloadCsv('laporan-isian-form.csv', head, csvRows)
    toast('Laporan isian form CSV diunduh.')
  }

  const copySummary = () => {
    const text = [
      `Laporan Kunjungan Rumah PWS — Kota Pasuruan`,
      `Periode ${fmtDate(dari)} – ${fmtDate(sampai)}`,
      `Sumber data: ${namaFormFilter}`,
      `Total ${filtered.length} isian form · ${wargaUnik} warga unik`,
      `${kelStats.map((s) => `Kel. ${s.kel}: ${s.n}`).join(' · ')}`,
    ].join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => toast('Ringkasan laporan disalin.'))
      .catch(() => toast('Gagal menyalin ringkasan.'))
  }

  // ========== SECTION 2: Kegiatan Pemberdayaan ==========
  const filteredKegiatan = useMemo(() => {
    return kegiatanRows.filter(
      (r) =>
        r.tgl >= dari &&
        r.tgl <= sampai &&
        (kel === 'all' || r.kel === kel) &&
        (gJenis === 'all' || r.jenis === gJenis) &&
        (gPosy === 'all' || r.posy === gPosy) &&
        (!gCari ||
          r.nama.toLowerCase().includes(gCari.toLowerCase()) ||
          r.petugas.toLowerCase().includes(gCari.toLowerCase()) ||
          r.lokasi.toLowerCase().includes(gCari.toLowerCase())),
    )
  }, [kegiatanRows, dari, sampai, kel, gJenis, gPosy, gCari])

  const totalKegiatan = filteredKegiatan.length
  const totalPeserta = filteredKegiatan.reduce((a, r) => a + r.total, 0)
  const totalHadir = filteredKegiatan.reduce((a, r) => a + r.hadir, 0)
  const pctHadir = pctOf(totalHadir, totalPeserta)
  const gKelStats = KELS.map((k) => {
    const sub = filteredKegiatan.filter((r) => r.kel === k)
    return {
      kel: k,
      n: sub.length,
      pct: pctOf(sub.length, totalKegiatan),
    }
  })
  const gJenisStats = JENIS_KEGIATAN.map((j) => {
    const sub = filteredKegiatan.filter((r) => r.jenis === j)
    return {
      jenis: j,
      n: sub.length,
      pct: pctOf(sub.length, totalKegiatan),
    }
  })
  const {
    maxPage: gMaxPage,
    pageClamped: gPageClamped,
    pageRows: gPageRows,
    info: gInfo,
  } = paginate(filteredKegiatan, gPage, PAGE_SIZE)
  const gKopRows = filteredKegiatan.slice(0, 60)

  const downloadKegiatanCsv = () => {
    const head = [
      'No',
      'Tanggal',
      'Jam',
      'Nama',
      'Jenis',
      'Kelurahan',
      'Posyandu',
      'Lokasi',
      'Petugas',
      'Target',
      'Hadir',
      'Total',
      'Foto',
      'Deskripsi',
    ]
    const csvRows = filteredKegiatan.map((r, i) => [
      i + 1,
      r.tgl,
      r.jam,
      r.nama,
      r.jenis,
      r.kel,
      r.posy,
      r.lokasi,
      r.petugas,
      r.target,
      r.hadir,
      r.total,
      r.foto,
      r.deskripsi,
    ])
    downloadCsv('laporan-kegiatan.csv', head, csvRows)
    toast('Laporan kegiatan CSV diunduh.')
  }

  const copyKegiatanSummary = () => {
    const text = [
      `Laporan Kegiatan Pemberdayaan — Kota Pasuruan`,
      `Periode ${fmtDate(dari)} – ${fmtDate(sampai)}`,
      `Total ${totalKegiatan} kegiatan · ${totalHadir}/${totalPeserta} hadir (${pctHadir}%)`,
      `${gKelStats.map((s) => `Kel. ${s.kel}: ${s.n}`).join(' · ')}`,
      `${gJenisStats
        .filter((s) => s.n > 0)
        .map((s) => `${s.jenis}: ${s.n}`)
        .join(' · ')}`,
    ].join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => toast('Ringkasan kegiatan disalin.'))
      .catch(() => toast('Gagal menyalin ringkasan.'))
  }

  return (
    <AppShell>
      <PageHeader
        title="Laporan & Export"
        description="Rekap kunjungan rumah, kegiatan pemberdayaan, rekap bulanan, dan riwayat submit form. Semua dalam satu halaman."
      />

      {/* Common Filter Bar */}
      <div data-tour="laporan-filter">
        <SectionCard
          className="no-print"
          title="Filter Umum"
          sub="Filter tanggal dan kelurahan berlaku untuk Isian Form, Kegiatan, dan Riwayat Submit."
        >
          <div className="flex flex-wrap items-end gap-3">
            <DateRange
              dari={dari}
              sampai={sampai}
              onDari={setDari}
              onSampai={setSampai}
            />
            <KelurahanSelect value={kel} onChange={setKel} />
          </div>
        </SectionCard>
      </div>

      {/* SECTION 1: Isian Form (Kunjungan Rumah) */}
      <CollapsibleSection
        title="Isian Form (Kunjungan Rumah)"
        subtitle="Data kunjungan rumah dari form PWS dengan filter form & pencarian"
        open={openSection1}
        onChange={setOpenSection1}
      >
        <FilterToolbar
          title="Saring Laporan"
          sub="Semua form ikut dihitung dan setiap baris diberi nama formnya. Filter ikut memperbarui ringkasan, kop, dan pratinjau di bawah."
        >
          <Select
            value={String(formId)}
            onChange={(e) => {
              setFormId(
                e.target.value === 'all' ? 'all' : Number(e.target.value),
              )
              setPage(1)
            }}
            aria-label="Filter form"
            className="max-w-52.5 max-md:max-w-none"
          >
            <option value="all">Semua form</option>
            {formAdaSubmit.map((f) => (
              <option key={f.formId} value={f.formId}>
                {f.nama} ({f.jumlahSubmit})
              </option>
            ))}
          </Select>
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama / NIK / form…"
            aria-label="Cari nama"
            className="max-w-50 max-md:max-w-none"
          />
        </FilterToolbar>

        <SectionCard
          className="no-print"
          title="Ringkasan"
          sub="Rekap otomatis dari filter di atas."
        >
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2">
            <StatCard caption="Total isian form" value={filtered.length} />
            <StatCard caption="Warga unik" value={wargaUnik} />
            <StatCard
              caption="Kelurahan tercakup"
              value={kelStats.filter((s) => s.n > 0).length}
            />
          </div>
          <KelStatsGrid stats={kelStats} unit="isian" />
        </SectionCard>

        <KopSection
          title="Kop Laporan"
          sub="Atur judul & penanda tangan, lalu cetak / unduh."
          judul={judul}
          setJudul={setJudul}
          judulLabel="Judul laporan"
          ttdNama={ttdNama}
          setTtdNama={setTtdNama}
          ttdJabatan={ttdJabatan}
          setTtdJabatan={setTtdJabatan}
          countText={
            <>
              {filtered.length} baris · 1–{Math.min(kopRows.length, 60)}{' '}
              ditampilkan di kop.
            </>
          }
          onDownloadCsv={downloadCsvKunjunganRumah}
          onCopySummary={copySummary}
        />

        <KopSurat
          judul={judul}
          subtitle={
            <>
              Periode {fmtDate(dari)} – {fmtDate(sampai)} · {namaFormFilter} ·{' '}
              {filtered.length} isian form · {wargaUnik} warga
            </>
          }
          ttdNama={ttdNama}
          ttdJabatan={ttdJabatan}
        >
          <KopTable
            headers={[
              'No',
              'Tanggal',
              'Form',
              'Nama',
              'Wilayah',
              'Petugas',
              'Status',
            ]}
            colSpan={7}
            emptyMessage="Tidak ada data untuk filter ini."
            rows={kopRows}
            renderRow={(r, i) => (
              <tr
                key={r.id}
                className="border-b border-surface-2 last:border-none"
              >
                <td className="px-2.5 py-2">{i + 1}</td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  {fmtDate(r.tanggal)}
                </td>
                <td className="px-2.5 py-2">
                  <div className="font-semibold truncate">{r.formNama}</div>
                  <div className="text-muted">Versi {r.formVersion}</div>
                </td>
                <td className="px-2.5 py-2">
                  <div className="font-semibold truncate">{r.nama}</div>
                  <div className="text-muted truncate">
                    {(r.nikKk ?? r.nik)
                      ? `NIK ${r.nikKk ?? r.nik}`
                      : 'Tanpa warga'}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  Kel. {r.kelurahan}
                </td>
                <td className="px-2.5 py-2 text-muted truncate">{r.petugas}</td>
                <td className="px-2.5 py-2">
                  <StatusBadge value="Selesai" />
                </td>
              </tr>
            )}
          />
        </KopSurat>

        <SectionCard
          className="no-print"
          title="Pratinjau Data"
          sub="Lihat daftar lengkap dengan navigasi halaman."
        >
          {filtered.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted">
              Belum ada isian form di database untuk filter ini.
            </p>
          ) : (
            <DataTable
              columns={[
                { key: 'no', label: 'No' },
                { key: 'tgl', label: 'Tanggal' },
                { key: 'form', label: 'Form' },
                { key: 'nama', label: 'Nama' },
                { key: 'wilayah', label: 'Wilayah' },
                { key: 'petugas', label: 'Petugas' },
                { key: 'status', label: 'Status' },
              ]}
              rows={pageRows}
              renderRow={(r, i) => (
                <Tr key={r.id}>
                  <Td>{(pageClamped - 1) * PAGE_SIZE + i + 1}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.tanggal)}</Td>
                  <Td>
                    <div className="font-semibold text-ink">{r.formNama}</div>
                    <div className="text-[11px] text-muted">
                      Versi {r.formVersion}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-semibold text-ink">{r.nama}</div>
                    <div className="text-[11px] text-muted">
                      {(r.nikKk ?? r.nik)
                        ? `NIK ${r.nikKk ?? r.nik}`
                        : 'Tanpa warga'}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">Kel. {r.kelurahan}</Td>
                  <Td className="text-muted">{r.petugas}</Td>
                  <Td>
                    <StatusBadge value="Selesai" />
                  </Td>
                </Tr>
              )}
              renderMobileRow={(r) => (
                <MobileRow key={r.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{r.formNama}</div>
                      <div className="text-[11px] text-muted">{r.nama}</div>
                    </div>
                    <StatusBadge value="Selesai" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted">
                      {fmtDate(r.tanggal)}
                    </span>
                    <span className="text-[11px] text-muted">
                      · {r.petugas}
                    </span>
                    {r.kelurahan !== '—' ? (
                      <span className="text-[11px] text-muted">
                        · Kel. {r.kelurahan}
                      </span>
                    ) : null}
                  </div>
                </MobileRow>
              )}
              toolbar={
                <span className="text-xs font-semibold text-muted">
                  Menampilkan {filtered.length} isian form · {wargaUnik} warga
                  unik
                </span>
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
      </CollapsibleSection>

      {/* SECTION 2: Kegiatan Pemberdayaan */}
      <CollapsibleSection
        title="Kegiatan Pemberdayaan"
        subtitle="Data kegiatan dari halaman Kegiatan dengan filter jenis, posyandu, pencarian"
        open={openSection2}
        onChange={setOpenSection2}
      >
        <FilterToolbar
          title="Saring Kegiatan"
          sub="Filter ikut memperbarui ringkasan, kop, dan tabel rekap kegiatan."
        >
          <Select
            value={gJenis}
            onChange={(e) => setGJenis(e.target.value)}
            aria-label="Filter jenis kegiatan"
            className="max-w-42.5 max-md:max-w-none"
          >
            <option value="all">Semua jenis</option>
            {JENIS_KEGIATAN.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </Select>
          <Select
            value={gPosy}
            onChange={(e) => setGPosy(e.target.value)}
            aria-label="Filter posyandu"
            className="max-w-42.5 max-md:max-w-none"
          >
            <option value="all">Semua posyandu</option>
            {POSY.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Input
            value={gCari}
            onChange={(e) => setGCari(e.target.value)}
            placeholder="Cari nama/PJ/lokasi…"
            aria-label="Cari kegiatan"
            className="max-w-50 max-md:max-w-none"
          />
        </FilterToolbar>

        <SectionCard
          className="no-print"
          title="Ringkasan Kegiatan"
          sub="Rekap otomatis dari filter kegiatan di atas."
        >
          <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
            <StatCard caption="Total kegiatan" value={totalKegiatan} />
            <StatCard caption="Total peserta" value={totalPeserta} />
            <StatCard caption="Total hadir" value={totalHadir} />
            <StatCard
              caption="Kehadiran"
              value={`${pctHadir}%`}
              progress={pctHadir}
            />
          </div>
          <KelStatsGrid stats={gKelStats} unit="kegiatan" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {gJenisStats
              .filter((s) => s.n > 0)
              .map((s) => (
                <span
                  key={s.jenis}
                  className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted"
                >
                  {s.jenis}: {s.n}
                </span>
              ))}
            {gJenisStats.filter((s) => s.n > 0).length === 0 ? (
              <span className="text-[11px] text-muted">
                Belum ada kegiatan.
              </span>
            ) : null}
          </div>
        </SectionCard>

        <KopSection
          title="Kop Laporan Kegiatan"
          sub="Atur judul & penanda tangan, lalu cetak / unduh CSV terpisah."
          judul={gJudul}
          setJudul={setGJudul}
          judulLabel="Judul laporan kegiatan"
          ttdNama={ttdNama}
          setTtdNama={setTtdNama}
          ttdJabatan={ttdJabatan}
          setTtdJabatan={setTtdJabatan}
          countText={
            <>
              {filteredKegiatan.length} kegiatan · 1–
              {Math.min(gKopRows.length, 60)} ditampilkan di kop.
            </>
          }
          csvLabel="Unduh CSV Kegiatan"
          onDownloadCsv={downloadKegiatanCsv}
          onCopySummary={copyKegiatanSummary}
        />

        <KopSurat
          judul={gJudul}
          subtitle={
            <>
              Periode {fmtDate(dari)} – {fmtDate(sampai)} ·{' '}
              {filteredKegiatan.length} kegiatan · {totalHadir}/{totalPeserta}{' '}
              hadir ({pctHadir}%)
            </>
          }
          ttdNama={ttdNama}
          ttdJabatan={ttdJabatan}
        >
          <KopTable
            headers={[
              'No',
              'Tanggal',
              'Nama Kegiatan',
              'Wilayah',
              'Petugas',
              'Peserta',
              'Deskripsi',
            ]}
            colSpan={7}
            emptyMessage="Belum ada kegiatan untuk filter ini. Isi di halaman Kegiatan."
            rows={gKopRows}
            renderRow={(r, i) => (
              <tr
                key={i}
                className="border-b border-surface-2 last:border-none"
              >
                <td className="px-2.5 py-2">{i + 1}</td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  {fmtDate(r.tgl)} {r.jam ? `· ${r.jam}` : ''}
                </td>
                <td className="px-2.5 py-2">
                  <div className="font-semibold">{r.nama}</div>
                  <div className="text-muted">{r.jenis}</div>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  Kel. {r.kel} {r.posy ? `· ${r.posy}` : ''} · {r.lokasi}
                </td>
                <td className="px-2.5 py-2">{r.petugas}</td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  {r.hadir}/{r.total}
                </td>
                <td className="px-2.5 py-2 text-muted">{r.deskripsi || '—'}</td>
              </tr>
            )}
          />
        </KopSurat>

        <SectionCard
          className="no-print"
          title="Tabel Rekap Kegiatan"
          sub="Data dari halaman Kegiatan, tetap kosong sampai user input. Hadir/total ringkas."
        >
          <DataTable
            columns={[
              { key: 'no', label: 'No' },
              { key: 'tgl', label: 'Tanggal' },
              { key: 'nama', label: 'Nama & jenis' },
              { key: 'wilayah', label: 'Wilayah' },
              { key: 'petugas', label: 'Petugas' },
              { key: 'peserta', label: 'Peserta' },
              { key: 'deskripsi', label: 'Deskripsi' },
            ]}
            rows={gPageRows}
            emptyMessage="Belum ada kegiatan untuk filter ini. Isi di halaman Kegiatan."
            renderRow={(r, i) => (
              <Tr key={i} className="truncate">
                <Td>{(gPageClamped - 1) * PAGE_SIZE + i + 1}</Td>
                <Td className="whitespace-nowrap">
                  {fmtDate(r.tgl)} <span className="text-muted">{r.jam}</span>
                </Td>
                <Td>
                  <div className="font-semibold text-ink">{r.nama}</div>
                  <div className="text-[11px] text-muted">{r.jenis}</div>
                </Td>
                <Td>
                  <div>
                    Kel. {r.kel} {r.posy ? `· ${r.posy}` : ''}
                  </div>
                  <div className="text-[11px] text-muted">{r.lokasi}</div>
                </Td>
                <Td>{r.petugas}</Td>
                <Td className="whitespace-nowrap">
                  {r.hadir}/{r.total}
                  <div className="text-[11px] text-muted">{r.foto} foto</div>
                </Td>
                <Td className="max-w-50 truncate text-muted">
                  {r.deskripsi || '—'}
                </Td>
              </Tr>
            )}
            renderMobileRow={(r, i) => (
              <MobileRow key={i}>
                <div className="font-semibold text-ink">{r.nama}</div>
                <div className="text-[11px] text-muted">
                  {r.jenis} · {fmtDate(r.tgl)} {r.jam}
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Kel. {r.kel} {r.posy ? `· ${r.posy}` : ''} · {r.lokasi}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">
                    Petugas: {r.petugas}
                  </span>
                  <span className="text-[11px] text-muted">
                    {r.hadir}/{r.total} hadir · {r.foto} foto
                  </span>
                </div>
                {r.deskripsi ? (
                  <div className="mt-1 text-[11px] text-muted truncate">
                    {r.deskripsi}
                  </div>
                ) : null}
              </MobileRow>
            )}
            toolbar={
              <span className="text-xs font-semibold text-muted">
                Menampilkan {filteredKegiatan.length} kegiatan · {totalHadir}/
                {totalPeserta} hadir ({pctHadir}%)
              </span>
            }
            info={gInfo}
            page={gPageClamped}
            canPrev={gPageClamped > 1}
            canNext={gPageClamped < gMaxPage}
            onPrev={() => setGPage((p) => Math.max(1, p - 1))}
            onNext={() => setGPage((p) => Math.min(gMaxPage, p + 1))}
          />
        </SectionCard>
      </CollapsibleSection>

      {/* SECTION 4: Riwayat Submit Form (Audit Trail) */}
      <CollapsibleSection
        title="Riwayat Submit Form (Audit Trail)"
        subtitle="Log submit form builder dengan detail jawaban per submit"
        open={openSection4}
        onChange={setOpenSection4}
      >
        <RiwayatSubmitSection
          rows={riwayatSubmit}
          formList={formAdaSubmit}
          loading={false}
          error={null}
          defaultDari={dari}
          defaultSampai={sampai}
          defaultKel={kel}
        />
      </CollapsibleSection>
    </AppShell>
  )
}
