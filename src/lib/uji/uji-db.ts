/**
 * Pembantu untuk skrip uji yang perlu mengubah database.
 *
 * Kenapa ada: uji yang menulis ke database lalu membersihkan sendiri dengan blok
 * `finally` pernah menghapus data yang tidak seharusnya ikut terhapus — blok
 * `finally`-nya tidak lengkap, dan tidak ada yang mengetahuinya sampai pemeriksaan
 * berikutnya gagal. Jadi aturan mainnya berubah: **skrip uji tidak boleh
 * menulis ke database kecuali di dalam transaksi yang selalu di-rollback.**
 *
 * Batasnya penting dan sering dilanggar tanpa disadari: helper ini hanya
 * mengatur transaksinya sendiri. Fungsi yang membuka `db.transaction` sendiri di
 * dalam callback — `buildFormVersion()`, `terbitkanVersiForm()`, `buatFormBaru()`
 * — akan mengambil koneksi LAIN dari pool, tidak melihat perubahan di transaksi
 * luar, lalu menunggu kunci yang dipegang transaksi luar. Hasilnya bukan error
 * yang jujur, melainkan deadlock atau commit yang lolos diam-diam. Fungsi
 * seperti itu tidak boleh dipanggil dari dalam `dalamTransaksiUji()`; pakai SQL
 * langsung atau fungsi yang menerima `tx`.
 */
import type { db } from '@/lib/server/db.server'

type Db = typeof db
type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Dilempar ke dalam transaksi supaya PostgreSQL membatalkannya. */
class SelesaiTransaksiUji extends Error {
  constructor() {
    super('transaksi uji selesai, harus dibatalkan')
    this.name = 'SelesaiTransaksiUji'
  }
}

/** Bentuk transaction runner, supaya rollback-nya bisa diuji tanpa database. */
export type TransactionRunner = Db['transaction']

/**
 * Jalankan `fn` di dalam transaksi yang **selalu** dibatalkan.
 *
 * Setelah `fn` selesai — berhasil maupun gagal — transaksi dilempar supaya
 * PostgreSQL menjalankan ROLLBACK. Tidak ada jalur di mana mutasi dari `fn`
 * bisa tersimpan, termasuk saat `fn` melempar AssertionError: error itu
 * diteruskan ke pemanggil, jadi uji yang gagal tetap terlihat sebagai kegagalan.
 *
 * `transaction` bisa diganti untuk keperluan test; kode aplikasi tidak pernah
 * melakukan itu.
 */
/** Penanda "callback tidak pernah menghasilkan nilai". */
const BELUM_ADA = Symbol('belum-ada')

export async function dalamTransaksiUji<T>(
  fn: (tx: DbTx) => Promise<T>,
  transaction?: TransactionRunner,
): Promise<T> {
  // Impor lazy hanya pada pemakaian sungguhan. Unit test yang menyuntik runner
  // tidak boleh memuat db.server dan membutuhkan DATABASE_URL hanya untuk koleksi.
  const runner =
    transaction ?? (await import('@/lib/server/db.server')).db.transaction
  let hasil: T | typeof BELUM_ADA = BELUM_ADA

  try {
    await runner(async (tx) => {
      hasil = await fn(tx)
      // Melempar apa pun yang bukan sentinel juga menggagalkan transaksi. Itu
      // disengaja: AssertionError di dalam `fn` tidak boleh berubah jadi commit
      // kalau pemanggil lupa menangkap errornya.
      throw new SelesaiTransaksiUji()
    })
  } catch (err) {
    if (!(err instanceof SelesaiTransaksiUji)) throw err
  }

  if (hasil === BELUM_ADA) {
    throw new Error(
      'dalamTransaksiUji: transaksi selesai tanpa menjalankan callback.',
    )
  }
  return hasil
}
