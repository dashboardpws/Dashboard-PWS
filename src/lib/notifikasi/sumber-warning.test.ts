import { describe, expect, it } from 'vitest'
import {
  deriveJadwal,
  deriveTindakLanjutDari,
  keVisitRecord,
} from './sumber-warning'
import type { VisitLike } from './sumber-warning'

const KONTROL = 'Kontrol ulang'
const SEHAT = 'Selesai - sehat / terkendali'
const RUJUK = 'Rujuk ke Puskesmas'

const visit = (
  s: Partial<VisitLike> & { id: string; nik?: string },
): VisitLike => ({
  nik: s.nik ?? '3501010101010001',
  nama: s.nama ?? 'Budi Santoso',
  kelurahan: s.kelurahan ?? 'Trajeng',
  tanggal: s.tanggal ?? '2026-10-01',
  hasil: s.hasil ?? KONTROL,
  jadwal: s.jadwal ?? '2026-10-15',
  ...s,
})

describe('keVisitRecord', () => {
  it('membaca info dan jadwal dari payload record_legacy', () => {
    const [v] = keVisitRecord([
      {
        id: 'r1',
        waktuSimpan: '2026-10-01T08:00:00.000Z',
        info: {
          nik: '3501010101010001',
          namaKK: 'Budi Santoso',
          kelurahan: 'Trajeng',
          tglPengumpulan: '2026-10-01',
        },
        hasil: KONTROL,
        jadwal: '2026-10-15',
      },
    ])
    expect(v).toMatchObject({
      id: 'r1',
      nik: '3501010101010001',
      nama: 'Budi Santoso',
      kelurahan: 'Trajeng',
      tanggal: '2026-10-01',
      jadwal: '2026-10-15',
      waktuSimpan: '2026-10-01T08:00:00.000Z',
    })
  })

  it('tanggal kunjungan pakai tglPengumpulan, bukan waktuSimpan UTC', () => {
    const [v] = keVisitRecord([
      {
        id: 'r1',
        waktuSimpan: '2026-10-01T23:30:00.000Z',
        info: { tglPengumpulan: '2026-09-30' },
      },
    ])
    // Kalau ikut waktuSimpan, tanggalnya bergeser sehari karena zona waktu.
    expect(v?.tanggal).toBe('2026-09-30')
  })

  it('membuang tanggal yang bukan YYYY-MM-DD', () => {
    const [v] = keVisitRecord([
      { id: 'r1', info: { tglPengumpulan: '01/10/2026' } },
    ])
    expect(v?.tanggal).toBe('')
  })

  it('membuang record tanpa id', () => {
    expect(
      keVisitRecord([{ info: { nik: '1' } }, null, 'bukan objek']),
    ).toHaveLength(0)
  })

  it('nik kosong jadi null, bukan string kosong', () => {
    const [v] = keVisitRecord([{ id: 'r1', info: { namaKK: 'Tanpa NIK' } }])
    expect(v?.nik).toBeNull()
  })
})

describe('deriveJadwal', () => {
  it('hanya hasil yang butuh jadwal ulang yang punya jadwal terbuka', () => {
    const list = deriveJadwal([
      visit({ id: 'a', nik: '1', hasil: KONTROL }),
      visit({ id: 'b', nik: '2', hasil: RUJUK }),
      visit({ id: 'c', nik: '3', hasil: SEHAT }),
    ])
    expect(list.map((j) => j.nik)).toEqual(['1'])
  })

  it('satu warga hanya satu jadwal: kunjungan terbaru menimpa yang lama', () => {
    const list = deriveJadwal([
      visit({
        id: 'lama',
        nik: '1',
        tanggal: '2026-09-01',
        jadwal: '2026-09-20',
      }),
      visit({
        id: 'baru',
        nik: '1',
        tanggal: '2026-10-05',
        jadwal: '2026-11-02',
      }),
    ])
    expect(list).toHaveLength(1)
    expect(list[0]?.tanggal).toBe('2026-11-02')
  })

  it('kunjungan terbaru yang menutup tindak lanjut membatalkan jadwal lamanya', () => {
    // Kunjungan sebelumnya minta kontrol ulang, tapi kunjungan berikutnya sudah
    // "Selesai" -> tidak ada lagi yang menunggu.
    const list = deriveJadwal([
      visit({
        id: 'lama',
        nik: '1',
        tanggal: '2026-09-01',
        hasil: KONTROL,
        jadwal: '2026-09-20',
      }),
      visit({
        id: 'baru',
        nik: '1',
        tanggal: '2026-10-05',
        hasil: SEHAT,
        jadwal: '',
      }),
    ])
    expect(list).toHaveLength(0)
  })

  it('waktuSimpan menentukan kunjungan terbaru pada tanggal yang sama', () => {
    const lama = visit({
      id: 'lama',
      nik: '1',
      hasil: KONTROL,
      waktuSimpan: '2026-10-01T08:00:00.000Z',
    })
    const baru = visit({
      id: 'baru',
      nik: '1',
      hasil: SEHAT,
      jadwal: '',
      waktuSimpan: '2026-10-01T09:00:00.000Z',
    })
    expect(deriveJadwal([lama, baru])).toEqual([])
    expect(deriveJadwal([baru, lama])).toEqual([])
  })

  it('jadwal yang sudah lewat tetap keluar supaya jadi warning terlambat', () => {
    const list = deriveJadwal([
      visit({ id: 'a', nik: '1', tanggal: '2026-10-01', jadwal: '2026-09-01' }),
    ])
    expect(list[0]?.status).toBe('terjadwal')
  })

  it('record tanpa NIK dibuang, tidak bisa dikelompokkan per warga', () => {
    const list = deriveJadwal([visit({ id: 'a', nik: '' })])
    expect(list).toHaveLength(0)
  })
})

describe('deriveTindakLanjutDari', () => {
  it('hanya hasil Kontrol ulang dan Rujuk ke Puskesmas yang terbuka', () => {
    const list = deriveTindakLanjutDari([
      visit({ id: 'a', nik: '1', hasil: KONTROL }),
      visit({ id: 'b', nik: '2', hasil: RUJUK }),
      visit({ id: 'c', nik: '3', hasil: SEHAT }),
    ])
    expect(list.map((t) => t.nik).sort()).toEqual(['1', '2'])
  })

  it('kunjungan terbaru menutup tindak lanjut yang sudah tidak berlaku', () => {
    const list = deriveTindakLanjutDari([
      visit({ id: 'lama', nik: '1', tanggal: '2026-09-01', hasil: RUJUK }),
      visit({ id: 'baru', nik: '1', tanggal: '2026-10-05', hasil: SEHAT }),
    ])
    expect(list).toHaveLength(0)
  })

  it('status belum, karena tidak ada sumber yang menandai sedang berjalan', () => {
    const list = deriveTindakLanjutDari([visit({ id: 'a', nik: '1' })])
    expect(list[0]?.status).toBe('belum')
  })
})
