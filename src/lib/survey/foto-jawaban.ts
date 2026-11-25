/**
 * Bentuk jawaban field `image` pada form generik.
 *
 * Nilai di state client berisi `dataUrl` sementara; yang dikirim dan disimpan di
 * `survey_entries.value` hanya `{ name, path }`. `url` (signed URL) ditambahkan
 * server saat detail dibaca dan tidak pernah ditulis ke database. Pemisahan ini
 * penting karena signed URL kedaluwarsa, sedangkan jawaban harus tetap bisa
 * dibaca berbulan kemudian.
 */
import { MAX_FOTO } from '@/lib/constants'
import {
  compressDataUrl,
  dataUrlBytes,
  fileToDataUrl,
  MAX_TOTAL_BYTES,
  mimeFotoDidukung,
  ukuranFotoValid,
} from '@/lib/foto-file'

export interface FotoJawaban {
  name: string
  /** Base64 hasil kompresi, hanya ada sebelum upload. */
  dataUrl?: string
  /** Object path di bucket privat, sumber kebenaran yang disimpan. */
  path?: string
  /** Signed URL untuk pratinjau; hanya ada di response baca. */
  url?: string
}

/** Baca jawaban apa adanya tanpa mempercayai bentuk dari klien/data lama. */
export function daftarFotoJawaban(value: unknown): FotoJawaban[] {
  if (!Array.isArray(value)) return []

  const hasil: FotoJawaban[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const dataUrl = typeof o.dataUrl === 'string' ? o.dataUrl : undefined
    const path = typeof o.path === 'string' ? o.path : undefined
    if (!dataUrl && !path) continue

    hasil.push({
      name: typeof o.name === 'string' ? o.name : '',
      ...(dataUrl ? { dataUrl } : {}),
      ...(path ? { path } : {}),
      ...(typeof o.url === 'string' ? { url: o.url } : {}),
    })
    if (hasil.length >= MAX_FOTO) break
  }
  return hasil
}

/**
 * File -> dataUrl terkompres, dengan kuota per field dan total byte.
 *
 * Satu berkas yang gagal tidak boleh menghentikan berkas lain: pemanggil
 * menampilkan jumlah yang dilewati, bukan menggugurkan seluruh pilihan.
 */
export async function tambahFotoJawaban(
  existing: readonly FotoJawaban[],
  files: readonly File[],
): Promise<{ fotos: FotoJawaban[]; skipped: number }> {
  const added: FotoJawaban[] = []
  let skipped = 0
  let total = existing.reduce((acc, f) => acc + dataUrlBytes(f.dataUrl), 0)

  for (const file of files) {
    if (existing.length + added.length >= MAX_FOTO) {
      skipped++
      continue
    }
    if (!mimeFotoDidukung(file) || !ukuranFotoValid(file)) {
      skipped++
      continue
    }

    let dataUrl: string
    try {
      const raw = await fileToDataUrl(file)
      dataUrl = await compressDataUrl(raw)
    } catch {
      skipped++
      continue
    }

    if (total + dataUrlBytes(dataUrl) > MAX_TOTAL_BYTES) {
      skipped++
      continue
    }
    total += dataUrlBytes(dataUrl)
    // Server membatasi nama 200 karakter. Memotong di sini mencegah foto valid
    // ditolak gara-gara nama file dari kamera yang panjang.
    added.push({ name: file.name.slice(0, 200), dataUrl })
  }

  return { fotos: [...existing, ...added], skipped }
}

/** Bentuk yang boleh dikirim ke server: path sudah diunggah, tanpa base64. */
export function fotoJawabanUntukSimpan(
  foto: FotoJawaban,
): { name: string; path: string } | null {
  if (!foto.path) return null
  return { name: foto.name, path: foto.path }
}

/**
 * Buang `url` dan `dataUrl` sebelum ditulis. Validasi sudah memastikan tiap
 * foto punya path yang sah, jadi yang tersisa persis `{ name, path }`.
 */
export function nilaiFotoUntukDb(value: unknown): unknown {
  return daftarFotoJawaban(value)
    .map(fotoJawabanUntukSimpan)
    .filter((foto): foto is { name: string; path: string } => foto !== null)
}
