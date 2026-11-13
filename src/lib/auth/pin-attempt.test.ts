import { describe, expect, it } from 'vitest'
import {
  COOLDOWN_AWAL_MS,
  COOLDOWN_MAKS_MS,
  BATAS_GAGAL,
  hitungCooldown,
  normalkanPin,
  pinBenar,
  sisaMenit,
} from './pin-attempt'

describe('normalkanPin', () => {
  it('membuang nol di depan tapi menyisakan satu digit', () => {
    // Regression: PIN dari env bisa "012345". Kalau nol di depan ikut
    // dibuang semua, hasilnya string kosong dan tidak akan pernah cocok.
    expect(normalkanPin('012345')).toBe('12345')
    expect(normalkanPin('0000')).toBe('0')
    expect(normalkanPin('0')).toBe('0')
  })

  it('tidak mengubah PIN tanpa nol di depan', () => {
    expect(normalkanPin('123456')).toBe('123456')
  })

  it('memangkas spasi di kedua ujung', () => {
    expect(normalkanPin('  123456  ')).toBe('123456')
  })

  it('tidak mengubah digit yang bukan di awal', () => {
    expect(normalkanPin('101010')).toBe('101010')
  })

  it('mengembalikan string kosong untuk input tanpa digit', () => {
    expect(normalkanPin('')).toBe('')
    expect(normalkanPin('   ')).toBe('')
    expect(normalkanPin('abc')).toBe('')
  })
})

describe('pinBenar', () => {
  it('menerima PIN yang sama persis', () => {
    expect(pinBenar('123456', '123456')).toBe(true)
  })

  it('menerima PIN dengan dan tanpa nol di depan', () => {
    // Dua-duanya harus dianggap PIN yang sama, karena yang diketik orang bisa
    // saja tanpa nol di depan sementara PIN di env memakai nol di depan.
    expect(pinBenar('123456', '0123456')).toBe(true)
    expect(pinBenar('0123456', '0123456')).toBe(true)
    expect(pinBenar('0123456', '123456')).toBe(true)
  })

  it('menolak PIN yang berbeda', () => {
    expect(pinBenar('123456', '654321')).toBe(false)
  })

  it('menolak panjang berbeda tanpa melempar', () => {
    // timingSafeEqual menolak buffer dengan panjang berbeda, jadi normalisasi
    // harus mengecek panjang lebih dulu — kalau tidak, ini melempar.
    expect(() => pinBenar('123', '123456')).not.toThrow()
    expect(pinBenar('123', '123456')).toBe(false)
  })

  it('memakai comparator server dengan input yang sudah dinormalisasi', () => {
    const diterima: string[][] = []
    const bandingkan = (a: string, b: string) => {
      diterima.push([a, b])
      return a === b
    }
    expect(pinBenar('0123456', '123456', bandingkan)).toBe(true)
    expect(diterima).toEqual([['123456', '123456']])
    expect(pinBenar('', '', bandingkan)).toBe(false)
    expect(diterima).toHaveLength(1)
  })

  it('menolak PIN kosong, termasuk saat PIN env kosong', () => {
    // `PIN` yang tidak terisi di environment akan jadi string kosong. Kalau dua
    // sisi kosong dianggap cocok, siapa pun bisa login dengan mengosongkan
    // field. Fail closed.
    expect(pinBenar('', '123456')).toBe(false)
    expect(pinBenar('123456', '')).toBe(false)
    expect(pinBenar('', '')).toBe(false)
    expect(pinBenar('abc', '')).toBe(false)
  })
})

describe('sisaMenit', () => {
  it('membulatkan ke atas', () => {
    expect(sisaMenit(60_000)).toBe(1)
    expect(sisaMenit(61_000)).toBe(2)
    expect(sisaMenit(90_000)).toBe(2)
  })

  it('minimal 1 menit walau sisa sangat pendek', () => {
    // "0 menit" akan membuat pengguna mencoba lagi, lalu ketemu lockout yang
    // sama dan mengira sistemnya rusak.
    expect(sisaMenit(30_000)).toBe(1)
    expect(sisaMenit(1)).toBe(1)
    expect(sisaMenit(0)).toBe(1)
    expect(sisaMenit(-5_000)).toBe(1)
  })

  it('tidak membulatkan ke bawah pada batas menit', () => {
    expect(sisaMenit(119_000)).toBe(2)
    expect(sisaMenit(15 * 60_000)).toBe(15)
  })

  it('selalu menghasilkan bilangan bulat positif', () => {
    for (const ms of [0, 1, 999, 60_000, 61_000, 900_000, -1]) {
      const nilai = sisaMenit(ms)
      expect(Number.isInteger(nilai)).toBe(true)
      expect(nilai).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('hitungCooldown', () => {
  it('mengembalikan cooldown awal tepat di ambang lockout', () => {
    expect(hitungCooldown(BATAS_GAGAL)).toBe(COOLDOWN_AWAL_MS)
  })

  it('menggandakan jeda setiap kegagalan berikutnya', () => {
    expect(hitungCooldown(BATAS_GAGAL + 1)).toBe(COOLDOWN_AWAL_MS * 2)
    expect(hitungCooldown(BATAS_GAGAL + 2)).toBe(COOLDOWN_AWAL_MS * 4)
  })

  it('tidak melebihi plafon', () => {
    expect(hitungCooldown(BATAS_GAGAL + 50)).toBe(COOLDOWN_MAKS_MS)
    expect(hitungCooldown(1000)).toBe(COOLDOWN_MAKS_MS)
  })

  it('aman untuk nilai di bawah ambang dan negatif', () => {
    // Nilai di bawah BATAS_GAGAL tidak pernah dipakai untuk mengunci, tapi
    // pangkatnya harus tetap valid supaya tidak menghasilkan NaN/Infinity.
    expect(hitungCooldown(0)).toBe(COOLDOWN_AWAL_MS)
    expect(hitungCooldown(-5)).toBe(COOLDOWN_AWAL_MS)
    expect(Number.isFinite(hitungCooldown(-5))).toBe(true)
  })

  it('selalu naik monoton sampai plafon', () => {
    let sebelumnya = 0
    for (let g = BATAS_GAGAL; g <= BATAS_GAGAL + 8; g += 1) {
      const nilai = hitungCooldown(g)
      expect(nilai).toBeGreaterThanOrEqual(sebelumnya)
      expect(nilai).toBeLessThanOrEqual(COOLDOWN_MAKS_MS)
      sebelumnya = nilai
    }
  })
})
