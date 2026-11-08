import { createHash } from 'node:crypto'

/**
 * Tanggal kalender WIB (`YYYY-MM-DD`).
 *
 * Jadwal Vercel memakai UTC, sedangkan notifikasi berbicara tentang "hari ini"
 * bagi kader di Indonesia. Tanpa zona eksplisit, cron 07.00 UTC (= 14.00 WIB)
 * tetap tanggal yang sama, tapi cron yang digeser ke dini hari UTC akan
 * menghitung hari yang salah.
 */
export function tanggalWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * Kunci idempotensi satu pengiriman cron.
 *
 * Kunci terdiri dari tanggal WIB dan sidik jari daftar id peringatan. Daftar
 * diurutkan lebih dulu supaya urutan `buildWarnings` tidak mengubah kunci.
 * Konsekuensinya: peringatan yang sama pada hari yang sama tidak dikirim dua
 * kali (retry cron tidak menggandakan push), tapi peringatan yang berubah isinya
 * tetap mendapat push baru.
 */
export function kunciIdempotensi(
  hari: string,
  warningIds: readonly string[],
): string {
  const isi = [...warningIds].sort().join('\n')
  const sidik = createHash('sha256').update(isi).digest('hex').slice(0, 32)
  return `${hari}:${sidik}`
}
