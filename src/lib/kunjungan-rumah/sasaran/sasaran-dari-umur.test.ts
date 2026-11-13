/**
 * Test untuk {@link sasaranDariTglLahir} dan {@link umurTahun}.
 *
 * Fokusnya batas usia, karena di situ angka rekap dan label template tidak
 * sama: yang diuji adalah batas numerik yang dipakai rekap (6/18/59/60), bukan
 * label di `kunjungan-rumah-form.ts`.
 */
import { describe, expect, it } from 'vitest'
import {
  BATAS_DEWASA,
  BATAS_REMAJA,
  sasaranDariTglLahir,
  umurTahun,
} from './sasaran-dari-umur'

const ACUAN = '2026-10-09'

describe('umurTahun', () => {
  it('menghitung ulang tahun yang belum terlampaui', () => {
    // Lahir 2010-10-10: pada 2026-10-09 dia belum 16.
    expect(umurTahun('2010-10-10', ACUAN)).toBe(15)
    expect(umurTahun('2010-10-08', ACUAN)).toBe(16)
  })

  it('mengembalikan null untuk tanggal lahir atau acuan tidak valid', () => {
    expect(umurTahun('', ACUAN)).toBeNull()
    expect(umurTahun('bukan-tanggal', ACUAN)).toBeNull()
    expect(umurTahun('2000-01-01', 'bukan-tanggal')).toBeNull()
    for (const tidakSah of [
      '2000-02-30',
      '2001-02-29',
      '2000-13-01',
      '2000-01-32',
    ]) {
      expect(umurTahun(tidakSah, ACUAN)).toBeNull()
      expect(umurTahun('2000-01-01', tidakSah)).toBeNull()
    }
  })

  it('menerima tanggal kabisat yang benar-benar ada', () => {
    expect(umurTahun('2000-02-29', '2024-02-29')).toBe(24)
    expect(umurTahun('2024-02-29', '2025-02-28')).toBe(0)
  })

  it('tidak menerima tanggal lahir di masa depan', () => {
    // Umur negatif berarti data salah, bukan berarti anak belum lahir.
    expect(umurTahun('2030-01-01', ACUAN)).toBeNull()
  })
})

describe('sasaranDariTglLahir', () => {
  it('tidak menebak bayi atau balita karena butuh presisi bulan', () => {
    // Usia 0 dan 5 tahun sama-sama di bawah batas, dan keduanya bisa berarti
    // bayi (0-6 bulan) atau balita (6-71 bulan). Tanpa presisi bulan, tebakan
    // bisa salah separuh kasus.
    expect(sasaranDariTglLahir('2026-03-01', ACUAN)).toBeNull()
    expect(sasaranDariTglLahir('2021-05-01', ACUAN)).toBeNull()
  })

  it('memilih remaja dari 6 tahun sampai batas atas 18 tahun', () => {
    expect(sasaranDariTglLahir('2020-10-09', ACUAN)).toBe('remaja')
    expect(sasaranDariTglLahir('2008-01-01', ACUAN)).toBe('remaja')
    // Tepat batas atas: 18 tahun masih remaja.
    expect(sasaranDariTglLahir(`${2026 - BATAS_REMAJA}-01-01`, ACUAN)).toBe(
      'remaja',
    )
  })

  it('memilih dewasa dari 19 tahun sampai batas atas 59 tahun', () => {
    // 18 tahun penuh pada acuan: belum dewasa, masih remaja.
    expect(sasaranDariTglLahir('2007-12-31', ACUAN)).toBe('remaja')
    // 19 tahun penuh pada acuan: dewasa.
    expect(sasaranDariTglLahir('2007-10-09', ACUAN)).toBe('dewasa')
    expect(sasaranDariTglLahir(`${2026 - BATAS_DEWASA}-01-01`, ACUAN)).toBe(
      'dewasa',
    )
  })

  it('memilih Lansia dari 60 tahun ke atas', () => {
    expect(sasaranDariTglLahir('1966-10-09', ACUAN)).toBe('lansia')
    expect(sasaranDariTglLahir('1950-01-01', ACUAN)).toBe('lansia')
  })

  it('tidak pernah memilih ibu-hamil, bersalin-nifas, atau tbc', () => {
    // Tiga kelompok itu butuh pemeriksaan kader atau prioritas TB, bukan umur.
    for (const tahun of ['2026', '2008', '1990', '1960']) {
      const key = sasaranDariTglLahir(`${tahun}-06-15`, ACUAN)
      expect(key).not.toBe('ibu-hamil')
      expect(key).not.toBe('bersalin-nifas')
      expect(key).not.toBe('tbc')
    }
  })

  it('mengembalikan null untuk tanggal lahir kosong supaya kader memilih sendiri', () => {
    // `null` berarti "tidak bisa ditentukan", bukan "tidak ada sasaran yang
    // cocok" — banyak baris import tidak punya tanggal lahir.
    expect(sasaranDariTglLahir('', ACUAN)).toBeNull()
  })
})
