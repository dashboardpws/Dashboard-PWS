import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Cocokkan header `Authorization` dengan `CRON_SECRET`.
 *
 * Hanya header yang diterima. Secret di query string pernah didukung untuk uji
 * manual, tapi URL ikut tercatat di access log, proxy, dan APM — tempat yang
 * tidak seharusnya menyimpan kredensial. Uji manual sekarang memakai curl
 * dengan header yang sama seperti Vercel Cron.
 *
 * Perbandingan memakai hash supaya panjang kedua nilai tidak memengaruhi waktu
 * eksekusi, lalu `timingSafeEqual` membandingkan seluruh byte tanpa keluar dini.
 */
export function bearerCronCocok(
  header: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false

  const auth = (header ?? '').trim()
  if (!auth.toLowerCase().startsWith('bearer ')) return false

  const token = auth.slice(7).trim()
  if (!token) return false

  return sama(token, secret)
}

function hash(nilai: string): Buffer {
  return createHash('sha256').update(nilai).digest()
}

function sama(a: string, b: string): boolean {
  return timingSafeEqual(hash(a), hash(b))
}
