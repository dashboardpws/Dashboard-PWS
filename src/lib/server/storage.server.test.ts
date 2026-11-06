import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deteksiMime,
  pathDariFileUrl,
  pathFotoValid,
  signedUrls,
  unggahFoto,
} from '@/lib/server/storage.server'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
])
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
)
const MAX_BYTES = 2 * 1024 * 1024

function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('deteksiMime', () => {
  it('mengenali magic bytes JPEG/PNG/WebP', () => {
    expect(deteksiMime(JPEG)).toBe('image/jpeg')
    expect(deteksiMime(PNG)).toBe('image/png')
    expect(deteksiMime(WEBP)).toBe('image/webp')
  })

  it('menolak SVG dan data acak', () => {
    expect(deteksiMime(SVG)).toBeNull()
    expect(deteksiMime(new Uint8Array([0x00, 0x01, 0x02]))).toBeNull()
  })
})

describe('pathFotoValid', () => {
  it('menerima path di prefix kunjungan-rumah', () => {
    expect(pathFotoValid('kunjungan-rumah/abc-123.jpg')).toBe(true)
    expect(pathFotoValid('kunjungan-rumah/AbC_9.png')).toBe(true)
  })

  it('menolak traversal, prefix lain, dan ekstensi aneh', () => {
    expect(pathFotoValid('../kunjungan-rumah/a.jpg')).toBe(false)
    expect(pathFotoValid('kunjungan-rumah/a.svg')).toBe(false)
    expect(pathFotoValid('lain/a.jpg')).toBe(false)
    expect(pathFotoValid('kunjungan-rumah/sub/a.jpg')).toBe(false)
  })
})

describe('pathDariFileUrl', () => {
  it('mengambil object path dari URL publik lama', () => {
    expect(
      pathDariFileUrl(
        'https://proj.supabase.co/storage/v1/object/public/foto/kunjungan-rumah/a.jpg',
      ),
    ).toBe('kunjungan-rumah/a.jpg')
  })

  it('null untuk host/path lain dan traversal', () => {
    expect(pathDariFileUrl('https://evil.test/foto/a.jpg')).toBeNull()
    expect(
      pathDariFileUrl(
        'https://proj.supabase.co/storage/v1/object/public/foto/../a.jpg',
      ),
    ).toBeNull()
    expect(pathDariFileUrl('bukan url')).toBeNull()
  })
})

describe('unggahFoto (mocked fetch)', () => {
  it('upload JPEG lalu mengembalikan path, memakai service role', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const hasil = await unggahFoto(
      dataUrl('image/jpeg', JPEG),
      'kunjungan-rumah',
    )

    expect(hasil.path).toMatch(/^kunjungan-rumah\/[\w-]+\.jpg$/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      `https://proj.supabase.co/storage/v1/object/foto/${hasil.path}`,
    )
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer service-role-test')
    expect(headers['Content-Type']).toBe('image/jpeg')
    expect(headers['x-upsert']).toBe('false')
  })

  it('menolak prefix di luar daftar izin', async () => {
    await expect(
      unggahFoto(dataUrl('image/jpeg', JPEG), 'lain'),
    ).rejects.toThrow('Prefix foto tidak diizinkan')
  })

  it('menolak SVG walau client mengaku image/jpeg', async () => {
    await expect(
      unggahFoto(dataUrl('image/jpeg', SVG), 'kunjungan-rumah'),
    ).rejects.toThrow('Tipe foto tidak didukung')
  })

  it('menolak file di atas 2 MB', async () => {
    const besar = new Uint8Array(MAX_BYTES + 1)
    besar.set(JPEG)
    await expect(
      unggahFoto(dataUrl('image/jpeg', besar), 'kunjungan-rumah'),
    ).rejects.toThrow('Ukuran foto melebihi 2 MB')
  })

  it('melempar pesan galat saat Storage menolak', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'nope' }, false, 403)),
    )
    await expect(
      unggahFoto(dataUrl('image/png', PNG), 'kunjungan-rumah'),
    ).rejects.toThrow('Upload foto gagal (403)')
  })
})

describe('signedUrls (mocked fetch)', () => {
  it('menggabungkan signedURL relatif jadi absolut', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([
        {
          path: 'kunjungan-rumah/a.jpg',
          signedURL: '/object/sign/foto/kunjungan-rumah/a.jpg?token=x',
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const hasil = await signedUrls([
      'kunjungan-rumah/a.jpg',
      'kunjungan-rumah/a.jpg',
      'tidak-valid',
    ])

    expect(hasil).toEqual({
      'kunjungan-rumah/a.jpg':
        'https://proj.supabase.co/storage/v1/object/sign/foto/kunjungan-rumah/a.jpg?token=x',
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    )
    expect(body).toEqual({ expiresIn: 3600, paths: ['kunjungan-rumah/a.jpg'] })
  })

  it('mengembalikan objek kosong saat Storage gagal (tidak melempar)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'err' }, false, 500)),
    )
    await expect(signedUrls(['kunjungan-rumah/a.jpg'])).resolves.toEqual({})
  })
})
