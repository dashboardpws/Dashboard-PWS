import { describe, expect, it } from 'vitest'
import { ringkasAnggota } from './anggota-submit'

describe('ringkasAnggota', () => {
  it('membaca payload kunjungan rumah versi baru (`anggota`)', () => {
    expect(
      ringkasAnggota({
        anggota: [
          {
            nama: 'Siti Aminah',
            nik: '3579011111111111',
            tglLahir: '1990-01-02',
            jk: 'P',
            hubKK: 'Kepala Keluarga',
            pekerjaan: 'Swasta',
          },
        ],
      }),
    ).toEqual([
      {
        nama: 'Siti Aminah',
        nik: '3579011111111111',
        tglLahir: '1990-01-02',
        jk: 'P',
        hubKK: 'Kepala Keluarga',
      },
    ])
  })

  it('membaca payload lama yang memakai `anggotaKeluarga`', () => {
    expect(
      ringkasAnggota({
        anggotaKeluarga: [
          { nama: 'Budi', nik: '3579022222222222', tglLahir: '2015-05-06' },
        ],
      }),
    ).toEqual([
      {
        nama: 'Budi',
        nik: '3579022222222222',
        tglLahir: '2015-05-06',
        jk: '',
        hubKK: '',
      },
    ])
  })

  it('mengutamakan `anggota` saat keduanya ada', () => {
    const hasil = ringkasAnggota({
      anggota: [{ nama: 'Baru' }],
      anggotaKeluarga: [{ nama: 'Lama' }],
    })
    expect(hasil.map((a) => a.nama)).toEqual(['Baru'])
  })

  it('membuang baris yang seluruh identitasnya kosong', () => {
    const hasil = ringkasAnggota({
      anggota: [{ nama: '' }, { nama: 'Ani', nik: '3579033333333333' }],
    })
    expect(hasil).toHaveLength(1)
    expect(hasil[0]?.nama).toBe('Ani')
  })

  it('mengembalikan array kosong untuk payload yang tidak berbentuk record', () => {
    expect(ringkasAnggota(null)).toEqual([])
    expect(ringkasAnggota('bukan record')).toEqual([])
    expect(ringkasAnggota({})).toEqual([])
    expect(ringkasAnggota({ anggota: 'bukan array' })).toEqual([])
  })

  it('melewati elemen yang bukan object', () => {
    expect(
      ringkasAnggota({ anggota: [null, 'teks', { nama: 'Rina' }] }),
    ).toEqual([{ nama: 'Rina', nik: '', tglLahir: '', jk: '', hubKK: '' }])
  })
})
