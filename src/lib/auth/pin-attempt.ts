/**
 * Kebijakan lockout PIN — bagian murni, tanpa database.
 *
 * Dipisah dari `isValidPin` di `src/lib/auth/session.server.ts` supaya bisa diuji
 * tanpa instance Postgres. Akses tabel `pin_attempts` tetap di sana; yang
 * dipindahkan ke sini hanya keputusan: bagaimana PIN dinormalisasi,
 * bagaimana dibandingkan, dan berapa lama IP terkunci.
 *
 * Angka di bawah disetel untuk satu kios puskesmas: 5 kesalahan tolerated
 * masih masuk akal untuk salah ketik, dan jeda 15 menit membuat brute-force
 * 1 juta kombinasi tidak realistis.
 */

/** Ambang percobaan gagal sebelum IP dikunci. */
export const BATAS_GAGAL = 5

/** Jeda awal saat IP pertama kali dikunci. */
export const COOLDOWN_AWAL_MS = 15_000

/** Plafon jeda, supaya IP yang terus mencoba tidak terkunci selamanya. */
export const COOLDOWN_MAKS_MS = 15 * 60_000

/**
 * Buang nol di depan, tapi sisakan minimal satu digit: "012345" dan "12345"
 * harus dianggap PIN yang sama.
 *
 * PIN datang dari environment sebagai teks, sedangkan yang diketik orang bisa
 * saja dengan atau tanpa nol di depan. Tanpa normalisasi ini, PIN berawalan nol
 * tidak akan pernah bisa login.
 */
export function normalkanPin(nilai: string): string {
  return nilai.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

/**
 * Bandingkan PIN dengan waktu tetap.
 *
 * `===` keluar lebih awal begitu byte pertama beda. Untuk PIN pendek, itu
 * memberi oracle: penyerang bisa mengukur selisih waktu dan memperpendek
 * tebakan. `timingSafeEqual` membandingkan seluruh isi tanpa jalur keluar
 * dini — tapi HANYA aman kalau panjang kedua buffer sama, makanya panjang
 * dicek lebih dulu di sini.
 *
 * Versi bawaan memakai loop tanpa `node:crypto` agar modul ini tetap aman
 * diimpor halaman login. Server menyuntik `timingSafeEqual`; normalisasi, fail
 * closed, dan pemeriksaan panjang tetap memakai implementasi yang diuji di sini.
 */
export function pinBenar(
  dariUser: string,
  dariEnv: string,
  bandingkanSamaPanjang?: (a: string, b: string) => boolean,
): boolean {
  const a = normalkanPin(dariUser)
  const b = normalkanPin(dariEnv)
  // Fail closed: PIN kosong berarti `PIN` tidak terisi di environment atau
  // field dikosongkan. Dua-duanya harus menolak, bukan dianggap cocok.
  if (a.length === 0 || b.length === 0) return false
  if (a.length !== b.length) return false
  if (bandingkanSamaPanjang) return bandingkanSamaPanjang(a, b)
  let beda = 0
  for (let i = 0; i < a.length; i += 1) {
    beda |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return beda === 0
}

/**
 * Status lockout satu IP. `sisaMs` 0 berarti tidak terkunci.
 */
export interface StatusLockout {
  terkunci: boolean
  sisaMs: number
}

/**
 * Hasil percobaan login.
 *
 * `sisaLockoutMs` hanya diisi kalau alasannya lockout, supaya halaman login
 * bisa membedakan "terlalu banyak mencoba" dari "PIN salah". Keduanya tetap
 * ditolak — bentuk hasil tidak pernah membuka akses.
 */
export type HasilPin = { ok: true } | { ok: false; sisaLockoutMs: number }

/**
 * Sisa lockout dalam menit bulat ke atas, minimal 1.
 *
 * `Math.max(1, ...)` itu wajib: sisa 30 detik harus tampil "1 menit", bukan
 * "0 menit" — kalau "0 menit" tampil, pengguna akan langsung mencoba lagi,
 * lalu ketemu lockout yang sama dan mengira sistemnya rusak.
 */
export function sisaMenit(sisaMs: number): number {
  return Math.max(1, Math.ceil(sisaMs / 60_000))
}

/**
 * Jeda lockout untuk kegagalan ke-`gagal`: 15s, 30s, 60s, ... sampai plafon 15
 * menit. Pengguna sah yang salah ketik bisa terjebak cukup lama, jadi plafonnya
 * dibatasi dan pesannya perlu menjelaskan ke user.
 */
export function hitungCooldown(gagal: number): number {
  const pangkat = Math.max(0, Math.min(gagal - BATAS_GAGAL, 20))
  return Math.min(COOLDOWN_AWAL_MS * 2 ** pangkat, COOLDOWN_MAKS_MS)
}
