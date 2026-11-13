import { describe, expect, it } from 'vitest'
import { initialKunjunganRumahState } from './store/kunjungan-rumah-reducer'
import { payloadDariRecord, payloadSama } from './bandingkan-payload'
import type { PayloadForm } from './bandingkan-payload'
import type { KunjunganRumahRecord } from './types'

function payloadDasar(): PayloadForm {
  const s = initialKunjunganRumahState()
  return {
    info: { ...s.info, namaKK: 'Keluarga A' },
    sanitasi: s.sanitasi,
    anggota: [
      {
        id: 'a1',
        nama: 'Warga A',
        nik: '1234567890123456',
        tglLahir: '1990-01-01',
        jk: 'P',
        hubKK: 'Kepala Keluarga',
        statusKawin: 'kawin',
        pendidikan: 'SLTA/Sederajat',
        pekerjaan: 'IRT',
      },
    ],
    penilaian: [
      {
        id: 'p1',
        anggotaId: 'a1',
        sasaran: 'dewasa',
        values: { td: '120/80', nadi: '80' },
        checks: { sehat: true },
        prioritas: [],
      },
    ],
    masalah: [
      {
        id: 'm1',
        anggotaId: 'a1',
        nama: 'Warga A',
        nik: '1234567890123456',
        tglLahir: '1990-01-01',
        alamat: 'Jl. A',
        telepon: '',
        masalah: 'Kontrol rutin',
        tindakLanjut: 'Kunjungi bulan depan',
      },
    ],
    hasil: s.hasil,
    jadwal: s.jadwal,
    ttd: s.ttd,
    fotos: [
      {
        id: 'f1',
        name: 'foto.jpg',
        path: 'kunjungan-rumah/f1.jpg',
        caption: '',
        takenAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    tambahan: { catatan: 'Aman' },
  }
}

function balikKunci(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map(balikKunci)
  if (nilai && typeof nilai === 'object') {
    return Object.fromEntries(
      Object.entries(nilai)
        .reverse()
        .map(([key, value]) => [key, balikKunci(value)]),
    )
  }
  return nilai
}

describe('payloadSama', () => {
  it('menganggap urutan kunci objek dan objek bersarang tidak berarti', () => {
    const a = payloadDasar()
    const b = balikKunci(a) as PayloadForm
    expect(Object.keys(b.info)).not.toEqual(Object.keys(a.info))
    expect(Object.keys(b.penilaian[0]!.values)).not.toEqual(
      Object.keys(a.penilaian[0]!.values),
    )
    expect(payloadSama(a, b)).toBe(true)
  })

  it.each([
    [
      'info',
      (p: PayloadForm) => ({ ...p, info: { ...p.info, namaKK: 'Baru' } }),
    ],
    [
      'sanitasi',
      (p: PayloadForm) => ({
        ...p,
        sanitasi: { ...p.sanitasi, jkn: !p.sanitasi.jkn },
      }),
    ],
    [
      'anggota',
      (p: PayloadForm) => ({
        ...p,
        anggota: [{ ...p.anggota[0]!, nama: 'Nama Baru' }],
      }),
    ],
    [
      'penilaian.values',
      (p: PayloadForm) => ({
        ...p,
        penilaian: [
          {
            ...p.penilaian[0]!,
            values: { ...p.penilaian[0]!.values, td: '130/90' },
          },
        ],
      }),
    ],
    [
      'penilaian.checks',
      (p: PayloadForm) => ({
        ...p,
        penilaian: [
          {
            ...p.penilaian[0]!,
            checks: { ...p.penilaian[0]!.checks, sehat: false },
          },
        ],
      }),
    ],
    [
      'masalah',
      (p: PayloadForm) => ({
        ...p,
        masalah: [{ ...p.masalah[0]!, tindakLanjut: 'Rujuk' }],
      }),
    ],
    ['hasil', (p: PayloadForm) => ({ ...p, hasil: `${p.hasil} berubah` })],
    ['jadwal', (p: PayloadForm) => ({ ...p, jadwal: '2026-02-01' })],
    ['ttd', (p: PayloadForm) => ({ ...p, ttd: 'Petugas' })],
    [
      'fotos',
      (p: PayloadForm) => ({
        ...p,
        fotos: [{ ...p.fotos[0]!, caption: 'Foto depan' }],
      }),
    ],
    [
      'tambahan',
      (p: PayloadForm) => ({
        ...p,
        tambahan: { ...p.tambahan, catatan: 'Berubah' },
      }),
    ],
  ])('mendeteksi perubahan pada %s', (_bagian, ubah) => {
    const a = payloadDasar()
    expect(payloadSama(a, ubah(a))).toBe(false)
  })

  it('memperlakukan urutan array sebagai perubahan data', () => {
    const a = payloadDasar()
    a.penilaian.push({ ...a.penilaian[0]!, id: 'p2' })
    const b: PayloadForm = { ...a, penilaian: [...a.penilaian].reverse() }
    expect(payloadSama(a, b)).toBe(false)
  })

  it('mengabaikan `undefined` seperti perilaku JSON', () => {
    const a = payloadDasar()
    const b: PayloadForm = { ...a, tambahan: { ...a.tambahan } }
    ;(b as Record<string, unknown>).tambahan = { x: undefined }
    a.tambahan = {}
    expect(payloadSama(a, b)).toBe(true)
  })
})

describe('payloadDariRecord', () => {
  function record(id: string, waktuSimpan: string): KunjunganRumahRecord {
    return {
      id,
      schemaVersion: 17,
      clientId: `${id}-client`,
      syncedAt: waktuSimpan,
      waktuSimpan,
      ...payloadDasar(),
    }
  }

  it('mengabaikan metadata penyimpanan tetapi mempertahankan semua field form', () => {
    const a = payloadDariRecord(record('a', '2026-01-01T00:00:00.000Z'))
    const b = payloadDariRecord(record('b', '2026-02-02T00:00:00.000Z'))
    expect(a).toEqual(payloadDasar())
    expect(a).not.toHaveProperty('id')
    expect(a).not.toHaveProperty('clientId')
    expect(a).not.toHaveProperty('syncedAt')
    expect(a).not.toHaveProperty('waktuSimpan')
    expect(a).not.toHaveProperty('schemaVersion')
    expect(payloadSama(a, b)).toBe(true)
  })
})
