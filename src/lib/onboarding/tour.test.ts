import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/lib/constants'
import {
  TOUR_HALAMAN,
  VERSI_TOUR,
  bacaVersiTour,
  kunciTour,
  langkahUntukHalaman,
  posisiLangkah,
  sudahMengikutiTour,
  tandaiTourSelesai,
  targetLangkah,
} from './tour'
import type { PenyimpananTour } from './tour'

function buatPenyimpanan(
  awal: Record<string, string> = {},
): PenyimpananTour & { isi: Map<string, string> } {
  const isi = new Map(Object.entries(awal))

  return {
    isi,
    getItem: (key) => isi.get(key) ?? null,
    setItem: (key, value) => {
      isi.set(key, value)
    },
  }
}

describe('penanda tur per halaman', () => {
  it('menganggap perangkat baru belum pernah ikut tur halaman mana pun', () => {
    const storage = buatPenyimpanan()
    expect(bacaVersiTour('/sasaran', storage)).toBe(0)
    expect(sudahMengikutiTour('/sasaran', storage)).toBe(false)
  })

  it('mengabaikan nilai kosong, rusak, atau bukan angka positif', () => {
    for (const nilai of ['', 'abc', '0', '-2', '1.5x']) {
      const storage = buatPenyimpanan({ [kunciTour('/laporan')]: nilai })
      expect(bacaVersiTour('/laporan', storage)).toBe(0)
    }
  })

  it('menyimpan penanda terpisah untuk tiap halaman', () => {
    const storage = buatPenyimpanan()

    tandaiTourSelesai('/sasaran', storage)

    expect(sudahMengikutiTour('/sasaran', storage)).toBe(true)
    expect(sudahMengikutiTour('/laporan', storage)).toBe(false)
    expect(storage.isi.get(`${STORAGE_KEYS.tour}:/sasaran`)).toBe(
      String(VERSI_TOUR),
    )
  })

  it('menampilkan tur lagi kalau versi tersimpan lebih lama', () => {
    const storage = buatPenyimpanan({
      [kunciTour('/form')]: String(VERSI_TOUR - 1),
    })
    expect(sudahMengikutiTour('/form', storage)).toBe(false)
  })

  it('tidak melempar saat localStorage menolak tulisan', () => {
    const storage: PenyimpananTour = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    }

    expect(() => tandaiTourSelesai('/notifikasi', storage)).not.toThrow()
  })

  it('langkah dashboard memilih target dan posisi sesuai perangkat', () => {
    const target = {
      desktop: '[data-tour="nav-sidebar"]',
      mobile: '[data-tour="nav-bottom"]',
    }
    const posisi = { desktop: 'right', mobile: 'top' } as const

    expect(targetLangkah(target, 'desktop')).toBe('[data-tour="nav-sidebar"]')
    expect(targetLangkah(target, 'mobile')).toBe('[data-tour="nav-bottom"]')
    expect(targetLangkah('[data-tour="statistik"]', 'mobile')).toBe(
      '[data-tour="statistik"]',
    )
    expect(targetLangkah(undefined, 'desktop')).toBeUndefined()
    expect(posisiLangkah(posisi, 'desktop')).toBe('right')
    expect(posisiLangkah(posisi, 'mobile')).toBe('top')
  })
})

describe('daftar langkah per halaman', () => {
  it('setiap halaman punya langkah dengan judul dan isi', () => {
    const halaman = Object.keys(TOUR_HALAMAN)

    expect(halaman.length).toBeGreaterThan(0)
    for (const path of halaman) {
      const langkah = langkahUntukHalaman(path)
      expect(langkah.length).toBeGreaterThan(0)
      for (const item of langkah) {
        expect(item.title.trim().length).toBeGreaterThan(0)
        expect(item.body.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('rute yang tidak terdaftar tidak punya tur', () => {
    for (const path of ['/kelola', '/isi/123', '/sasaran/abc', '/pin']) {
      expect(langkahUntukHalaman(path)).toEqual([])
    }
  })

  it('dashboard menyapa user tanpa target lalu menyorot statistik dan menu', () => {
    const langkah = langkahUntukHalaman('/')

    expect(langkah[0]?.target).toBeUndefined()
    expect(langkah[1]?.target).toBe('[data-tour="dashboard-statistik"]')
    expect(langkah[2]?.target).toEqual({
      desktop: '[data-tour="nav-sidebar"]',
      mobile: '[data-tour="nav-bottom"]',
    })
  })
})
