import { describe, expect, it } from 'vitest'
import { buildWarnings } from '@/lib/dashboard/warning'
import type { Warning } from '@/lib/dashboard/warning'
import {
  BATAS_RIWAYAT_ID,
  BATAS_TOAST_PER_SESI,
  bacaDitampilkan,
  pilihKandidatToast,
  simpanSession,
  tandaiDitampilkan,
} from './toast-dedup'
import type { SimpanToast } from './toast-dedup'

// Sama seperti ringkasan.test.ts: Date lokal, bukan string ISO, supaya tes tak
// bergantung timezone mesin CI.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0, 0)

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

/** Warning buatan dengan overrider, supaya tes tidak menggantung config severity. */
const buat = (
  over: Partial<Warning> & Pick<Warning, 'id' | 'severity'>,
): Warning => {
  const dasar = contoh()[0]
  if (!dasar)
    throw new Error('buildWarnings harus menghasilkan setidaknya satu warning.')
  return { ...dasar, ...over }
}

/** Penyimpan palsu: perilaku identik sessionStorage tanpa menyentuh browser. */
const simpanPalsu = (): SimpanToast => {
  let isi: string[] = []
  return {
    baca: () => [...isi],
    tulis: (ids) => {
      isi = [...ids]
    },
  }
}

/** Penyimpan yang selalu banting error — mewakili kuota penuh / mode privat. */
const simpanRusak = (): SimpanToast => ({
  baca: () => {
    throw new Error('storage penuh')
  },
  tulis: () => {
    throw new Error('storage penuh')
  },
})

describe('pilihKandidatToast', () => {
  it('semua severity ditampilkan, urut dari paling serius', () => {
    const daftar = [
      buat({ id: 'a', severity: 'info' }),
      buat({ id: 'b', severity: 'reminder' }),
      buat({ id: 'c', severity: 'critical' }),
      buat({ id: 'd', severity: 'attention' }),
    ]
    const kandidat = pilihKandidatToast(daftar, [])
    expect(kandidat.map((w) => w.id)).toEqual(['c', 'd', 'b', 'a'])
  })

  it('yang sudah pernah tampil tidak dipilih lagi', () => {
    const daftar = [
      buat({ id: 'c', severity: 'critical' }),
      buat({ id: 'd', severity: 'attention' }),
    ]
    expect(pilihKandidatToast(daftar, ['c']).map((w) => w.id)).toEqual(['d'])
    expect(pilihKandidatToast(daftar, ['c', 'd'])).toEqual([])
  })

  it('status selain active dibuang, lapisan status tidak boleh bocor', () => {
    const daftar = ['dismissed', 'resolved', 'acknowledged'].map((status, i) =>
      buat({
        id: `x${i}`,
        severity: 'critical',
        status: status as Warning['status'],
      }),
    )
    expect(pilihKandidatToast(daftar, [])).toEqual([])
  })

  it('kuota sesi memotong kandidat meski daftar panjang', () => {
    const daftar = Array.from({ length: BATAS_TOAST_PER_SESI + 2 }, (_, i) =>
      buat({ id: `w${i}`, severity: 'critical' }),
    )
    const dua = pilihKandidatToast(daftar, ['sudah-satu', 'sudah-dua'])
    expect(dua.length).toBe(BATAS_TOAST_PER_SESI - 2)
  })

  it('kuota habis berarti kosong, sekalipun ada warning baru', () => {
    const daftar = [buat({ id: 'c', severity: 'critical' })]
    const sudah = Array.from({ length: BATAS_TOAST_PER_SESI }, (_, i) =>
      String(i),
    )
    expect(sudah.length).toBe(BATAS_TOAST_PER_SESI)
    expect(pilihKandidatToast(daftar, sudah)).toEqual([])
  })
})

describe('tandaiDitampilkan', () => {
  it('menggabungkan tanpa kembar dan mengembalikan isi yang tersimpan', () => {
    const simpan = simpanPalsu()
    const pertama = tandaiDitampilkan(['a', 'b'], simpan)
    expect(pertama).toEqual(['a', 'b'])

    const kedua = tandaiDitampilkan(['b', 'c'], simpan)
    expect(kedua).toEqual(['a', 'b', 'c'])
    expect(bacaDitampilkan(simpan)).toEqual(kedua)
  })

  it('sarung penuh membuang ID paling lama, bukan yang baru', () => {
    const simpan = simpanPalsu()
    const lama = Array.from({ length: BATAS_RIWAYAT_ID }, (_, i) => `lama-${i}`)
    tandaiDitampilkan(lama, simpan)
    const hasil = tandaiDitampilkan(['baru-terakhir'], simpan)
    expect(hasil.length).toBe(BATAS_RIWAYAT_ID)
    expect(hasil.at(-1)).toBe('baru-terakhir')
    expect(hasil.includes('lama-0')).toBe(false)
  })
})

describe('penyimpan session yang gagal gugur diam', () => {
  it('bacaDitampilkan dengan penyimpan rusak mengembalikan daftar kosong', () => {
    expect(bacaDitampilkan(simpanRusak())).toEqual([])
  })

  it('menulis lewat penyimpan rusak tidak dibanting keluar', () => {
    expect(() => tandaiDitampilkan(['a'], simpanRusak())).not.toThrow()
  })

  it('sessionStorage sungguhan di Node (tanpa window) tetap aman', () => {
    // Di Node window tidak ada / kosong, jadi baca harus [] tanpa throw —
    // inilah SSR guard saat Topbar dirender pertama kali di server.
    expect(bacaDitampilkan(simpanSession())).toEqual([])
    expect(() => tandaiDitampilkan(['a'], simpanSession())).not.toThrow()
  })
})

describe('pilihKandidatToast bersama data nyata dari buildWarnings', () => {
  it('memilih warning aktif dalam urutan severity yang diharapkan', () => {
    const kandidat = pilihKandidatToast(contoh(), [])
    expect(kandidat.map((w) => w.id)).toEqual([
      'sasaran-belum',
      'cakupan:Trajeng',
      'tindak-lanjut',
      'jadwal-terlambat',
    ])
    expect(kandidat.every((w) => w.status === 'active')).toBe(true)
    expect(kandidat.length).toBeLessThanOrEqual(BATAS_TOAST_PER_SESI)
  })
})
