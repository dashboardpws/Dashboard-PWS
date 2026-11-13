import { hasilKind } from '@/lib/kunjungan-rumah/hasil'
import { deriveTindakLanjut, kunjunganLebihBaru } from '@/lib/dashboard/warning'
import type {
  JadwalItem,
  KunjunganRecordLike,
  TindakLanjutItem,
} from '@/lib/dashboard/warning'

/**
 * Jembatan dari payload `record_legacy` ke input `buildWarnings`.
 *
 * `warning.ts` sengaja tidak menyentuh database maupun bentuk payload form.
 * Dia hanya menerima `{ regions, jadwal?, tindakLanjut? }`. File ini yang
 *menterjemahkan bentuk aslinya, supaya builder tetap murni dan bisa dites
 * tanpa database.
 *
 * Dua slot yang SEBELUMNYA tidak pernah diisi (dashboard selalu mengirim
 * `jadwal` dan `tindakLanjut` kosong) berasal dari sini:
 * - `jadwal`       : field tanggal "kunjungan berikutnya" di form Hasil.
 * - `tindakLanjut` : diturunkan dari `hasil` kunjungan terakhir per warga.
 */

/** Record kunjungan rumah, sudah dibersihkan ke bentuk minimum yang dipakai. */
export interface VisitLike {
  id: string
  nik: string | null
  nama: string
  kelurahan: string
  /** YYYY-MM-DD tanggal kunjungan. */
  tanggal: string
  hasil: string
  /** YYYY-MM-DD, atau string kosong bila form tidak meminta jadwal ulang. */
  jadwal: string
  /** Stempel server untuk memutuskan kunjungan pada tanggal yang sama. */
  waktuSimpan?: string
}

const TEKS = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Hanya `YYYY-MM-DD` yang dianggap tanggal sah; form bisa menyimpan apa saja. */
function isoTanggal(v: unknown): string {
  const s = TEKS(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

/**
 * Ubah hasil `listKunjunganRumahRecords()` (payload jsonb mentah) menjadi
 * `VisitLike`.
 *
 * Catatan: `waktuSimpan` memakai stempel waktu server dalam UTC, jadi hanya
 * dipakai sebagai cadangan kalau `info.tglPengumpulan` kosong. Tanggal
 * kunjungan yang benar selalu milik field form, bukan jam penyimpanan.
 */
export function keVisitRecord(records: unknown[]): VisitLike[] {
  const out: VisitLike[] = []
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue
    const rec = raw as Record<string, unknown>
    const info = (
      rec.info && typeof rec.info === 'object' ? rec.info : {}
    ) as Record<string, unknown>
    const id = TEKS(rec.id)
    if (!id) continue
    out.push({
      id,
      nik: TEKS(info.nik) || null,
      nama: TEKS(info.namaKK) || TEKS(info.nama_art) || '-',
      kelurahan: TEKS(info.kelurahan) || '-',
      tanggal: isoTanggal(info.tglPengumpulan) || isoTanggal(rec.waktuSimpan),
      hasil: TEKS(rec.hasil),
      jadwal: isoTanggal(rec.jadwal),
      waktuSimpan: TEKS(rec.waktuSimpan) || undefined,
    })
  }
  return out
}

/** Bentuk yang dibaca `buildWarnings()` lewat adapter `KunjunganRecordLike`. */
export function keKunjunganRecordLike(
  visits: VisitLike[],
): KunjunganRecordLike[] {
  return visits.map((v) => ({
    id: v.id,
    nik: v.nik,
    nama: v.nama,
    kelurahan: v.kelurahan,
    tanggal: v.tanggal,
    hasil: v.hasil || null,
    waktuSimpan: v.waktuSimpan,
  }))
}

/** Kunjungan TERBARU per NIK. Tanpa NIK tidak bisa dikelompokkan, jadi dibuang. */
function kunjunganTerbaru(visits: VisitLike[]): VisitLike[] {
  const latest = new Map<string, VisitLike>()
  for (const v of visits) {
    if (!v.nik) continue
    const cur = latest.get(v.nik)
    if (!cur || kunjunganLebihBaru(v, cur)) latest.set(v.nik, v)
  }
  return [...latest.values()]
}

/**
 * Jadwal kunjungan yang masih terbuka, per warga.
 *
 * Tiga aturan, semuanya diturunkan dari data yang sudah ada:
 * 1. Hanya hasil yang berarti "butuh jadwal ulang" (`hasilKind() === "jadwal"`)
 *    yang punya jadwal. Hasil "Rujuk ke Puskesmas" memang tidak punya tanggal
 *    kunjungan berikutnya, dan "Selesai" berarti tidak ada yang menunggu.
 * 2. Satu warga maksimal satu jadwal terbuka. Kunjungan berikutnya menggantikan
 *    jadwal yang lama; kalau tidak, daftar akan menumpuk jadwal basi.
 * 3. Tanggal yang sudah lewat tetap dipertahankan dengan status "terjadwal".
 *    Justru itulah yang membuat `jadwal_terlambat` di `warning.ts` menyala.
 *    Status "batal"/"selesai" tidak pernah diemisi dari sini karena belum ada
 *    sumber yang bisa membuktikannya.
 */
export function deriveJadwal(visits: VisitLike[]): JadwalItem[] {
  const out: JadwalItem[] = []
  for (const v of kunjunganTerbaru(visits)) {
    if (!v.jadwal) continue
    if (hasilKind(v.hasil) !== 'jadwal') continue
    out.push({
      id: v.id,
      nik: v.nik,
      nama: v.nama,
      kelurahan: v.kelurahan,
      tanggal: v.jadwal,
      status: 'terjadwal',
    })
  }
  return out
}

/**
 * Tindak lanjut yang masih terbuka. Langsung memakai `deriveTindakLanjut()`
 * dari `warning.ts`, jadi aturan "kunjungan terbaru per warga" tidak ditulis
 * dua kali.
 */
export function deriveTindakLanjutDari(
  visits: VisitLike[],
): TindakLanjutItem[] {
  return deriveTindakLanjut(keKunjunganRecordLike(visits))
}

/** Satu pintu masuk: dari payload mentah langsung ke dua sumber warning. */
export function sumberWarningDari(records: unknown[]): {
  jadwal: JadwalItem[]
  tindakLanjut: TindakLanjutItem[]
} {
  const visits = keVisitRecord(records)
  return {
    jadwal: deriveJadwal(visits),
    tindakLanjut: deriveTindakLanjutDari(visits),
  }
}
