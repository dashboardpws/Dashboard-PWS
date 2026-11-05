/**
 * Tab "Riwayat Submit Form" di halaman Laporan.
 *
 * Berbeda dengan tab Kunjungan Rumah — yang soal cakupan warga — tab ini soal
 * "form mana yang sudah diisi". Karena `surveys` tidak punya kolom penanda form,
 * setiap baris mengambil nama form-nya lewat join `form_versions → forms` di
 * server, jadi record form buatan Form Builder tampil dengan nama formnya sendiri
 * dan tidak pernah dibaca sebagai kunjungan rumah.
 *
 * Detail jawaban diambil saat baris diklik (`getDetailSubmit`), bukan saat halaman
 * dimuat: daftar 200 baris dengan seluruh jawabannya terlalu banyak untuk dibuka
 * tanpa sengaja.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Eye, Loader2 } from 'lucide-react'
import { DataTable } from '@/components/shared'
import { Td, Tr } from '@/components/shared/DataTable'
import {
  DateRange,
  KelurahanSelect,
  SectionCard,
  Toolbar,
  Button,
  Input,
  Select,
} from '@/components/ui'
import { FilterToolbar } from './FilterToolbar'
import { paginate } from '@/lib/laporan/report-shared'
import { getDetailSubmit, getRiwayatSubmit } from '@/lib/api/server-fns'
import type { BarisRiwayatSubmit, JsonNilai } from '@/lib/server/submit.server'
import { formatNilaiJawaban } from '@/lib/survey/format-jawaban'
import { fmtDate } from '@/lib/utils'
import { PAGE_SIZE } from '@/lib/constants'

type BarisRiwayat = BarisRiwayatSubmit

interface JawabanSubmit {
  fieldId: string
  nama: string
  label: string
  tipe: string
  urutan: number
  value: JsonNilai
  opsi: Array<{ value: string; label: string | null }>
}

interface Props {
  /** Muat saat mount. Loader laporan memuat ini paralel dengan yang lain. */
  rows: BarisRiwayat[]
  formList: Array<{ formId: number; nama: string; jumlahSubmit: number }>
  loading: boolean
  error: string | null
  defaultDari?: string
  defaultSampai?: string
  defaultKel?: string
}

function Nik({ nik, nama }: { nik: string | null; nama: string }) {
  if (!nik) return <span className="text-muted">Tanpa warga</span>
  return (
    <div>
      <div className="font-semibold text-ink">{nama}</div>
      <div className="text-muted">NIK {nik}</div>
    </div>
  )
}

/** Panel detail: semua jawaban satu submit, dengan label field yang tampil. */
function DetailSubmit({
  surveyId,
  onClose,
}: {
  surveyId: string
  onClose: () => void
}) {
  const [data, setData] = useState<{
    row: {
      formNama: string
      formVersion: number
      tanggal: string
      petugas: string
    } | null
    answers: JawabanSubmit[]
  } | null>(null)
  const [busy, setBusy] = useState(true)
  const [gagal, setGagal] = useState<string | null>(null)

  // Fetch tiap `surveyId` berubah: panel ini dipake ulang untuk baris lain tanpa
  // ditutup, jadi jawaban baris sebelumnya harus dibuang lebih dulu.
  // Id yang sedang diminta. Panel dipakai ulang untuk baris lain tanpa ditutup,
  // jadi jawaban yang telat datang dari baris lama harus dibuang — membandingkan
  // dengan ref ini, bukan flag lokal, karena penugasan flag di dalam cleanup
  // selalu terbaca "benar" oleh analisis lint.
  const diminta = useRef(surveyId)
  diminta.current = surveyId

  useEffect(() => {
    setBusy(true)
    setGagal(null)
    setData(null)
    void (async () => {
      try {
        const hasil = await getDetailSubmit({ data: { surveyId } })
        if (diminta.current !== surveyId) return
        setData(hasil)
      } catch (err) {
        if (diminta.current !== surveyId) return
        setGagal(
          err instanceof Error ? err.message : 'Gagal memuat isian form.',
        )
      } finally {
        if (diminta.current === surveyId) setBusy(false)
      }
    })()
  }, [surveyId])

  return (
    <SectionCard
      title={data ? `Isian ${data.row?.formNama ?? 'form'}` : 'Detail isian'}
      sub={
        data?.row
          ? `Tanggal ${fmtDate(data.row.tanggal)} · petugas ${data.row.petugas}`
          : 'Memuat jawaban…'
      }
      actions={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Tutup detail
        </Button>
      }
    >
      {busy ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat isian…
        </p>
      ) : gagal ? (
        <p className="text-[12.5px] font-semibold text-danger">{gagal}</p>
      ) : data && data.answers.length > 0 ? (
        <div className="grid gap-2">
          {data.answers.map((a) => {
            const hasil = formatNilaiJawaban({
              tipe: a.tipe,
              value: a.value,
              opsi: a.opsi,
            })
            return (
              <div
                key={a.fieldId}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {a.label}
                </div>
                <div className="text-[13px] text-ink">
                  {hasil.kosong ? (
                    <span className="text-muted">Belum diisi</span>
                  ) : (
                    hasil.teks
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="py-4 text-sm text-muted">
          Submit ini tidak menyimpan jawaban apa pun.
        </p>
      )}
    </SectionCard>
  )
}

export function RiwayatSubmitSection({
  rows,
  formList,
  loading,
  error,
  defaultDari,
  defaultSampai,
  defaultKel,
}: Props) {
  const [formId, setFormId] = useState<number | 'all'>('all')
  const [cari, setCari] = useState('')
  const [page, setPage] = useState(1)
  const [terbuka, setTerbuka] = useState<string | null>(null)
  const [dari, setDari] = useState(defaultDari ?? '2026-01-01')
  const [sampai, setSampai] = useState(defaultSampai ?? '2026-12-31')
  const [kel, setKel] = useState(defaultKel ?? 'all')

  const [terfilter, setTerfilter] = useState<BarisRiwayat[]>(rows)
  const [gagalMuat, setGagalMuat] = useState<string | null>(null)

  // Form yang sedang dimuat; jawaban yang telat datang dari filter lama dibuang.
  const dimintaForm = useRef(formId)
  dimintaForm.current = formId

  // Baris "semua form" sudah ikut loader, jadi tidak perlu fetch lagi. Ganti
  // filter form memanggil server sendiri supaya halaman tidak ikut dimuat ulang
  // (loader juga memuat laporan kunjungan dan kegiatan).
  useEffect(() => {
    if (formId === 'all') {
      setTerfilter(rows)
      return
    }
    void (async () => {
      try {
        const hasil = await getRiwayatSubmit({ data: { formId } })
        if (dimintaForm.current !== formId) return
        setTerfilter(hasil)
        setGagalMuat(null)
      } catch (err) {
        if (dimintaForm.current !== formId) return
        setTerfilter([])
        setGagalMuat(
          err instanceof Error ? err.message : 'Gagal memuat riwayat form ini.',
        )
      }
    })()
  }, [formId, rows])

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    let filtered = terfilter

    // Filter by date range
    filtered = filtered.filter((r) => r.tanggal >= dari && r.tanggal <= sampai)

    // Filter by kelurahan
    if (kel !== 'all') {
      filtered = filtered.filter((r) => r.kelurahan === kel)
    }

    if (!q) return filtered
    return filtered.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.formNama.toLowerCase().includes(q) ||
        (r.nik ?? '').includes(q) ||
        (r.nikKk ?? '').includes(q) ||
        r.petugas.toLowerCase().includes(q),
    )
  }, [terfilter, cari, dari, sampai, kel])

  const { maxPage, pageClamped, pageRows, info } = paginate(
    hasil,
    page,
    PAGE_SIZE,
  )

  return (
    <>
      <FilterToolbar
        title="Saring Riwayat Submit"
        sub="Semua form yang sudah diisi petugas, termasuk form buatan Form Builder."
      >
        <DateRange
          dari={dari}
          sampai={sampai}
          onDari={setDari}
          onSampai={setSampai}
        />
        <KelurahanSelect value={kel} onChange={setKel} />
        <Select
          value={String(formId)}
          onChange={(e) => {
            setFormId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            setPage(1)
          }}
          aria-label="Filter form"
          className="max-w-52.5 max-md:max-w-none"
        >
          <option value="all">Semua form</option>
          {formList.map((f) => (
            <option key={f.formId} value={f.formId}>
              {f.nama} ({f.jumlahSubmit})
            </option>
          ))}
        </Select>
        <Input
          value={cari}
          onChange={(e) => {
            setCari(e.target.value)
            setPage(1)
          }}
          placeholder="Cari form / nama / NIK…"
          aria-label="Cari isian"
          className="max-w-50 max-md:max-w-none"
        />
      </FilterToolbar>

      {terbuka ? (
        <DetailSubmit surveyId={terbuka} onClose={() => setTerbuka(null)} />
      ) : null}

      <SectionCard
        className="no-print"
        title="Riwayat Submit Form"
        sub="Klik baris untuk melihat seluruh jawaban isian."
      >
        {loading ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Memuat riwayat submit…
          </p>
        ) : (error ?? gagalMuat) ? (
          <p className="px-1 py-6 text-center text-sm font-semibold text-danger">
            {error ?? gagalMuat}
          </p>
        ) : hasil.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Belum ada submit untuk filter ini. Isi form lewat halaman Isi
            Formulir.
          </p>
        ) : (
          <DataTable
            columns={[
              { key: 'tgl', label: 'Tanggal' },
              { key: 'form', label: 'Form' },
              { key: 'warga', label: 'Warga' },
              { key: 'petugas', label: 'Petugas' },
              { key: 'jml', label: 'Jawaban' },
              { key: 'aksi', label: '' },
            ]}
            rows={pageRows}
            renderRow={(r) => (
              <Tr key={r.id} className="truncate">
                <Td className="whitespace-nowrap">{fmtDate(r.tanggal)}</Td>
                <Td>
                  <div className="font-semibold text-ink">{r.formNama}</div>
                  <div className="text-muted">Versi {r.formVersion}</div>
                </Td>
                <Td>
                  <Nik nik={r.nikKk ?? r.nik} nama={r.nama} />
                </Td>
                <Td className="text-muted">{r.petugas}</Td>
                <Td className="text-muted">{r.jumlahJawaban}</Td>
                <Td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTerbuka(r.id)}
                    aria-label={`Lihat isian ${r.formNama}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Td>
              </Tr>
            )}
            toolbar={
              <Toolbar>
                <span className="ml-auto text-xs font-semibold text-muted">
                  {hasil.length} submit
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
    </>
  )
}
