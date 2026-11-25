import type { KunjunganRumahFoto } from './models'
import { createRecordId } from './types'
import { MAX_FOTO } from '@/lib/constants'
import {
  compressDataUrl,
  dataUrlBytes,
  fileToDataUrl,
  MAX_TOTAL_BYTES,
  mimeFotoDidukung,
  ukuranFotoValid,
} from '@/lib/foto-file'

// Test lama mengimpor helper ini dari sini. Re-export supaya jalur lama tetap
// bekerja sementara kode asalnya sudah naik ke modul bersama.
export { compressDataUrl, fileToDataUrl, MAX_TOTAL_BYTES }

export interface PrepareResult {
  added: KunjunganRumahFoto[]
  skipped: number
}

/**
 * Siapkan foto baru dari FileList: filter tipe/ukuran, kompres,
 * hormati batas jumlah & total byte. Murni async, tanpa state.
 *
 * Satu file yang gagal TIDAK boleh menghentikan file lain. `try/catch` di
 * dalam loop itu wajib: tanpa itu, satu `RangeError` dari file kedua
 * membuat seluruh promise menolak, pemanggil tidak pernah sampai
 * `dispatch(ADD_FOTOS)`, dan foto pertama yang sudah berhasil hilang
 * bersama -- User melihat "tidak ada foto masuk" padahal ada yang sempat
 * diproses. Itu persis gejala yang dilaporkan.
 *
 * Kegagalan jadi `skipped`, bukan exception: pemanggil sudah punya jalur
 * untuk menampilkan berapa berkas yang dilewati beserta alasannya.
 */
export async function prepareFotos(
  existing: KunjunganRumahFoto[],
  files: File[],
): Promise<PrepareResult> {
  const added: KunjunganRumahFoto[] = []
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
    added.push({
      id: createRecordId(),
      name: file.name,
      dataUrl,
      caption: '',
      takenAt: new Date().toISOString(),
    })
  }
  return { added, skipped }
}
