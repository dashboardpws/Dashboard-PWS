/**
 * Entry point `pnpm db:set-non-warga`.
 *
 * Mengubah `forms.subjek_warga_wajib` menjadi false untuk form yang dibuat
 * lewat Form Builder, tanpa mengubah schema dan tanpa file migrasi drizzle
 * baru — SQL-nya sama persis dengan
 * `drizzle/manual/20261003_form-builder-tanpa-warga-wajib.sql`.
 *
 * ALASAN
 * ------
 * Flag itu dulu selalu true untuk form Form Builder. Akibatnya halaman isi
 * memaksa petugas memilih NIK warga untuk form yang isinya boleh tentang apa
 * saja, dan record-nya otomatis terhitung sebagai cakupan warga sehingga tidak
 * bisa dibedakan dari Form Kunjungan Rumah.
 *
 * YANG TIDAK DISENTUH
 * -------------------
 * Hanya baris dengan `kode IS NULL` — form Form Builder (pola yang sama dengan
 * `listFormBaru` di src/lib/server/form-builder/form.server.ts). Form
 * bawaan seeder punya `kode` terisi (CHECKLIST_KUNJUNGAN_RUMAH,
 * KEGIATAN_PEMBERDAYAAN) dan nilainya tidak berubah, jadi Form Kunjungan Rumah
 * tetap menanyakan warga.
 *
 * Skrip ini idempoten: dijalankan dua kali, baris kedua tidak mengubah apa pun.
 * Nilai `forms.subjek_warga_wajib` untuk form Form Builder juga sudah false
 * sejak `buatFormBaru`, jadi kalau semua form sudah/sekarang dibuat baru,
 * skrip ini akan melaporkan 0 baris berubah.
 *
 * HANYA UNTUK DATABASE UJI
 * -----------------------
 * Skrip ini memanggil `pastikanDatabaseUji`, jadi ia menolak menunjuk database
 * yang namanya tidak ditandai uji. Itu disengaja, bukan sekadar formalitas:
 * jalur resmi untuk menerapkan perubahan ini ke produksi adalah berkas SQL di
 * `drizzle/manual/20261003_form-builder-tanpa-warga-wajib.sql`, yang isinya sama
 * persis dan bisa ditinjau sebelum dieksekusi. Versi TypeScript ini untuk
 * pengembangan dan percobaan di database uji. Kalau suatu saat memang perlu
 * dijalankan ke produksi, jalankan SQL-nya — bukan lewat skrip ini.
 */
import 'dotenv/config'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../src/lib/server/db.server'
import { forms } from '../src/lib/schema/schema'
import { pastikanDatabaseUji } from '../src/lib/uji/database-uji'

async function hitung(): Promise<
  Array<{ nama: string; kode: string | null; wajib: boolean }>
> {
  const baris = await db
    .select({
      nama: forms.nama,
      kode: forms.kode,
      wajib: forms.subjekWargaWajib,
    })
    .from(forms)
    .where(isNull(forms.kode))
    .orderBy(forms.nama)

  return baris.map((b) => ({ nama: b.nama, kode: b.kode, wajib: b.wajib }))
}

async function main(): Promise<void> {
  // Skrip ini menulis ke production-grade forms, jadi ia tunduk pada penjaga
  // database uji yang sama seperti smoke test dan seed. Semula tidak punya,
  // sehingga bisa dijalankan ke database mana saja yang ada di DATABASE_URL.
  pastikanDatabaseUji('skrip set-non-warga')

  const sebelum = await hitung()
  const akanBerubah = sebelum.filter((f) => f.wajib)

  console.log(`Form Form Builder (kode IS NULL): ${sebelum.length}`)
  for (const f of sebelum) {
    console.log(`  - ${f.nama} · subjek_warga_wajib=${f.wajib}`)
  }

  if (akanBerubah.length === 0) {
    console.log('Tidak ada form yang perlu diubah. Selesai.')
    return
  }

  await db
    .update(forms)
    .set({ subjekWargaWajib: false })
    .where(and(isNull(forms.kode), eq(forms.subjekWargaWajib, true)))

  const sesudah = await hitung()
  const tersisa = sesudah.filter((f) => f.wajib)

  console.log(`Diubah: ${akanBerubah.length} form.`)
  if (tersisa.length > 0) {
    // Seharusnya tidak mungkin: WHERE-nya sama dengan file SQL manual. Kalau
    // sampai terjadi, laporkan apa adanya daripada diam-diam sukses.
    console.error(
      `MASIH ada form yang true: ${tersisa.map((f) => f.nama).join(', ')}`,
    )
    process.exitCode = 1
    return
  }
  console.log('Semua form Form Builder sekarang tidak mewajibkan warga.')
}

await main()
