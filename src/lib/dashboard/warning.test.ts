import { describe, expect, it } from 'vitest'
import {
  applyWarningStates,
  buildWarnings,
  computePeriod,
  deriveTindakLanjut,
} from './warning'
import type { CoverageRegion } from './warning'

// Selalu pakai Date lokal (new Date(y, m, d)), bukan string ISO, supaya tes tidak
// bergantung timezone mesin CI.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0)

const regions = (rows: [string, number, number][]): CoverageRegion[] =>
  rows.map(([name, total, dikunjungi]) => ({ name, total, dikunjungi }))

describe('computePeriod', () => {
  it('active di tengah periode', () => {
    const p = computePeriod('2026-01-01', '2026-12-31', at(2026, 6, 15))
    expect(p.status).toBe('active')
    expect(p.daysRemaining).toBeGreaterThan(0)
    expect(p.progress).toBeGreaterThan(0)
    expect(p.progress).toBeLessThan(1)
  })
  it('31 Des masih active dan sisa 1 hari (akhir inklusif)', () => {
    const p = computePeriod('2026-01-01', '2026-12-31', at(2026, 12, 31))
    expect(p.status).toBe('active')
    expect(p.daysRemaining).toBe(1)
  })
  it('ended setelah 31 Des', () => {
    const p = computePeriod('2026-01-01', '2026-12-31', at(2027, 1, 1))
    expect(p.status).toBe('ended')
    expect(p.daysRemaining).toBe(0)
    expect(p.progress).toBe(1)
  })
  it('upcoming sebelum mulai', () => {
    expect(
      computePeriod('2026-01-01', '2026-12-31', at(2025, 12, 31)).status,
    ).toBe('upcoming')
  })
})

describe('buildWarnings', () => {
  it('tanpa warning bila semua sasaran sudah dikunjungi', () => {
    const w = buildWarnings(
      { regions: regions([['A', 100, 100]]) },
      { now: at(2026, 12, 25) },
    )
    expect(w).toHaveLength(0)
  })

  it('sasaran belum dikunjungi = critical dan menghitung dari regions', () => {
    const [w] = buildWarnings(
      {
        regions: regions([
          ['A', 1000, 900],
          ['B', 250, 180],
        ]),
      },
      { now: at(2026, 3, 1) },
    )
    expect(w!.type).toBe('sasaran_belum_dikunjungi')
    expect(w!.severity).toBe('critical')
    expect(w!.title).toContain('170')
  })

  it('milestone: pakai yang terkecil yang sudah terlewati', () => {
    const input = { regions: regions([['A', 100, 90]]) }
    const find = (now: Date) =>
      buildWarnings(input, { now }).find(
        (x) => x.type === 'periode_mendekati_akhir',
      )

    expect(find(at(2026, 9, 1))).toBeUndefined() // 122 hari
    expect(find(at(2026, 10, 20))?.severity).toBe('info') // 73 hari → 90
    const m30 = find(at(2026, 12, 3)) // 29 hari → 30
    expect(m30?.severity).toBe('reminder')
    expect(m30?.title).toContain('29 hari')
    expect(find(at(2026, 12, 20))?.severity).toBe('attention') // 12 hari → 14
    expect(find(at(2026, 12, 28))?.severity).toBe('critical') // 4 hari → 7
  })

  it('cakupan rendah: relatif persentase dan mengabaikan wilayah kecil', () => {
    const w = buildWarnings(
      {
        regions: regions([
          ['A', 100, 92],
          ['C', 100, 64],
          ['D', 100, 91],
          ['Kecil', 5, 1],
        ]),
      },
      { now: at(2026, 6, 15) },
    ).filter((x) => x.type === 'cakupan_wilayah_rendah')
    expect(w).toHaveLength(1)
    expect(w[0]!.title).toBe('Cakupan C baru 64%')
    expect(w[0]!.severity).toBe('attention')
    expect(w[0]!.region).toBe('C')
  })

  it('cakupan di bawah criticalPct = critical', () => {
    const [w] = buildWarnings(
      { regions: regions([['C', 100, 30]]) },
      { now: at(2026, 6, 15) },
    ).filter((x) => x.type === 'cakupan_wilayah_rendah')
    expect(w!.severity).toBe('critical')
  })

  it('jadwal terlambat: hanya terjadwal & tanggal < hari ini', () => {
    const j = (
      id: string,
      tanggal: string,
      status: 'terjadwal' | 'selesai' | 'batal' = 'terjadwal',
    ) => ({
      id,
      nik: null,
      nama: id,
      kelurahan: 'A',
      tanggal,
      status,
    })
    const w = buildWarnings(
      {
        regions: regions([['A', 10, 10]]),
        jadwal: [
          j('1', '2026-06-14'),
          j('2', '2026-06-15'),
          j('3', '2026-06-01', 'selesai'),
          j('4', '2026-05-01'),
        ],
      },
      { now: at(2026, 6, 15) },
    ).find((x) => x.type === 'jadwal_terlambat')
    expect(w?.title).toBe('2 jadwal kunjungan terlambat')
    expect(w?.severity).toBe('attention')
  })

  it('tindak lanjut: severity = umur terburuk, selesai diabaikan', () => {
    const t = (
      id: string,
      tanggal: string,
      status: 'belum' | 'proses' | 'selesai' = 'belum',
    ) => ({
      id,
      nik: id,
      nama: id,
      kelurahan: 'A',
      tanggal,
      status,
    })
    const w = buildWarnings(
      {
        regions: regions([['A', 10, 10]]),
        tindakLanjut: [
          t('1', '2026-05-10'),
          t('2', '2026-06-10', 'proses'),
          t('3', '2026-04-01', 'selesai'),
        ],
      },
      { now: at(2026, 6, 15) }, // item 1 berumur 36 hari
    ).find((x) => x.type === 'tindak_lanjut_belum_selesai')
    expect(w?.title).toBe('2 tindak lanjut belum selesai')
    expect(w?.severity).toBe('critical')
    expect(w?.description).toContain('1 sedang ditindaklanjuti')
  })

  it('filter region membatasi hitungan dan mengisi region', () => {
    const w = buildWarnings(
      {
        regions: regions([
          ['A', 100, 50],
          ['B', 100, 90],
        ]),
      },
      { now: at(2026, 6, 15), region: 'B' },
    )
    const s = w.find((x) => x.type === 'sasaran_belum_dikunjungi')
    expect(s?.title).toContain('10 ')
    expect(s?.region).toBe('B')
    expect(w.some((x) => x.type === 'cakupan_wilayah_rendah')).toBe(false)
  })

  it('filter periode: item di luar rentang diabaikan', () => {
    const w = buildWarnings(
      {
        regions: regions([['A', 10, 10]]),
        jadwal: [
          {
            id: 'x',
            nik: null,
            nama: 'x',
            kelurahan: 'A',
            tanggal: '2026-02-01',
            status: 'terjadwal',
          },
        ],
      },
      {
        now: at(2026, 6, 15),
        period: { startDate: '2026-04-01', endDate: '2026-06-30' },
      },
    )
    expect(w.some((x) => x.type === 'jadwal_terlambat')).toBe(false)
  })
})

describe('deriveTindakLanjut', () => {
  const r = (
    id: string,
    nik: string,
    tanggal: string,
    hasil: string | null,
  ) => ({
    id,
    nik,
    nama: id,
    kelurahan: 'A',
    tanggal,
    hasil,
  })
  it("terbuka bila kunjungan terakhir butuh tindak lanjut, tertutup bila lanjut 'Selesai'", () => {
    const items = deriveTindakLanjut([
      r('a1', '111', '2026-05-01', 'Kontrol ulang'),
      r('a2', '111', '2026-06-01', 'Selesai — sehat / terkendali'), // menutup NIK 111
      r('b1', '222', '2026-05-01', 'Rujuk ke Puskesmas'),
      r('c1', '333', '2026-05-01', 'Selesai — sehat / terkendali'),
    ])
    expect(items.map((i) => i.nik)).toEqual(['222'])
  })

  it('waktuSimpan memutuskan hasil terbaru pada hari yang sama tanpa bergantung urutan input', () => {
    const lama = {
      ...r('kontrol', '111', '2026-05-01', 'Kontrol ulang'),
      waktuSimpan: '2026-05-01T08:00:00.000Z',
    }
    const baru = {
      ...r('selesai', '111', '2026-05-01', 'Selesai — sehat / terkendali'),
      waktuSimpan: '2026-05-01T09:00:00.000Z',
    }
    expect(deriveTindakLanjut([lama, baru])).toEqual([])
    expect(deriveTindakLanjut([baru, lama])).toEqual([])
  })
})

describe('applyWarningStates', () => {
  it('menumpuk status berdasarkan id', () => {
    const [w] = buildWarnings(
      { regions: regions([['A', 10, 5]]) },
      { now: at(2026, 6, 15) },
    )
    const [x] = applyWarningStates([w!], {
      [w!.id]: { status: 'dismissed', at: '2026-06-15T00:00:00Z' },
    })
    expect(x!.status).toBe('dismissed')
  })
})
