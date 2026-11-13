import { describe, expect, it } from 'vitest'
import { sanitizeRecord } from './types'

describe('sanitizeRecord', () => {
  it('mengisi fotos, prioritas, sanitasi & values yang hilang dari record lama', () => {
    const rec = sanitizeRecord({
      id: 'r1',
      waktuSimpan: '2026-01-01T00:00:00.000Z',
      info: {
        tglPengumpulan: '2026-03-03',
        posyandu: 'Melati 1',
        kelurahan: 'Trajeng',
      },
      anggota: [],
      penilaian: [
        {
          id: 'p1',
          anggotaId: 'a1',
          sasaran: 'dewasa',
          values: { merokok: 'Pasif' },
        },
      ],
      masalah: [],
    })
    expect(rec).not.toBeNull()
    expect(rec!.fotos).toEqual([])
    expect(rec!.penilaian[0]!.prioritas).toEqual([])
    expect(rec!.penilaian[0]!.checks).toEqual({})
    expect(rec!.sanitasi.jkn).toBe(false)
    expect(rec!.sanitasi.ventilasi).toBe(false)
    expect(rec!.info.kecamatan).toBe('')
    expect(rec!.hasil).toBe('')
    expect(rec!.clientId).toBe('')
  })

  it('record korup (tanpa id / bukan objek) → null', () => {
    expect(sanitizeRecord(null)).toBeNull()
    expect(sanitizeRecord('x')).toBeNull()
    expect(sanitizeRecord({})).toBeNull()
    expect(sanitizeRecord({ id: 'r', info: {} })).toBeNull()
  })

  it('penilaian tanpa prioritas & checks tetap disimpan, buang entri non-objek', () => {
    const rec = sanitizeRecord({
      id: 'r2',
      waktuSimpan: '2026-01-01T00:00:00.000Z',
      info: { tglPengumpulan: '2026-03-03' },
      penilaian: [{ id: 'good', sasaran: 'lansia' }, 'garbage', 42],
      pasar: true,
    })
    expect(rec!.penilaian).toHaveLength(1)
    expect(rec!.penilaian[0]!.sasaran).toBe('lansia')
    expect(rec!.penilaian[0]!.prioritas).toEqual([])
  })

  it('membuang sasaran tak dikenal dan membersihkan isian penilaian bersarang', () => {
    const rec = sanitizeRecord({
      id: 'r3',
      waktuSimpan: '2026-01-01T00:00:00.000Z',
      info: {},
      penilaian: [
        { id: 'liar', sasaran: 'tidak-ada' },
        ['bukan', 'objek', 'penilaian'],
        {
          id: 'valid',
          sasaran: 'dewasa',
          values: { teks: 'simpan', angka: 123 },
          checks: { benar: true, salah: 'true' },
          prioritas: ['TB', 42, 'DM'],
        },
      ],
    })
    expect(rec!.penilaian).toEqual([
      expect.objectContaining({
        id: 'valid',
        values: { teks: 'simpan' },
        checks: { benar: true },
        prioritas: ['TB', 'DM'],
      }),
    ])
  })
})
