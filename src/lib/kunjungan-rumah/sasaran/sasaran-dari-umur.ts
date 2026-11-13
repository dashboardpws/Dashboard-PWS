/**
 * Pilih sasaran pemeriksaan dari tanggal lahir saja.
 *
 * Hanya tiga kelompok usia yang bisa ditentukan dari `tgl_lahir`:
 * `remaja`, `dewasa`, dan `lansia`. Empat kelompok lain sengaja tidak
 * dicakup, dan itu keputusan yang disengaja:
 *
 * - `bayi` (0-6 bulan) dan `balita` (6-71 bulan) butuh presisi bulan. Umur
 *   dihitung dalam tahun bulat, jadi anak 6 bulan dan 7 bulan sama-sama
 *   berumur 0 — batas 6 bulan tidak bisa dicapai dengan data yang ada.
 * - `ibu-hamil` dan `bersalin-nifas` tidak bisa disimpulkan dari tanggal lahir
 *   sama sekali. Keduanya butuh pemeriksaan kader.
 * - `tbc` bukan kelompok usia; itu muncul dari prioritas `TB`, bukan dari umur.
 *
 * Batas angka diambil dari `sasaranGroup` di `src/lib/laporan/rekap-kunjungan-rumah.ts`
 * (6/18/59/60), satu-satunya tempat di repo yang punya batas angka, bukan
 * sekadar label. Urutan pemeriksaan sama dengan urutan di sana supaya angka
 * rekap dan angka form tidak berbeda untuk anggota yang sama.
 *
 * Catatan: label template di `src/lib/kunjungan-rumah/template/kunjungan-rumah-form.ts` tidak konsisten
 * satu sama lain (`balita` berakhir 71 bulan, `remaja` mulai 6 tahun, `lansia`
 * ditulis ">60" padahal batas numeriknya 60). Yang dipakai di sini batas
 * numerik rekap, bukan labelnya.
 */
import type { SasaranKey } from '@/lib/kunjungan-rumah/template/kunjungan-rumah-form'

/** Batas atas usia remaja (inklusif), mengikuti rekap kunjungan. */
export const BATAS_REMAJA = 18
/** Batas atas usia dewasa (inklusif), mengikuti rekap kunjungan. */
export const BATAS_DEWASA = 59
/** Usia paling muda yang masuk kelompok `remaja`; di bawah ini butuh presisi bulan. */
export const BATAS_REMAJA_Bawah = 6

function tanggalKalenderSah(nilai: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return false
  const [tahun, bulan, hari] = nilai.split('-').map(Number)
  if (!tahun || !bulan || !hari || bulan < 1 || bulan > 12 || hari < 1)
    return false
  const kabisat = tahun % 4 === 0 && (tahun % 100 !== 0 || tahun % 400 === 0)
  const hariPerBulan = [
    31,
    kabisat ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  return hari <= hariPerBulan[bulan - 1]!
}

/**
 * Umur dalam tahun bulat pada `ref`, atau `null` kalau tanggal lahir tidak
 * valid. Menghitung ulang ulang tahun yang belum terlampaui, sama seperti
 * `ageOn` di rekap — supaya dua tempat ini tidak berbeda opinion.
 */
export function umurTahun(tglLahir: string, ref: string): number | null {
  if (!tanggalKalenderSah(tglLahir)) return null
  if (!tanggalKalenderSah(ref)) return null
  const [by, bm, bd] = tglLahir.split('-').map(Number)
  const [ry, rm, rd] = ref.split('-').map(Number)
  if (!by || !bm || !bd || !ry || !rm || !rd) return null
  const umur = ry - by - (rm < bm || (rm === bm && rd < bd) ? 1 : 0)
  return umur >= 0 ? umur : null
}

/**
 * Sasaran kelompok usia untuk satu tanggal lahir, atau `null` kalau tidak bisa
 * ditentukan. `null` berarti "biarkan kader memilih" — bukan berarti tidak ada
 * sasaran yang cocok.
 */
export function sasaranDariTglLahir(
  tglLahir: string,
  ref: string,
): SasaranKey | null {
  const umur = umurTahun(tglLahir, ref)
  if (umur === null) return null
  // Di bawah 6 tahun ada `bayi` dan `balita`, yang butuh presisi bulan.
  if (umur < BATAS_REMAJA_Bawah) return null
  if (umur <= BATAS_REMAJA) return 'remaja'
  if (umur <= BATAS_DEWASA) return 'dewasa'
  return 'lansia'
}
