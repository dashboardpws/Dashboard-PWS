/**
 * Penjaga "skrip ini hanya boleh menunjuk database uji".
 *
 * Kenapa modul ini ada: sebelumnya masih ada tiga salinan identik
 * (`smoke-kunjungan-rumah.mts`, `smoke-kegiatan.mts`, dan `seed-uji-coba.mts`).
 * Pengaman data yang butuh tiga salinan akan hilang begitu salah satu diedit dan
 * lupa memperbarui yang lain — skrip yang tersisa tetap terlihat aman padahal
 * sudah tidak terlindungi. Sekarang hanya ada satu definisi.
 *
 * Penanda hanya diperiksa pada nama database, kecuali host lokal yang memang
 * diizinkan. Kredensial, hostname remote, dan query string tidak boleh membuat
 * database produksi terlihat seperti database uji.
 */

/**
 * Penanda yang membuat sebuah URL dianggap milik database uji.
 *
 * Dicocokkan terhadap nama database. Host `localhost`, `127.0.0.1`, dan `::1`
 * diperiksa terpisah supaya database lokal dengan nama biasa tetap bisa dipakai.
 *
 * Pencocokan substring sengaja longgar untuk nama database, tetapi tidak lagi
 * dilakukan pada kredensial atau bagian URL lain. Lihat {@link CATATAN_RESIKO}.
 */
export const NAMA_DB_DIIZINKAN =
  /(uji|trial|test|staging|dev|localhost|127\.0\.0\.1)/i

/**
 * Batas yang diketahui dari {@link NAMA_DB_DIIZINKAN}, disengaja dan belum
 * ditutup:
 *
 *   - Pencocokan berupa substring pada nama database, jadi database remote
 *     bernama `pws_dev_backup` atau `staging_lama` tetap ikut lolos.
 *   - Host lokal dipercaya berdasarkan hostname. Ini bukan daftar putih per
 *     lingkungan dan tidak membuktikan isi database benar-benar data uji.
 *
 * Kalau skrip uji nanti dijalankan pada remote yang berisi data produksi, pola
 * nama ini harus diganti dengan daftar putih lingkungan yang eksplisit.
 */
export const CATATAN_RESIKO =
  'Pola nama database uji masih longgar: cocok pada substring, jadi nama ' +
  "mengandung 'dev' atau 'staging' pun dianggap aman."

/**
 * Pastikan `DATABASE_URL` menunjuk database uji, atau lempar error.
 *
 * Selalu panggil sebelum menulis apa pun. Fungsi ini hanya membaca
 * environment dan tidak membuka koneksi, jadi murah dipanggil di awal skrip.
 *
 * @param konteks Nama kegiatan pada pesan error, misalnya "smoke test" atau
 *   "seed". Boleh kosong; pesan tetap menyebut aturan dan cara memperbaikinya.
 * @returns Nama database yang terdeteksi, untuk dicetak di log.
 */
export function pastikanDatabaseUji(konteks = 'skrip ini'): string {
  const url = process.env.DATABASE_URL ?? ''
  if (!url) throw new Error('DATABASE_URL belum diisi.')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(
      `DATABASE_URL tidak valid untuk ${konteks}; penjaga database uji menolak URL yang tidak bisa diparse.`,
    )
  }

  const nama = parsed.pathname.replace(/^\//, '')
  const host = parsed.hostname.toLowerCase()
  const lokal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)

  if (!lokal && !NAMA_DB_DIIZINKAN.test(nama)) {
    throw new Error(
      `Database "${nama || 'tidak dikenal'}" bukan database uji. ` +
        `Set DATABASE_URL ke database uji sebelum menjalankan ${konteks}.`,
    )
  }

  console.log(`Database uji: ${nama}`)
  return nama
}
