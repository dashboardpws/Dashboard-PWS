import { describe, expect, it } from 'vitest'
import { initialKunjunganRumahState } from './store/kunjungan-rumah-reducer'
import { payloadDariRecord, payloadSama } from './bandingkan-payload'
import type { PayloadForm } from './bandingkan-payload'
import type { KunjunganRumahRecord } from './types'

function payloadDasar(): PayloadForm {
  const s = initialKunjunganRumahState()
  return {
    info: s.info,
    sanitasi: s.sanitasi,
    anggota: s.anggota,
    penilaian: s.penilaian,
    masalah: s.masalah,
    hasil: s.hasil,
    jadwal: s.jadwal,
    ttd: s.ttd,
    fotos: s.fotos,
    tambahan: s.tambahan,
  }
}

describe('payloadSama', () => {
  it('menganggap urutan kunci tidak berarti', () => {
    const a = payloadDasar()
    const b = { ...a, info: { ...a.info } }
    expect(payloadSama(a, b)).toBe(true)
  })

  it('mendeteksi perubahan nilai isian', () => {
    const a = payloadDasar()
    const b = { ...a, info: { ...a.info, namaKK: 'Nama Baru' } }
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
  it('mengabaikan metadata penyimpanan', () => {
    const dasar = payloadDasar()
    const rec = (id: string, waktuSimpan: string): KunjunganRumahRecord => ({
      id,
      schemaVersion: 17,
      clientId: `${id}-client`,
      syncedAt: waktuSimpan,
      waktuSimpan,
      ...dasar,
    })
    const a = payloadDariRecord(rec('a', '2026-01-01T00:00:00.000Z'))
    const b = payloadDariRecord(rec('b', '2026-02-02T00:00:00.000Z'))
    expect(payloadSama(a, b)).toBe(true)
  })
})
