/**
 * Ubah jawaban `survey_entries.value` (jsonb) jadi teks yang bisa dibaca.
 *
 * Dipakai panel detail riwayat submit. Bentuk jsonb-nya sudah dijaga
 * `validasiNilaiField` di `src/lib/service/form-builder/validasi.ts`, jadi
 * pemetaan di sini mengikuti bentuk itu per tipe — bukan menebak dari isi:
 *   - `text`/`textarea` → string, `number` → number, `date`/`time` → string
 *   - `select`/`radio` → `string` yang dipetakan ke label opsi
 *   - `checkbox` → `string[]`, masing-masing dipetakan ke label opsi
 *   - `group` → array object datar `{ kolom1, kolom2, ... }`
 *   - `image` → array `{ name, path, url? }`, ditampilkan sebagai jumlah foto
 *   - `file` → belum didukung, jadi "—"
 *
 * Nilai yang tidak sesuai bentuk yang diharapkan TIDAK dilempar error: record
 * yang tidak bisa dibaca tetap lebih baik ditampilkan apa adanya daripada
 * membuat satu submit gagal dibuka.
 */

import { daftarFotoJawaban } from './foto-jawaban'

export interface OpsiJawaban {
  value: string
  label: string | null
}

/** Satu baris group setelah dinormalisasi ke kolom yang terisi. */
export interface BarisGroup {
  kolom: number
  nilai: string
}

export const TANPA_NILAI = '—'

/** Teks apa adanya; bukan string (termasuk null) jadi kosong. */
export function teksNilai(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Label opsi untuk `value`, jatuh ke value-nya sendiri kalau label kosong. */
function labelOpsi(value: string, opsi: readonly OpsiJawaban[]): string {
  return opsi.find((o) => o.value === value)?.label || value
}

/** Array teks; apa pun yang bukan teks diabaikan. */
export function daftarTeks(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

/**
 * Baris group dengan nomor kolomnya, supaya UI bisa menulis "Kolom 2" tanpa
 * tebak dari kunci objek. Kolom diurutkan angka, jadi `kolom10` tidak mendahului
 * `kolom2`.
 */
export function barisGroup(value: unknown): BarisGroup[] {
  if (!Array.isArray(value)) return []

  const keluar: BarisGroup[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item))
      continue

    const kolom: Array<{ kolom: number; nilai: string }> = []
    for (const [kunci, isi] of Object.entries(
      item as Record<string, unknown>,
    )) {
      const cocok = /^kolom(\d+)$/.exec(kunci)
      if (!cocok) continue
      kolom.push({
        kolom: Number(cocok[1]),
        nilai:
          typeof isi === 'string'
            ? isi
            : isi === null || isi === undefined
              ? ''
              : String(isi),
      })
    }
    kolom.sort((a, b) => a.kolom - b.kolom)
    keluar.push(...kolom)
  }
  return keluar
}

/**
 * Teks satu jawaban. `Kosong` = nilai tidak ada (null, "", atau array kosong),
 * dipakai pemanggil untuk membedakan "belum diisi" dari "berisi string kosong".
 */
export function formatNilaiJawaban(params: {
  tipe: string
  value: unknown
  opsi?: readonly OpsiJawaban[]
}): { teks: string; kosong: boolean } {
  const { tipe, value } = params
  const opsi = params.opsi ?? []

  switch (tipe) {
    case 'number': {
      if (value === null || value === undefined)
        return { teks: TANPA_NILAI, kosong: true }
      const angka = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(angka)) return { teks: String(value), kosong: false }
      return { teks: String(angka), kosong: false }
    }

    case 'checkbox': {
      const terpilih = daftarTeks(value)
      if (terpilih.length === 0) return { teks: TANPA_NILAI, kosong: true }
      return {
        teks: terpilih.map((v) => labelOpsi(v, opsi)).join(', '),
        kosong: false,
      }
    }

    case 'select':
    case 'radio': {
      const terpilih = teksNilai(value)
      if (terpilih === '') return { teks: TANPA_NILAI, kosong: true }
      return { teks: labelOpsi(terpilih, opsi), kosong: false }
    }

    case 'group': {
      const baris = barisGroup(value)
      if (baris.length === 0) return { teks: TANPA_NILAI, kosong: true }
      return {
        teks: baris.map((b) => `Kolom ${b.kolom}: ${b.nilai}`).join(' · '),
        kosong: false,
      }
    }

    case 'image': {
      const fotos = daftarFotoJawaban(value)
      if (fotos.length === 0) return { teks: TANPA_NILAI, kosong: true }
      return { teks: `${fotos.length} foto terlampir`, kosong: false }
    }

    case 'file':
      // Belum ada jalur unggah untuk berkas selain gambar.
      return { teks: TANPA_NILAI, kosong: true }

    default: {
      // text, textarea, date, time — dan tipe tak dikenal, ditampilkan apa adanya.
      if (value === null || value === undefined)
        return { teks: TANPA_NILAI, kosong: true }
      if (typeof value === 'string')
        return { teks: value, kosong: value === '' }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return { teks: String(value), kosong: false }
      }
      return { teks: JSON.stringify(value), kosong: false }
    }
  }
}
