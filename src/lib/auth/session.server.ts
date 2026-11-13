/**
 * Login PIN dan sesi server: verifikasi PIN, cookie JWT, dan baris `valid_session`.
 * Dipanggil lewat `src/lib/api/server-fns.ts`, bukan langsung dari route atau client.
 */

import type { AuthUser } from './auth'
import type { HasilPin, StatusLockout } from './pin-attempt'
import {
  BATAS_GAGAL,
  hitungCooldown,
  pinBenar as pinBenarKebijakan,
} from './pin-attempt'
import {
  SESSION_IDLE_MS,
  SESSION_PROFILE,
  SESSION_TTL_MS,
} from '@/lib/constants'
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/server/db.server'
import { jwtVerify, SignJWT } from 'jose'
import { pinAttempts, validSession } from '@/lib/schema/schema'
import { setCookie } from '@tanstack/react-start/server'

/* ALUR SESI (hasil merge)
1. pinLogin → isValidPin → cookie httpOnly "session" (JWT, exp 12 jam) + row valid_session
2. tiap akses: touchSession = verify JWT + cek row + geser expiresAt (sliding 1 jam idle)
3. logout: destroySession = hapus row + kosongkan cookie → token lama langsung mati
*/

function getSecretKey(): Buffer {
  const secret = process.env.SECRET_KEY // ganti agar tidak ada risiko secret ikut terbundel ke client
  if (!secret) throw new Error('SECRET_KEY belum diisi di .env')
  return Buffer.from(secret, 'base64')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex') // generate token dengan hash SHA-256
}

// tambahkan jeda tetap 1 detik per percobaan PIN untuk menangani bruteforce
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Bandingkan PIN dengan waktu tetap.
 *
 * `===` keluar lebih awal begitu byte pertama beda. Untuk PIN pendek itu
 * memberi oracle: penyerang bisa mengukur selisih waktu dan memperpendek
 * tebakan. `timingSafeEqual` membandingkan seluruh isi tanpa jalur keluar
 * dini, tapi hanya aman kalau panjang kedua buffer sama — makanya normalisasi
 * dan pengecekan panjang dilakukan lebih dulu.
 *
 * Normalisasi dan politiknya ada di `src/lib/auth/pin-attempt.ts` supaya bisa
 * diuji tanpa database.
 */
function pinBenar(dariUser: string, dariEnv: string): boolean {
  return pinBenarKebijakan(dariUser, dariEnv, (a, b) =>
    timingSafeEqual(Buffer.from(a), Buffer.from(b)),
  )
}

function isSecureCookie(): boolean {
  // Secure cookie hanya untuk HTTPS (production). Di development (HTTP localhost) harus false.
  return process.env.NODE_ENV === 'production'
}

/** Berapa lama baris IP dianggap basi dan boleh dihapus. */
const USIA_BARIS_MS = 24 * 60 * 60_000

/**
 * IP pemohon untuk keperluan rate limit.
 *
 * `x-forwarded-for` berisi rantai proxy; yang pertama adalah klien asli. Kalau
 * header tidak ada (mis. dev tanpa proxy), jatuh ke satu nilai tetap supaya
 * semua permintaan lokal terhitung satu IP — untuk kiosk satu lokasi itu justru
 * perilaku yang benar, bukan degrade yang berbahaya.
 */
async function ipPemohon(): Promise<string> {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const header = getRequestHeaders() as unknown as Record<
      string,
      string | undefined
    >
    const rantai = header['x-forwarded-for']
    const pertama = rantai?.split(',')[0]?.trim()
    return pertama && pertama.length > 0 ? pertama.slice(0, 64) : 'lokal'
  } catch {
    return 'lokal'
  }
}

/**
 * Apakah IP ini sedang dalam masa lockout?
 *
 * Fail-OPEN dengan sengaja: kalau tabel `pin_attempts` tidak bisa dibaca, ini
 * mengembalikan `false` sehingga login tetap dicoba. Untuk kios puskesmas,
 * terkunci total karena Supabase DOWN jauh lebih buruk daripada tidak adanya
 * rate limit sementara. Konsekuensinya jelas dan dicatat di sini: selama DB
 * tidak terbaca, attacker mendapat laju 1 percobaan/detik tanpa lockout.
 */
async function sudahTerkunci(ip: string): Promise<StatusLockout> {
  try {
    const baris = await ambilPercobaan(ip)
    if (!baris?.terkunciSampai) return { terkunci: false, sisaMs: 0 }
    const sisa = baris.terkunciSampai.getTime() - Date.now()
    return { terkunci: sisa > 0, sisaMs: Math.max(0, sisa) }
  } catch (err) {
    console.error(
      '[pin] gagal cek status lockout, lanjut tanpa rate limit',
      err,
    )
    return { terkunci: false, sisaMs: 0 }
  }
}

type Percobaan = { gagalBerturut: number; terkunciSampai: Date | null } | null

async function ambilPercobaan(ip: string): Promise<Percobaan> {
  const [baris] = await db
    .select()
    .from(pinAttempts)
    .where(eq(pinAttempts.ip, ip))
    .limit(1)
  return baris ?? null
}

async function catatGagal(ip: string): Promise<void> {
  const lalu = await ambilPercobaan(ip)
  const gagal = (lalu?.gagalBerturut ?? 0) + 1
  const terkunci = gagal >= BATAS_GAGAL
  const till = terkunci ? new Date(Date.now() + hitungCooldown(gagal)) : null
  await db
    .insert(pinAttempts)
    .values({
      ip,
      gagalBerturut: gagal,
      terkunciSampai: till,
      terakhirGagal: new Date(),
    })
    .onConflictDoUpdate({
      target: pinAttempts.ip,
      set: {
        gagalBerturut: gagal,
        terkunciSampai: till,
        terakhirGagal: new Date(),
      },
    })
}

async function resetPercobaan(ip: string): Promise<void> {
  await db.delete(pinAttempts).where(eq(pinAttempts.ip, ip))
}

/**
 * Hapus baris basi supaya tabel tidak tumbuh tanpa batas.
 *
 * Dipanggil sesekali, bukan tiap percobaan (1 dari 20), supaya tidak
 * menambah query di jalur login. Baris yang dihapus
 * hanya yang `terkunciSampai`-nya sudah lewat DAN lebih lama dari sehari, jadi
 * sedang terkunci tidak pernah terhapus di tengah masa jeda.
 */
async function bersihkanKedaluwarsa(): Promise<void> {
  const batas = new Date(Date.now() - USIA_BARIS_MS)
  await db
    .delete(pinAttempts)
    .where(
      and(
        lt(pinAttempts.terakhirGagal, batas),
        or(
          isNull(pinAttempts.terkunciSampai),
          lt(pinAttempts.terkunciSampai, new Date()),
        ),
      ),
    )
}

export async function isValidPin(pin: string): Promise<HasilPin> {
  await sleep(1000)
  const ip = await ipPemohon()

  // Pembersian bersifat sesekali dan tidak boleh menunda login: sengaja tidak
  // di-await, cukup dijadwalkan supaya error-nya tidak menimpa jawaban.
  void bersihkanKedaluwarsa().catch((err) =>
    console.error('[pin] gagal bersihkan baris basi', err),
  )

  const { terkunci, sisaMs } = await sudahTerkunci(ip)
  // Dikembalikan apa adanya supaya halaman login bisa memberi tahu sisa
  // waktunya. Tidak membocorkan apa pun soal PIN: pengguna bisa mengamatinya
  // sendiri dengan cara mencoba, dan dijawabnya hanya "belum terkunci" atau
  // "sudah terkunci" — bukan apakah PIN-nya benar.
  if (terkunci) return { ok: false, sisaLockoutMs: sisaMs }

  if (!pinBenar(pin, process.env.PIN ?? '')) {
    void catatGagal(ip).catch((err) =>
      console.error('[pin] gagal mencatat percobaan gagal', err),
    )
    return { ok: false, sisaLockoutMs: 0 }
  }
  await resetPercobaan(ip).catch((err) =>
    console.error('[pin] gagal reset percobaan', err),
  )
  setCookie('session', await createSessionHelper(), {
    httpOnly: true,
    secure: isSecureCookie(),
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return { ok: true }
}

async function createSessionHelper() {
  const tokenPayload = {
    clientUUID: randomBytes(32).toString('base64url'), // mastiin sessionnya unique per client
    loggedInAt: new Date().toISOString(),
    profile: SESSION_PROFILE,
  }

  const secretKey = getSecretKey()
  const token = await new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_MS / 1000)
    .sign(secretKey)

  // Penulisan sesi tidak dibungkus catch: tanpa baris ini, cookie tidak
  // pernah terpasang dan login selalu gagal. Kegagalan di sini sering berarti
  // database tidak bisa ditulis, jadi dicatat agar penyebabnya terlihat di
  // log — `pin.tsx` hanya menampilkan "Gagal masuk. Coba lagi." dan tidak
  // boleh menyebut apa pun soal infrastruktur.
  await db
    .insert(validSession)
    .values({
      token: hashToken(token), // token session
      expiresAt: new Date(Date.now() + SESSION_IDLE_MS), // pastikan session hanya 1 jam
    })
    .catch((err) => {
      console.error('[auth] gagal menulis baris sesi', err)
      throw err
    })
  return token
}

const EXTEND_BEFORE_MS = 5 * 60 * 1000

// hanya extend session sebelum 5 menit session habis

// Satu page view memanggil `touchSession` tiga kali: `beforeLoad` route, middleware
// `authSessionToken` tiap server fn, lalu `AuthProvider` setelah hydration. Ketiganya
// query yang sama ke `valid_session`, dan RTT ke DB sekitar 150 ms — jadi yang mahal
// jumlah hop-nya, bukan biaya query (mean eksekusi CTE-nya cuma 0,25 ms).
//
// Cache ini memangkas hop kedua dan ketiga. Aman karena `profile` dibaca dari payload
// JWT dan `SESSION_PROFILE` konstan, bukan kolom per-user: hasil cache identik dengan
// hasil query. Yang tetap ke DB: sesi yang mau segera di-extend, supaya sliding 1 jam
// tidak tertunda.
type CacheSesi = { expiresAtMs: number; diisiPukul: number }

const cacheSesi = new Map<string, CacheSesi>()

const CACHE_SESI_TTL_MS = 30_000

// sesi idle 1 jam, jadi 30 detik masih aman
const CACHE_SESI_MAKS = 500

// token dari login lama tidak boleh menumpuk tanpa batas

function cacheSesiAmbil(tokenHash: string): CacheSesi | null {
  const e = cacheSesi.get(tokenHash)
  if (!e) return null
  if (Date.now() - e.diisiPukul > CACHE_SESI_TTL_MS) {
    cacheSesi.delete(tokenHash)
    return null
  }
  if (e.expiresAtMs - Date.now() < EXTEND_BEFORE_MS) return null // biarkan query extend jalan
  return e
}

function cacheSesiSimpan(tokenHash: string, expiresAtMs: number) {
  if (cacheSesi.size >= CACHE_SESI_MAKS) {
    const palingLama = cacheSesi.keys().next().value
    if (palingLama !== undefined) cacheSesi.delete(palingLama)
  }
  cacheSesi.set(tokenHash, { expiresAtMs, diisiPukul: Date.now() })
}

// session hanya 1 jam. token palsu/kedaluwarsa/sudah dihapus = logout
export async function touchSession(
  sessionToken: string,
): Promise<{ profile: AuthUser; expiresAt: Date }> {
  try {
    const { payload } = await jwtVerify(sessionToken, getSecretKey(), {
      algorithms: ['HS256'],
    })
    const profile = payload.profile as AuthUser | undefined
    if (!profile) throw new Error('Unauthorized')

    const tokenHash = hashToken(sessionToken)
    const cached = cacheSesiAmbil(tokenHash)
    if (cached) return { profile, expiresAt: new Date(cached.expiresAtMs) }

    const rows = await db.execute(sql`
            WITH extend AS (
                UPDATE valid_session
                SET "expiresAt" = now() + ${SESSION_IDLE_MS / 1000} * interval '1 second'
                WHERE token = ${tokenHash}
                  AND "expiresAt" > now()
                  AND "expiresAt" < now() + ${EXTEND_BEFORE_MS / 1000} * interval '1 second'
                RETURNING "expiresAt"
            )
            SELECT COALESCE(
                (SELECT extract(epoch from "expiresAt") FROM extend),
                (SELECT extract(epoch from "expiresAt") FROM valid_session
                 WHERE token = ${tokenHash} AND "expiresAt" > now())
            ) AS exp
        `)
    const exp = (rows as unknown as Array<{ exp: number | null }>)[0]?.exp
    if (!exp) {
      cacheSesi.delete(tokenHash) // jangan biarkan token yang ditolak tetap di cache
      await db.delete(validSession).where(eq(validSession.token, tokenHash)) // buang baris kedaluwarsa saat token ditolak
      throw new Error('Unauthorized')
    }
    const expiresAtMs = Number(exp) * 1000
    cacheSesiSimpan(tokenHash, expiresAtMs)
    return { profile, expiresAt: new Date(expiresAtMs) }
  } catch (err) {
    // Tanpa ini, outage database terlihat sama dengan PIN salah: pengguna
    // mencoba login berulang sepanjang DB belum pulih, dan tidak ada jejak
    // di server untuk membedakan keduanya. Detail tetap TIDAK dikirim ke
    // client — fail-closed, `Unauthorized` seperti biasa.
    console.error('[auth] gagal verifikasi sesi', err)
    throw new Error('Unauthorized')
  }
}

// logout server-side: hapus row, kosongkan cookie
export async function destroySession(sessionToken?: string) {
  if (sessionToken) {
    const tokenHash = hashToken(sessionToken)
    cacheSesi.delete(tokenHash)
    await db.delete(validSession).where(eq(validSession.token, tokenHash))
  }
  setCookie('session', '', {
    httpOnly: true,
    secure: isSecureCookie(),
    path: '/',
    maxAge: 0,
  })
}
