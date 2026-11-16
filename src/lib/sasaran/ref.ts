/**
 * Ref publik sasaran untuk URL detail.
 *
 * NIK tidak boleh masuk path: nilainya ikut tersimpan di browser history,
 * access log, dan header Referer. Yang dipakai adalah `public_id` UUID dari
 * `data_warga` / `data_warga_import`.
 *
 * Fungsi ini murni supaya bisa diuji tanpa database. Pemeriksaan bentuk penting
 * sebelum nilai dikirim ke Postgres: parameter non-UUID akan membuat cast
 * `::uuid` gagal, bukan sekadar mengembalikan "tidak ditemukan".
 */
const POLA_REF_SASARAN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function refSasaranValid(ref: string): boolean {
  return POLA_REF_SASARAN.test(ref.trim())
}
