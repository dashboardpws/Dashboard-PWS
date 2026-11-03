/** Upload dokumentasi ke Supabase Storage bucket `foto` (publik, anon via PIN-gate app).
 *  Dipakai sebelum simpan record — DB hanya menyimpan fileUrl, bukan base64.
 */
const BUCKET = 'foto'
const MAX_DETAIL_LEN = 300

export class StorageUploadError extends Error {
  status: number
  detail: string
  bucket: string
  bytes: number
  contentType: string
  constructor(opts: {
    status: number
    detail: string
    bytes: number
    contentType: string
  }) {
    super(`Upload foto gagal (${opts.status}): ${opts.detail}`)
    this.name = 'StorageUploadError'
    this.status = opts.status
    this.detail = opts.detail
    this.bucket = BUCKET
    this.bytes = opts.bytes
    this.contentType = opts.contentType
  }
}

/** Ambil env var. `import.meta.env` hanya di-fill Vite untuk akses statis
 *  (`import.meta.env.X`), sedangkan akses dinamis `env[name]` kosong di luar
 *  dev server — jadi `process.env` (yang dipakai Vitest) jadi cadangan. */
 function env(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
   const values: Record<string, string | undefined> = {
     VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ?? (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined),
     VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined),
   }
 
   const v = values[name]
   if (!v) throw new Error(`${name} belum diisi`)
   return v
 }

/** Ambil pesan relevan dari body error Supabase. Tahan terhadap JSON tidak valid. */
function extractDetail(raw: string, statusText: string): string {
  const text = raw.trim().slice(0, MAX_DETAIL_LEN)
  if (!text) return statusText || 'unknown error'
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      for (const key of ['message', 'error_description', 'error', 'msg']) {
        const val = obj[key]
        if (typeof val === 'string' && val.trim())
          return val.trim().slice(0, MAX_DETAIL_LEN)
      }
    }
    return text
  } catch {
    return text || statusText || 'unknown error'
  }
}

function objectPath(prefix: string, name: string): string {
  const safe =
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .slice(-80) || 'foto.jpg'
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}/${Date.now()}-${id}-${safe}`
}

async function putObject(
  path: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  const base = env('VITE_SUPABASE_URL').replace(/\/$/, '')
  const anon = env('VITE_SUPABASE_PUBLISHABLE_KEY')
  const bytes = typeof body.size === 'number' ? body.size : 0
  let res: Response
  try {
    res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': contentType,
      },
      body,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new StorageUploadError({
      status: 0,
      detail: `jaringan/fetch gagal: ${msg}`.slice(0, MAX_DETAIL_LEN),
      bytes,
      contentType,
    })
  }
  if (!res.ok) {
    let raw = ''
    try {
      raw = await res.text()
    } catch {
      raw = ''
    }
    throw new StorageUploadError({
      status: res.status,
      detail: extractDetail(raw, res.statusText),
      bytes,
      contentType,
    })
  }
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; type: string } {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!m) throw new Error('Format foto tidak valid')
  const type = m[1] || 'image/jpeg'
  const bin = atob(m[3] ?? '')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { blob: new Blob([bytes], { type }), type }
}

/** Upload satu dataUrl terkompresi → URL publik. */
export async function uploadDataUrl(
  dataUrl: string,
  prefix = 'kunjungan-rumah',
): Promise<string> {
  const { blob, type } = dataUrlToBlob(dataUrl)
  const ext = type.includes('png')
    ? 'png'
    : type.includes('webp')
      ? 'webp'
      : 'jpg'
  return putObject(objectPath(prefix, `foto.${ext}`), blob, type)
}
