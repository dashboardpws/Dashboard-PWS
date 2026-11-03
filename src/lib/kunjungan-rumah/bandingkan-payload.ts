import type { KunjunganRumahRecord } from './types'

/**
 * Isian yang dikelola form. Metadata penyimpanan (`id`, `clientId`,
 * `syncedAt`, `waktuSimpan`, `schemaVersion`) sengaja tidak ikut: nilainya
 * selalu berubah tiap simpan, jadi kalau dibandingkan mode edit tidak akan
 * pernah dianggap "tanpa perubahan".
 */
export type PayloadForm = Pick<
  KunjunganRumahRecord,
  | 'info'
  | 'sanitasi'
  | 'anggota'
  | 'penilaian'
  | 'masalah'
  | 'hasil'
  | 'jadwal'
  | 'ttd'
  | 'fotos'
  | 'tambahan'
>

export function payloadDariRecord(record: KunjunganRumahRecord): PayloadForm {
  return {
    info: record.info,
    sanitasi: record.sanitasi,
    anggota: record.anggota,
    penilaian: record.penilaian,
    masalah: record.masalah,
    hasil: record.hasil,
    jadwal: record.jadwal,
    ttd: record.ttd,
    fotos: record.fotos,
    tambahan: record.tambahan,
  }
}

/**
 * Urutan kunci objek tidak stabil setelah bolak-balik JSONB, jadi kunci
 * diurutkan dulu sebelum di-stringify. `undefined` dibuang supaya
 * `{ a: undefined }` dan `{}` dianggap sama, seperti saat lewat JSON.
 */
function normalisasi(nilai: unknown): unknown {
  if (Array.isArray(nilai)) return nilai.map(normalisasi)
  if (nilai && typeof nilai === 'object') {
    const sumber = nilai as Record<string, unknown>
    return Object.keys(sumber)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const v = sumber[key]
        if (v !== undefined) acc[key] = normalisasi(v)
        return acc
      }, {})
  }
  return nilai
}

export function payloadSama(a: PayloadForm, b: PayloadForm): boolean {
  return JSON.stringify(normalisasi(a)) === JSON.stringify(normalisasi(b))
}
