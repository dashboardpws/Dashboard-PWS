/**
 * Test untuk {@link sanitasiDariRiwayat}.
 *
 * Fokusnya dua hal yang paling mudah salah: nilai `null` dari tabel impor (yang
 * berarti "tidak diperiksa", bukan "tidak ada"), dan nilai teks yang tidak ada
 * di daftar opsi field yang terkunci.
 */
import { describe, expect, it } from 'vitest'
import {
  gabungPatchSanitasi,
  patchSanitasiDariRecordKR,
  patchSanitasiDariRiwayat,
  sanitasiDariRiwayat,
} from './sanitasi-dari-riwayat'
import type { Sanitasi } from '@/lib/kunjungan-rumah/models'

function kosong(): Sanitasi {
  return {
    jkn: false,
    jenisAir: '',
    jambanSaniter: '',
    ventilasi: false,
    odgj: false,
    tbc: false,
    hipertensi: false,
    dm: false,
  }
}

describe('sanitasiDariRiwayat', () => {
  it('mengembalikan null saat warga tidak punya baris riwayat', () => {
    // Tanpa baris riwayat, isian kader yang sudah ada tidak boleh hilang
    // hanya karena ada warga yang dipilih.
    expect(sanitasiDariRiwayat(false, {}, kosong())).toBeNull()
  })

  it('mengembalikan null saat baris ada tapi tidak ada kolom yang terisi', () => {
    expect(
      sanitasiDariRiwayat(true, { kepesertaanJkn: null }, kosong()),
    ).toBeNull()
  })

  it('memetakan empat checkbox dari kolom riwayat', () => {
    const hasil = sanitasiDariRiwayat(
      true,
      {
        kepesertaanJkn: true,
        diagnosisOdgj: false,
        diagnosisTbParu: true,
        diagnosisHipertensi: false,
      },
      kosong(),
    )
    expect(hasil).toMatchObject({
      jkn: true,
      odgj: false,
      tbc: true,
      hipertensi: false,
    })
  })

  it('membiarkan checkbox tidak tercentang saat kolomnya null', () => {
    // `null` di tabel impor berarti tidak diperiksa. Menulis `false` di sini
    // akan menyatakan "tidak ada anggota dengan ODGJ", dan itu klaim yang
    // tidak ada dasarnya di data.
    const hasil = sanitasiDariRiwayat(true, { kepesertaanJkn: null }, kosong())
    if (hasil) expect(hasil.jkn).toBe(false)
    else expect(hasil).toBeNull()
  })

  it('memetakan nilai jamban dan air yang persis ada di opsi field', () => {
    const hasil = sanitasiDariRiwayat(
      true,
      {
        jenisJambanSaniter: 'Plengseran',
        jenisSumberAirTerlindung: 'Sumur terlindung',
      },
      kosong(),
    )
    expect(hasil).toMatchObject({
      jambanSaniter: 'Plengseran',
      jenisAir: 'Sumur terlindung',
    })
  })

  it('menyamakan kapitalisasi dan spasi berulang saat memetakan', () => {
    const hasil = sanitasiDariRiwayat(
      true,
      {
        jenisJambanSaniter: '  plengseran/TERANG  ',
        jenisSumberAirTerlindung: '  Ledeng/PDAM  ',
      },
      kosong(),
    )
    expect(hasil).toMatchObject({
      jambanSaniter: 'Plengseran',
      jenisAir: 'Ledeng/PDAM',
    })
  })

  it('mengosongkan nilai yang tidak ada di opsi field, bukan menebaknya', () => {
    // Opsi select terkunci di template dan tidak boleh berubah, sedangkan isi
    // tabel impor tidak bisa diprediksi dari repo. Nilai tak dikenal harus
    // jadi kosong supaya select tidak menampilkan opsi yang berbeda dari data.
    const hasil = sanitasiDariRiwayat(
      true,
      {
        jenisJambanSaniter: ' septic tank ',
        jenisSumberAirTerlindung: 'air hujan',
      },
      { ...kosong(), jambanSaniter: 'Kloset', jenisAir: 'Sumur pompa' },
    )
    expect(hasil).toMatchObject({ jambanSaniter: '', jenisAir: '' })
  })

  it('menimpa isian manual dengan nilai riwayat yang cocok', () => {
    const hasil = sanitasiDariRiwayat(
      true,
      { kepesertaanJkn: true, jenisJambanSaniter: 'Cemplung' },
      { ...kosong(), jkn: false, jambanSaniter: 'Kloset' },
    )
    expect(hasil).toMatchObject({ jkn: true, jambanSaniter: 'Cemplung' })
  })

  it('tidak menyentuh ventilasi dan dm karena tidak ada kolomnya', () => {
    const hasil = sanitasiDariRiwayat(
      true,
      { kepesertaanJkn: true },
      {
        ...kosong(),
        ventilasi: true,
        dm: true,
      },
    )
    expect(hasil).toMatchObject({ ventilasi: true, dm: true })
  })

  it('mempertahankan field di luar daftar riwayat', () => {
    // `Sanitasi` punya index signature; admin bisa menambah field lewat Form
    // Builder. Field itu tidak boleh hilang saat penjemahan.
    const hasil = sanitasiDariRiwayat(
      true,
      { kepesertaanJkn: true },
      { ...kosong(), airBersih: 'Ya' },
    )
    expect(hasil?.airBersih).toBe('Ya')
  })
})

describe('patchSanitasiDariRecordKR', () => {
  it('hanya mengambil checkbox yang bernilai true', () => {
    // `false` tidak bisa dibedakan dari "belum disentuh", jadi tidak boleh
    // ikut sebagai patch — kalau ikut, nilai `true` dari impor akan terhapus.
    const patch = patchSanitasiDariRecordKR({
      jkn: true,
      odgj: false,
      tbc: true,
      hipertensi: false,
    })
    expect(patch).toMatchObject({ jkn: true, tbc: true })
    expect(patch).not.toHaveProperty('odgj')
    expect(patch).not.toHaveProperty('hipertensi')
  })

  it('membawa ventilasi dan dm yang tidak punya kolom impor', () => {
    const patch = patchSanitasiDariRecordKR({ ventilasi: true, dm: true })
    expect(patch).toMatchObject({ ventilasi: true, dm: true })
  })

  it('mengabaikan select kosong dan nilai bukan objek', () => {
    expect(
      patchSanitasiDariRecordKR({ jambanSaniter: '', jenisAir: '' }),
    ).toEqual({})
    expect(patchSanitasiDariRecordKR(null)).toEqual({})
    expect(patchSanitasiDariRecordKR('Kloset')).toEqual({})
  })
})

describe('gabungPatchSanitasi', () => {
  it('membiarkan nilai impor saat record KR tidak mengisi field itu', () => {
    const patchImpor = patchSanitasiDariRiwayat(true, {
      kepesertaanJkn: true,
      jenisJambanSaniter: 'Cemplung',
    })
    const patchKR = patchSanitasiDariRecordKR({ tbc: true, ventilasi: true })
    const hasil = gabungPatchSanitasi(kosong(), patchImpor, patchKR)
    expect(hasil).toMatchObject({
      jkn: true,
      jambanSaniter: 'Cemplung',
      tbc: true,
      ventilasi: true,
    })
  })

  it('record KR menang untuk field yang sama', () => {
    const patchImpor = patchSanitasiDariRiwayat(true, {
      jenisJambanSaniter: 'Cemplung',
    })
    const patchKR = patchSanitasiDariRecordKR({ jambanSaniter: 'Kloset' })
    expect(
      gabungPatchSanitasi(kosong(), patchImpor, patchKR).jambanSaniter,
    ).toBe('Kloset')
  })

  it('tidak menyentuh field yang tidak ada di patch mana pun', () => {
    const hasil = gabungPatchSanitasi(
      { ...kosong(), airBersih: 'Ya' },
      patchSanitasiDariRiwayat(true, { kepesertaanJkn: true }),
    )
    expect(hasil.airBersih).toBe('Ya')
  })
})
