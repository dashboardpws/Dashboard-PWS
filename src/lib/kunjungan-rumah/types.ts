import { SASARAN_KEYS } from './template/kunjungan-rumah-form'
import type {
  AnggotaKeluarga,
  KeluargaInfo,
  KunjunganRumahFoto,
  MasalahTindak,
  PenilaianForm,
  Sanitasi,
} from './models'

export const KUNJUNGAN_RUMAH_SCHEMA_VERSION = 17 as const

// Record DB — satu baris di `kunjungan_records.payload` (jsonb).
export interface KunjunganRumahRecord {
  id: string
  schemaVersion: typeof KUNJUNGAN_RUMAH_SCHEMA_VERSION
  clientId: string
  syncedAt: string | null
  waktuSimpan: string
  info: KeluargaInfo
  sanitasi: Sanitasi
  anggota: AnggotaKeluarga[]
  penilaian: PenilaianForm[]
  masalah: MasalahTindak[]
  hasil: string
  jadwal: string
  ttd: string
  fotos: KunjunganRumahFoto[]
  /** Isian section generik, kunci `${section}::${fieldId}`. */
  tambahan?: Record<string, string>
}

export function createRecordId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const SANITASI_DEFAULTS = {
  jkn: false,
  jenisAir: '',
  jambanSaniter: '',
  ventilasi: false,
  odgj: false,
  tbc: false,
  hipertensi: false,
  dm: false,
}

function makeInfo(raw: unknown): KeluargaInfo {
  const base: KeluargaInfo = {
    tglPengumpulan: '',
    alamat: '',
    kelurahan: '',
    kecamatan: '',
    kabKota: '',
    provinsi: '',
    hpKK: '',
    puskesmas: '',
    pustu: '',
    posyandu: '',
    namaKK: '',
    nik: '',
    // [perbaikan] record lama tanpa petugas → "" — expect: diminta pilih petugas saat diedit ulang.
    petugasId: '',
    petugasNama: '',
  }
  if (!raw || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>
  for (const k of Object.keys(src)) {
    if (typeof src[k] === 'string') base[k] = src[k]
  }
  return base
}

/**
 * Isian section generik: hanya string yang disimpan.
 *
 * Nilai checkbox tetap string `"true"`/`"false"` (bentuk yang dipakai
 * `FieldCell`). Record lama tanpa bagian ini mendapat objek kosong, jadi
 * membuka record lama tidak pernah menghapus isian baru yang sudah ada.
 */
function makeTambahan(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function makeValues(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function makeChecks(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

function makeSanitasi(raw: unknown): Sanitasi {
  const out: Sanitasi = { ...SANITASI_DEFAULTS }
  if (!raw || typeof raw !== 'object') return out
  const src = raw as Record<string, unknown>
  for (const k of Object.keys(src)) {
    const v = src[k]
    if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string') out[k] = v
  }
  return out
}

/**
 * Sanitasi satu record dari JSON korup / versi lama.
 * Isi field yang hilang dengan default, buang entri yang tak bisa diselamatkan.
 * Return null bila record tidak layak (id/waktuSimpan/info/array wajib tidak ada).
 */
export function sanitizeRecord(raw: unknown): KunjunganRumahRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return null
  if (typeof o.waktuSimpan !== 'string' || !o.waktuSimpan) return null
  if (!o.info || typeof o.info !== 'object') return null

  const pn = Array.isArray(o.penilaian) ? o.penilaian : []
  const penilaian = pn
    .filter(
      (p): p is Record<string, unknown> =>
        !!p && typeof p === 'object' && !Array.isArray(p),
    )
    // Sasaran liar tidak boleh lolos sebagai cast: konsumen mengakses template
    // berdasarkan kunci ini dan akan crash. Record tanpa sasaran tetap memakai
    // default lama "dewasa" agar kompatibilitasnya tidak berubah.
    .filter(
      (p) =>
        typeof p.sasaran !== 'string' ||
        (SASARAN_KEYS as readonly string[]).includes(p.sasaran),
    )
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : createRecordId(),
      anggotaId: typeof p.anggotaId === 'string' ? p.anggotaId : '',
      sasaran: (typeof p.sasaran === 'string'
        ? p.sasaran
        : 'dewasa') as PenilaianForm['sasaran'],
      values: makeValues(p.values),
      checks: makeChecks(p.checks),
      prioritas: Array.isArray(p.prioritas)
        ? p.prioritas.filter((v): v is string => typeof v === 'string')
        : [],
    }))

  return {
    id: o.id,
    schemaVersion: KUNJUNGAN_RUMAH_SCHEMA_VERSION,
    clientId: typeof o.clientId === 'string' ? o.clientId : '',
    syncedAt: typeof o.syncedAt === 'string' ? o.syncedAt : null,
    waktuSimpan: o.waktuSimpan,
    info: makeInfo(o.info),
    sanitasi: makeSanitasi(o.sanitasi),
    anggota: Array.isArray(o.anggota) ? (o.anggota as AnggotaKeluarga[]) : [],
    penilaian,
    masalah: Array.isArray(o.masalah) ? (o.masalah as MasalahTindak[]) : [],
    hasil: typeof o.hasil === 'string' ? o.hasil : '',
    jadwal: typeof o.jadwal === 'string' ? o.jadwal : '',
    ttd: typeof o.ttd === 'string' ? o.ttd : '',
    fotos: Array.isArray(o.fotos) ? (o.fotos as KunjunganRumahFoto[]) : [],
    tambahan: makeTambahan(o.tambahan),
  }
}
