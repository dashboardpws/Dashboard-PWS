import { useMemo, useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'

import { useFasilitas } from '@/hooks/faskes/use-fasilitas'
import {
  NUMBER_FIELDS,
  autoValueOf,
  computeRekap,
  rekapScopeId,
  SASARAN_GROUP_LABELS,
} from '@/lib/laporan/rekap-kunjungan-rumah'
import { useRekapKunjunganRumah } from '@/hooks/laporan/use-rekap-kunjungan-rumah'
import type { RekapField } from '@/hooks/laporan/use-rekap-kunjungan-rumah'
import { useKaderAktif } from '@/hooks/petugas/use-kader-aktif'
import { useToast } from '@/providers/toast'
import { SectionCard } from '@/components/ui/SectionCard'
import { Toolbar } from '@/components/ui/Toolbar'
import { KelurahanSelect } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { KopBrandRow } from './KopBrandRow'
import { TandaTangan } from './TandaTangan'

interface Props {
  judul?: string
  setJudul?: (v: string) => void
  ttdNama: string
  setTtdNama: (v: string) => void
  ttdJabatan: string
  setTtdJabatan: (v: string) => void
  defaultPeriod?: string
  defaultKel?: string
  defaultPosy?: string
  defaultKader?: string
}

const DEFAULT_MONTH = new Date().toISOString().slice(0, 7)

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const

function scopeParts(scopeId: string): {
  kel: string | null
  posy: string | null
  kader: string | null
} {
  const [kel, posy, kader] = scopeId.split('|')
  return { kel: kel || null, posy: posy || null, kader: kader || null }
}

export function RekapKunjunganRumahSection({
  judul = 'REKAPITULASI KUNJUNGAN RUMAH — KOTA PASURUAN',
  setJudul,
  ttdNama,
  setTtdNama,
  ttdJabatan,
  setTtdJabatan,
  defaultPeriod,
  defaultKel,
  defaultPosy,
  defaultKader,
}: Props) {
  const toast = useToast()
  // Daftar kader dari tabel `users`, sama dengan sumber yang dipakai /kelola.
  // `listKaderAktif()` sudah menyaring yang tidak aktif, jadi tidak perlu filter
  // lagi di sini.
  const { staff } = useKaderAktif()
  const { opsi: fasilitas } = useFasilitas()

  const [period, setPeriod] = useState(defaultPeriod ?? DEFAULT_MONTH)
  const [kel, setKel] = useState(defaultKel ?? 'all')
  const [posy, setPosy] = useState(defaultPosy ?? 'all')
  const [kader, setKader] = useState(defaultKader ?? 'all')

  const kaderList = useMemo(() => staff.map((s) => s.nama), [staff])

  const { templates, records, getValue, setValue, clearScope } =
    useRekapKunjunganRumah()
  const opsiPosyandu = [
    ...new Set([
      ...fasilitas.filter((f) => f.tipe === 'Posyandu').map((f) => f.nama),
      ...records.map((r) => r.info.posyandu).filter(Boolean),
    ]),
  ]

  const scopeId = rekapScopeId(
    kel === 'all' ? null : kel,
    posy === 'all' ? null : posy,
    kader === 'all' ? null : kader,
  )

  const { rows } = useMemo(
    () =>
      computeRekap(records, templates, {
        month: period,
        ...scopeParts(scopeId),
        staff,
      }),
    [records, templates, period, scopeId, staff],
  )

  const autoByWeek = useMemo(
    () => new Map(rows.map((r) => [r.minggu, r.auto])),
    [rows],
  )

  const effective = (minggu: number, field: RekapField): string => {
    const override = getValue({ scopeId, period }, minggu, field)
    if (typeof override === 'string' && override !== '') return override
    if (field === 'paraf') return ''
    const auto = autoByWeek.get(minggu)
    return auto ? String(autoValueOf(auto, field)) : '0'
  }

  const onCellChange = (minggu: number, field: RekapField, raw: string) => {
    const value = NUMBER_FIELDS.includes(field)
      ? raw.replace(/[^0-9]/g, '')
      : raw
    setValue({ scopeId, period }, minggu, field, value)
  }

  const hasData = rows.length > 0

  return (
    <>
      <SectionCard
        className="no-print"
        title="Rekap Kunjungan Rumah"
        sub="Minggu dalam bulan. Angka turun otomatis dari data kunjungan rumah; sel boleh diubah manual, tersimpan per periode & wilayah."
      >
        <Toolbar>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Periode bulan"
            className="max-w-42.5 max-md:max-w-none"
          />
          <KelurahanSelect value={kel} onChange={setKel} />
          <Select
            value={posy}
            onChange={(e) => setPosy(e.target.value)}
            aria-label="Filter posyandu"
            className="max-w-42.5 max-md:max-w-none"
          >
            <option value="all">Semua posyandu</option>
            {opsiPosyandu.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select
            value={kader}
            onChange={(e) => setKader(e.target.value)}
            aria-label="Filter kader"
            className="max-w-50 max-md:max-w-none"
          >
            <option value="all">Semua kader</option>
            {kaderList.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              clearScope({ scopeId, period })
              toast(`Nilai manual ${period} direset ke perhitungan otomatis.`)
            }}
          >
            <RotateCcw size={14} />
            Reset manual
          </Button>
        </Toolbar>

        <Input
          value={judul}
          onChange={(e) => setJudul?.(e.target.value)}
          aria-label="Judul laporan"
          className="mt-3 w-full"
        />
        <div className="mt-2 grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Input
            value={ttdNama}
            onChange={(e) => setTtdNama(e.target.value)}
            aria-label="Nama penanda tangan"
          />
          <Input
            value={ttdJabatan}
            onChange={(e) => setTtdJabatan(e.target.value)}
            aria-label="Jabatan penanda tangan"
          />
        </div>
        <Toolbar className="mt-3">
          <Button
            variant="primary"
            onClick={() => window.print()}
            className="ml-auto"
          >
            <Printer size={14} />
            Cetak / Simpan PDF
          </Button>
        </Toolbar>
      </SectionCard>

      <SectionCard title={`Rekap ${period}`} sub={`Periode Bulan ${period}`}>
        <div className="mt-3.5 rounded-lg border border-line bg-surface p-4">
          <KopBrandRow className="mb-4 flex items-start justify-between gap-3 print:hidden" />
          <div className="mb-4 text-center">
            <b className="text-sm text-ink">{judul}</b>
            <div className="mt-1 text-muted">Periode Bulan {period}</div>
          </div>

          {!hasData ? (
            <p className="py-8 text-center text-xs text-muted">
              Tidak ada kunjungan tersimpan pada bulan {period}
              {scopeId !== 'all' ? ' dengan filter wilayah/kader ini' : ''}. Isi
              data di halaman Kunjungan Rumah.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="border border-line bg-surface-2 px-2 py-2 align-middle text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Minggu Ke
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-line bg-surface-2 px-2 py-2 align-middle text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Jumlah Keluarga Dikunjungi
                    </th>
                    <th
                      colSpan={6}
                      className="border border-line bg-surface-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Jumlah Sasaran yang Dikunjungi
                    </th>
                    <th
                      colSpan={2}
                      className="border border-line bg-surface-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Ibu Hamil, Bersalin-Nifas, Bayi, Balita & APRAS — Masalah
                      Ditemukan
                    </th>
                    <th
                      colSpan={3}
                      className="border border-line bg-surface-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Usia Sekolah, Remaja, Produktif & Lansia — Masalah
                      Ditemukan
                    </th>
                    <th
                      colSpan={2}
                      className="border border-line bg-surface-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Sasaran dengan Tindak Lanjut
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-line bg-surface-2 px-2 py-2 align-middle text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      Paraf Petugas Pustu
                    </th>
                  </tr>
                  <tr>
                    {[
                      SASARAN_GROUP_LABELS.ibuHamil,
                      SASARAN_GROUP_LABELS.bersalinNifas,
                      SASARAN_GROUP_LABELS.bayiApras,
                      SASARAN_GROUP_LABELS.sekolahRemaja,
                      SASARAN_GROUP_LABELS.produktif,
                      SASARAN_GROUP_LABELS.lansia,
                    ].map((l) => (
                      <th
                        key={l}
                        className="border border-line bg-surface-2 px-1.5 py-1.5 text-[10px] font-semibold text-muted"
                      >
                        {l}
                      </th>
                    ))}
                    {['Tidak akses pelayanan', 'Tanda bahaya'].map((l) => (
                      <th
                        key={l}
                        className="border border-line bg-surface-2 px-1.5 py-1.5 text-[10px] font-semibold text-muted"
                      >
                        {l}
                      </th>
                    ))}
                    {[
                      'Tidak ada pelayanan',
                      'Bergejala TBC',
                      'Tidak minum obat teratur',
                    ].map((l) => (
                      <th
                        key={l}
                        className="border border-line bg-surface-2 px-1.5 py-1.5 text-[10px] font-semibold text-muted"
                      >
                        {l}
                      </th>
                    ))}
                    {['Edukasi', 'Lapor nakes'].map((l) => (
                      <th
                        key={l}
                        className="border border-line bg-surface-2 px-1.5 py-1.5 text-[10px] font-semibold text-muted"
                      >
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((minggu) => {
                    const zebra = minggu % 2 === 0
                    return (
                      <tr
                        key={minggu}
                        className={zebra ? 'bg-surface-2/40' : ''}
                      >
                        <td className="whitespace-nowrap border border-line px-2 py-1.5 text-center font-semibold text-ink">
                          Minggu {ROMAN[minggu]}
                        </td>
                        {NUMBER_FIELDS.map((field) => (
                          <td
                            key={field}
                            className="border border-line px-1 py-1 text-center"
                          >
                            <input
                              type="text"
                              inputMode="numeric"
                              value={effective(minggu, field)}
                              onChange={(e) =>
                                onCellChange(minggu, field, e.target.value)
                              }
                              className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-[11px] text-ink focus:border-accent focus:bg-surface focus:outline-none"
                              aria-label={`Minggu ${minggu} ${field}`}
                            />
                          </td>
                        ))}
                        <td className="border border-line px-1 py-1">
                          <input
                            type="text"
                            value={effective(minggu, 'paraf')}
                            onChange={(e) =>
                              onCellChange(minggu, 'paraf', e.target.value)
                            }
                            placeholder="—"
                            className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-[11px] text-ink focus:border-accent focus:bg-surface focus:outline-none"
                            aria-label={`Minggu ${minggu} paraf`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <TandaTangan
            nama={ttdNama}
            jabatan={ttdJabatan}
            boxClassName="w-72 text-center text-[11px]"
            namaClassName="mt-8 font-semibold text-ink"
          />
        </div>
      </SectionCard>
    </>
  )
}
