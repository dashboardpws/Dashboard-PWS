/**
 * Cron notifikasi harian.
 *
 * Dipanggil dari server route `/cron/notifikasi` dan dijadwalkan lewat
 * `vercel.json`. Logika di sini sengaja bebas dari HTTP: route yang membaca
 * request, modul ini yang menghitung dan mengirim.
 *
 * Isi push dibangun dari `buildWarnings` yang sama dengan lonceng Topbar dan
 * halaman /notifikasi. Cron tidak menyimpan "sudah dibaca": pengingat harian
 * memang diulang selama peringatannya masih aktif.
 *
 * Yang disimpan adalah penanda PENGIRIMAN, bukan status baca. Retry cron pada
 * hari yang sama tidak boleh menggandakan push, jadi pengiriman diklaim lebih
 * dulu lewat tabel `cron_notifikasi_terkirim` (lihat `kunciIdempotensi`).
 */

import { eq } from 'drizzle-orm'
import { buildWarnings } from '@/lib/dashboard/warning'
import { bearerCronCocok } from '@/lib/notifikasi/cron-secret'
import { kunciIdempotensi, tanggalWib } from '@/lib/notifikasi/idempotensi'
import { db } from '@/lib/server/db.server'
import { cronNotifikasiTerkirim } from '@/lib/schema/schema'
import { konfigurasiWebPush, kirimPushKeSemua } from './push.server'
import type { HasilKirimPush, PushPayload } from './push.server'
import { ambilNotifikasiData } from './data.server'

export interface HasilCronNotifikasi extends HasilKirimPush {
  /** Jumlah warning aktif saat cron jalan. */
  peringatan: number
  /** Bagian dari `peringatan` yang severity-nya kritis. */
  kritis: number
  /** True kalau tidak ada yang dikirim (tidak ada warning / VAPID bermasalah). */
  dilewati: boolean
  alasan?: string
}

/**
 * Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>` otomatis bila env
 * itu diisi. Uji manual memakai header yang sama; query string tidak lagi
 * didukung karena URL bocor ke access log dan Referer.
 */
export function secretCronCocok(request: Request): boolean {
  return bearerCronCocok(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  )
}

export async function jalankanCronNotifikasi(): Promise<HasilCronNotifikasi> {
  const data = await ambilNotifikasiData()
  const warnings = buildWarnings(data)
  const kritis = warnings.filter((w) => w.severity === 'critical').length

  const dasar = { peringatan: warnings.length, kritis, terkirim: 0, gagal: 0 }

  if (warnings.length === 0) {
    return { ...dasar, dilewati: true, alasan: 'tidak ada peringatan aktif' }
  }
  if (!konfigurasiWebPush()) {
    return {
      ...dasar,
      dilewati: true,
      alasan: 'VAPID tidak valid atau belum diisi',
    }
  }

  const hari = tanggalWib()
  const kunci = kunciIdempotensi(
    hari,
    warnings.map((w) => w.id),
  )

  // Klaim pengiriman. `ON CONFLICT DO NOTHING` membuat dua cron bersamaan hanya
  // menghasilkan satu pemenang; yang kalah langsung berhenti di sini.
  const klaim = await db
    .insert(cronNotifikasiTerkirim)
    .values({ kunci, hari })
    .onConflictDoNothing()
    .returning({ kunci: cronNotifikasiTerkirim.kunci })

  if (klaim.length === 0) {
    return {
      ...dasar,
      dilewati: true,
      alasan: 'peringatan ini sudah dikirim hari ini',
    }
  }

  const payload: PushPayload = {
    title:
      kritis > 0 ? 'PWS: ada peringatan kritis' : 'PWS: ringkasan peringatan',
    body: `${warnings.length} peringatan aktif (${kritis} kritis). Ketuk untuk melihat detail.`,
    url: '/notifikasi',
  }

  let hasil: HasilKirimPush
  try {
    hasil = await kirimPushKeSemua(payload)
  } catch (err) {
    // Pengiriman gagal total: lepaskan klaim supaya retry berikutnya boleh
    // mencoba, bukan terkunci selamanya oleh baris yang tidak pernah terkirim.
    await lepasKlaim(kunci)
    throw err
  }

  if (hasil.terkirim === 0) {
    // Tidak ada perangkat yang berhasil menerima (belum ada subscriber atau
    // semua endpoint mati). Tidak ada yang perlu dicegah terkirim dua kali.
    await lepasKlaim(kunci)
    return { ...dasar, ...hasil, dilewati: false }
  }

  await db
    .update(cronNotifikasiTerkirim)
    .set({ terkirim: hasil.terkirim })
    .where(eq(cronNotifikasiTerkirim.kunci, kunci))
    .catch((err) => {
      // Push sudah terkirim; gagal memperbarui hitungan tidak boleh membuat
      // cron membalas error dan memicu retry yang justru menggandakan push.
      console.error('[cron] gagal memperbarui penanda terkirim', err)
    })

  return { ...dasar, ...hasil, dilewati: false }
}

async function lepasKlaim(kunci: string): Promise<void> {
  await db
    .delete(cronNotifikasiTerkirim)
    .where(eq(cronNotifikasiTerkirim.kunci, kunci))
    .catch((err) => {
      console.error('[cron] gagal melepas klaim idempotensi', err)
    })
}
