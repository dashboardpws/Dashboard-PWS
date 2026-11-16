import { describe, expect, it } from 'vitest'
import { validasiFasilitas } from './fasilitas'

describe('validasiFasilitas', () => {
  const valid = {
    nama: 'Melati',
    tipe: 'Posyandu',
    alamat: 'Jl. Mawar',
    wilayahKerjaId: 1,
  }

  it('menerima draft valid', () => expect(validasiFasilitas(valid)).toBeNull())
  it('menolak nama kosong, terlalu panjang, jenis, dan wilayah yang salah', () => {
    expect(validasiFasilitas({ ...valid, nama: ' ' })).toContain('wajib')
    expect(validasiFasilitas({ ...valid, nama: 'x'.repeat(21) })).toContain(
      '20',
    )
    expect(validasiFasilitas({ ...valid, tipe: 'Klinik' })).toContain(
      'tidak valid',
    )
    expect(validasiFasilitas({ ...valid, wilayahKerjaId: 0 })).toContain(
      'wajib',
    )
  })
})
