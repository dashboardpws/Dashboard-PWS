import { describe, expect, it } from 'vitest'
import { buildWarnings } from '@/lib/dashboard/warning'
import type { Warning, WarningSeverity } from '@/lib/dashboard/warning'
import {
  BATAS_LONTENG,
  FILTER_SEMUA,
  filterWarnings,
  hitungPerSeverity,
  labelSingkat,
  ringkasanNotifikasi,
  untukLonceng,
} from './ringkasan'
import type { FilterNotifikasi } from './types'

// Sama seperti warning.test.ts: Date lokal, bukan string ISO, supaya tes tidak
// bergantung timezone mesin CI.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0)

const TANPA: FilterNotifikasi = {
  severity: FILTER_SEMUA,
  type: FILTER_SEMUA,
  region: FILTER_SEMUA,
}

const contoh = (): Warning[] =>
  buildWarnings(
    {
      regions: [
        { name: 'Trajeng', total: 100, dikunjungi: 20 },
        { name: 'Tambaan', total: 50, dikunjungi: 45 },
      ],
      jadwal: [
        {
          id: 'k1',
          nik: '1',
          nama: 'Budi',
          kelurahan: 'Trajeng',
          tanggal: '2026-09-01',
          status: 'terjadwal',
        },
      ],
      tindakLanjut: [
        {
          id: 't1',
          nik: '2',
          nama: 'Sari',
          kelurahan: 'Trajeng',
          tanggal: '2026-01-01',
          status: 'belum',
        },
      ],
    },
    { now: at(2026, 10, 1) },
  )

describe('filterWarnings', () => {
  it('tanpa filter mengembalikan semua yang aktif, urut severity', () => {
    const rows = filterWarnings(contoh(), TANPA)
    expect(rows.length).toBeGreaterThan(0)
    const urut = rows.map((w) => w.severity)
    expect(urut).toEqual([...urut].sort(bySeverity))
  })

  it('filter severity hanya menyisakan severity itu', () => {
    const rows = filterWarnings(contoh(), { ...TANPA, severity: 'critical' })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((w) => w.severity === 'critical')).toBe(true)
  })

  it('filter jenis tidak membocorkan jenis lain', () => {
    const rows = filterWarnings(contoh(), {
      ...TANPA,
      type: 'jadwal_terlambat',
    })
    expect(rows.map((w) => w.id)).toEqual(['jadwal-terlambat'])
  })

  it('filter wilayah menyisakan warning milik wilayah itu dan warning global', () => {
    const semua = filterWarnings(contoh(), TANPA)
    expect(semua.some((w) => w.region === 'Trajeng')).toBe(true)

    // Trajeng 20/100 -> cakupan rendah, jadi punya warning milik sendiri.
    const trajeng = filterWarnings(contoh(), { ...TANPA, region: 'Trajeng' })
    expect(trajeng.length).toBeGreaterThan(0)
    expect(
      trajeng.every((w) => w.region === 'Trajeng' || w.region === null),
    ).toBe(true)
    expect(trajeng.some((w) => w.region === 'Trajeng')).toBe(true)

    // Tambaan 45/50 -> tidak ada warning miliknya, jadi yang tersisa hanya global.
    const tambaan = filterWarnings(contoh(), { ...TANPA, region: 'Tambaan' })
    const global = semua.filter((w) => w.region === null)
    expect(tambaan.map((w) => w.id)).toEqual(global.map((w) => w.id))
    expect(tambaan.length).toBeGreaterThan(0)
    expect(tambaan.length).toBeLessThan(trajeng.length)
  })

  it('filter wilayah tidak menyaring warning tanpa wilayah', () => {
    // Warning cakupan global (mis. sasaran belum dikunjungi) punya region null;
    // memilih satu wilayah harus tetap memunculkannya sebagai konteks umum.
    const semua = filterWarnings(contoh(), TANPA)
    const global = semua.filter((w) => w.region === null)
    expect(global.length).toBeGreaterThan(0)
    const trajeng = filterWarnings(contoh(), { ...TANPA, region: 'Trajeng' })
    expect(trajeng.filter((w) => w.region === null).map((w) => w.id)).toEqual(
      global.map((w) => w.id),
    )
  })

  it('gabungan filter yang tidak cocok menghasilkan daftar kosong', () => {
    expect(
      filterWarnings(contoh(), {
        severity: 'info',
        type: 'jadwal_terlambat',
        region: FILTER_SEMUA,
      }),
    ).toHaveLength(0)
  })

  it('warning berstatus bukan active tidak pernah dimunculkan', () => {
    const pertama = contoh()[0]
    if (!pertama) throw new Error('contoh() harus menghasilkan warning')
    const rows = filterWarnings([{ ...pertama, status: 'dismissed' }], TANPA)
    expect(rows).toHaveLength(0)
  })
})

describe('hitungPerSeverity', () => {
  it('menghitung hanya warning aktif dengan jumlah independen per severity', () => {
    const dasar = contoh()[0]!
    const list = [
      { ...dasar, id: 'c1', severity: 'critical' as const },
      { ...dasar, id: 'c2', severity: 'critical' as const },
      { ...dasar, id: 'a1', severity: 'attention' as const },
      { ...dasar, id: 'r1', severity: 'reminder' as const },
      {
        ...dasar,
        id: 'd1',
        severity: 'critical' as const,
        status: 'dismissed' as const,
      },
    ]
    expect(hitungPerSeverity(list)).toEqual({
      critical: 2,
      attention: 1,
      reminder: 1,
      info: 0,
    })
  })

  it('memiliki kunci untuk keempat severity walau nol', () => {
    expect(Object.keys(hitungPerSeverity([])).sort()).toEqual([
      'attention',
      'critical',
      'info',
      'reminder',
    ])
  })
})

describe('ringkasanNotifikasi', () => {
  it('total, kritis, dan warning teratas dihitung dari data independen', () => {
    const dasar = contoh()[0]!
    const list = [
      { ...dasar, id: 'i1', severity: 'info' as const },
      { ...dasar, id: 'c1', severity: 'critical' as const },
      { ...dasar, id: 'a1', severity: 'attention' as const },
      {
        ...dasar,
        id: 'd1',
        severity: 'critical' as const,
        status: 'dismissed' as const,
      },
    ]
    const r = ringkasanNotifikasi(list)
    expect(r.total).toBe(3)
    expect(r.kritis).toBe(1)
    expect(r.teratas?.id).toBe('c1')
  })

  it('daftar kosong memberi teratas null', () => {
    expect(ringkasanNotifikasi([]).teratas).toBeNull()
  })
})

describe('untukLonceng', () => {
  it('memotong pada batas default dan melaporkan sisanya', () => {
    const banyak = buildWarnings(
      {
        regions: Array.from({ length: 12 }, (_, i) => ({
          name: `W${i}`,
          total: 100,
          dikunjungi: 5,
        })),
      },
      { now: at(2026, 10, 1) },
    )
    expect(banyak.length).toBeGreaterThan(BATAS_LONTENG)
    const { rows, hidden } = untukLonceng(banyak)
    expect(rows).toHaveLength(BATAS_LONTENG)
    expect(hidden).toBe(banyak.length - BATAS_LONTENG)
  })

  it('limit khusus tetap memfilter status dan mengurutkan severity', () => {
    const dasar = contoh()[0]!
    const list = [
      { ...dasar, id: 'i1', severity: 'info' as const },
      { ...dasar, id: 'c1', severity: 'critical' as const },
      { ...dasar, id: 'a1', severity: 'attention' as const },
      {
        ...dasar,
        id: 'd1',
        severity: 'critical' as const,
        status: 'dismissed' as const,
      },
    ]
    const { rows, hidden } = untukLonceng(list, 2)
    expect(rows.map((w) => w.id)).toEqual(['c1', 'a1'])
    expect(hidden).toBe(1)
  })

  it('daftar kosong memberi hidden 0', () => {
    expect(untukLonceng([])).toEqual({ rows: [], hidden: 0 })
  })
})

describe('labelSingkat', () => {
  it('menyambung judul dan deskripsi bila ada', () => {
    const w = contoh()[0]
    if (!w) throw new Error('contoh() harus menghasilkan warning')
    expect(w.description).not.toBe('')
    expect(labelSingkat(w)).toBe(`${w.title} - ${w.description}`)
  })

  it('tidak menambah pemisah bila deskripsi kosong', () => {
    const w = { ...(contoh()[0] as Warning), description: '' }
    expect(labelSingkat(w)).toBe(w.title)
  })
})

function bySeverity(a: WarningSeverity, b: WarningSeverity): number {
  const order: Record<WarningSeverity, number> = {
    critical: 0,
    attention: 1,
    reminder: 2,
    info: 3,
  }
  return order[a] - order[b]
}
