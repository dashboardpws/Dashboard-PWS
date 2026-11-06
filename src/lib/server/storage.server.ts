/**
 * Supabase Storage untuk foto warga.
 *
 * Bucket `foto` privat. Browser tidak pernah memegang kunci Supabase; upload dan
 * pembacaan lewat server function yang sudah dijaga `authSessionToken`. Service
 * role dipakai di sini karena aplikasi tidak memakai Supabase Auth, jadi policy
 * RLS tidak punya identitas untuk dicek.
 *
 * DB hanya menyimpan `path` object. URL publik/signed tidak pernah disimpan:
 * signed URL berumur pendek dan akan kedaluwarsa.
 */

import { MAX_FILE_BYTES } from '@/lib/constants'

const BUCKET = 'foto'
const EXPIRES_IN = 3600
const PREFIX_DIIZINKAN = new Set(['kunjungan-rumah'])
const EKSTENSI: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const PATH_FOTO = /^kunjungan-rumah\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/
const DATA_URL =
  /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/

function env(nama: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const nilai =
    nama === 'SUPABASE_URL'
      ? (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)
      : (process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SECRET_KEY)

  if (!nilai) throw new Error(`${nama} belum diisi`)
  return nilai.replace(/\/$/, '')
}

function headerService(): Record<string, string> {
  const kunci = env('SUPABASE_SERVICE_ROLE_KEY')
  return { apikey: kunci, Authorization: `Bearer ${kunci}` }
}

/** Deteksi tipe dari magic bytes. Jangan percaya `Content-Type` dari client. */
export function deteksiMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export function pathFotoValid(path: string): boolean {
  return PATH_FOTO.test(path)
}

/** Ambil object path dari URL Supabase lama (`/object/public/foto/...`). */
export function pathDariFileUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const penanda = `/storage/v1/object/public/${BUCKET}/`
    const i = u.pathname.indexOf(penanda)
    if (i === -1) return null
    const path = decodeURIComponent(u.pathname.slice(i + penanda.length))
    return pathFotoValid(path) ? path : null
  } catch {
    return null
  }
}

function bytesDariDataUrl(dataUrl: string): {
  bytes: Uint8Array
  mime: string
} {
  const cocok = DATA_URL.exec(dataUrl)
  if (!cocok) throw new Error('Format foto tidak valid')

  const bytes = new Uint8Array(Buffer.from(cocok[2] ?? '', 'base64'))
  if (bytes.length === 0) throw new Error('Foto kosong')
  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error('Ukuran foto melebihi 2 MB')
  }

  const mime = deteksiMime(bytes)
  if (!mime) throw new Error('Tipe foto tidak didukung (JPEG/PNG/WebP)')
  return { bytes, mime }
}

function detailError(status: number, teks: string): string {
  return `Upload foto gagal (${status}): ${teks.slice(0, 300) || 'unknown'}`
}

/** Upload satu dataUrl terkompresi ke bucket privat. Mengembalikan object path. */
export async function unggahFoto(
  dataUrl: string,
  prefix: string,
): Promise<{ path: string }> {
  if (!PREFIX_DIIZINKAN.has(prefix)) {
    throw new Error('Prefix foto tidak diizinkan')
  }

  const { bytes, mime } = bytesDariDataUrl(dataUrl)
  const path = `${prefix}/${crypto.randomUUID()}.${EKSTENSI[mime]}`
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer

  let res: Response
  try {
    res = await fetch(
      `${env('SUPABASE_URL')}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          ...headerService(),
          'Content-Type': mime,
          'cache-control': '3600',
          'x-upsert': 'false',
        },
        body,
      },
    )
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e)
    throw new Error(detailError(0, `jaringan/fetch gagal: ${pesan}`))
  }

  if (!res.ok) {
    let teks = ''
    try {
      teks = await res.text()
    } catch {
      teks = ''
    }
    throw new Error(detailError(res.status, teks))
  }

  return { path }
}

/**
 * Buat signed URL untuk banyak path sekaligus.
 *
 * Kegagalan tidak dilempar: pemanggil lebih baik menampilkan foto lama/placeholder
 * daripada menggagalkan seluruh halaman karena Storage sedang bermasalah.
 */
export async function signedUrls(
  paths: string[],
): Promise<Record<string, string>> {
  const unik = [...new Set(paths.filter(pathFotoValid))]
  if (unik.length === 0) return {}

  const base = env('SUPABASE_URL')
  try {
    const res = await fetch(`${base}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: {
        ...headerService(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: EXPIRES_IN, paths: unik }),
    })
    if (!res.ok) {
      console.error(`[foto] gagal sign (${res.status})`)
      return {}
    }

    const data: unknown = await res.json()
    if (!Array.isArray(data)) return {}

    const hasil: Record<string, string> = {}
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const baris = item as {
        path?: unknown
        signedURL?: unknown
        signedUrl?: unknown
      }
      // Storage API mengembalikan `signedURL`; sebagian versi memakai `signedUrl`.
      const signedURL = baris.signedURL ?? baris.signedUrl
      if (typeof baris.path !== 'string' || typeof signedURL !== 'string')
        continue
      if (!pathFotoValid(baris.path)) continue
      hasil[baris.path] = signedURL.startsWith('http')
        ? signedURL
        : `${base}/storage/v1${signedURL}`
    }
    return hasil
  } catch (e) {
    console.error(
      '[foto] gagal membuat signed URL',
      e instanceof Error ? e.message : String(e),
    )
    return {}
  }
}
