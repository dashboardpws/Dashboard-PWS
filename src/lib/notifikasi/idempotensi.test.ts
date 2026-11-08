import { describe, expect, it } from 'vitest'
import { kunciIdempotensi, tanggalWib } from './idempotensi'

describe('tanggalWib', () => {
  it('memakai tanggal Jakarta, bukan UTC', () => {
    // 2026-11-07T18:30:00Z = 2026-11-08 01:30 WIB.
    expect(tanggalWib(new Date('2026-11-07T18:30:00Z'))).toBe('2026-11-08')
  })

  it('memberi bentuk YYYY-MM-DD', () => {
    expect(tanggalWib(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02')
  })
})

describe('kunciIdempotensi', () => {
  it('stabil walau urutan peringatan berubah', () => {
    const a = kunciIdempotensi('2026-11-07', ['a', 'b'])
    const b = kunciIdempotensi('2026-11-07', ['b', 'a'])
    expect(a).toBe(b)
  })

  it('berbeda per hari', () => {
    const ids = ['a', 'b']
    expect(kunciIdempotensi('2026-11-07', ids)).not.toBe(
      kunciIdempotensi('2026-11-08', ids),
    )
  })

  it('berbeda saat daftar peringatan berubah', () => {
    expect(kunciIdempotensi('2026-11-07', ['a'])).not.toBe(
      kunciIdempotensi('2026-11-07', ['a', 'b']),
    )
  })

  it('tetap menghasilkan kunci saat tidak ada peringatan', () => {
    expect(kunciIdempotensi('2026-11-07', [])).toMatch(
      /^2026-11-07:[0-9a-f]{32}$/,
    )
  })
})
