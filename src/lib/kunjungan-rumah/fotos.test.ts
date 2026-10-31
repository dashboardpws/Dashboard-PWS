import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_FOTO } from '@/lib/constants'
import { MAX_TOTAL_BYTES, fileToDataUrl, prepareFotos } from './fotos'
import type { KunjunganRumahFoto } from './models'

function jpg(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
}

const existingFoto: KunjunganRumahFoto = {
  id: 'f0',
  name: 'lama.jpg',
  dataUrl: 'data:image/jpeg;base64,AAA',
  caption: '',
  takenAt: '2026-02-14T08:00:00.000Z',
}

describe('fileToDataUrl', () => {
  it('encode File menjadi dataUrl base64', async () => {
    const url = await fileToDataUrl(jpg('a.jpg', 10))
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})

describe('prepareFotos', () => {
  it('tambah foto valid dengan id dan takenAt', async () => {
    const { added, skipped } = await prepareFotos([], [jpg('a.jpg', 100)])
    expect(skipped).toBe(0)
    expect(added).toHaveLength(1)
    expect(
      (added[0]?.dataUrl ?? '').startsWith('data:image/jpeg;base64,'),
    ).toBe(true)
    expect(added[0]?.name).toBe('a.jpg')
  })

  it('lewati bukan-gambar dan file >2MB', async () => {
    const txt = new File(['halo'], 'a.txt', { type: 'text/plain' })
    const big = jpg('big.jpg', 2 * 1024 * 1024 + 1)
    const { added, skipped } = await prepareFotos([], [txt, big])
    expect(added).toHaveLength(0)
    expect(skipped).toBe(2)
  })

  it('hormati batas maks 6 foto termasuk yang sudah ada', async () => {
    const existing = Array.from({ length: MAX_FOTO }, (_, i) => ({
      ...existingFoto,
      id: `f${i}`,
    }))
    const { added, skipped } = await prepareFotos(existing, [
      jpg('baru.jpg', 100),
    ])
    expect(added).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('lewati saat total byte melebihi budget', async () => {
    const base64MelewatiBudget = Math.ceil((MAX_TOTAL_BYTES + 1) * (4 / 3))
    const huge: KunjunganRumahFoto = {
      ...existingFoto,
      dataUrl: `data:image/jpeg;base64,${'A'.repeat(base64MelewatiBudget)}`,
    }
    const { added, skipped } = await prepareFotos(
      [huge],
      [jpg('baru.jpg', 100)],
    )
    expect(added).toHaveLength(0)
    expect(skipped).toBe(1)
  })
})

describe('fileToDataUrl tanpa global Buffer (cabang browser)', () => {
  // Node punya global `Buffer`, browser tidak. Test lain di file ini berjalan
  // di Node, jadi semuanya memakai cabang `Buffer` dan TIDAK PERNAH menyentuh
  // kode yang dipakai cadre di browser. Stub di bawah memaksa cabang `btoa`
  // yang kalau itu tempat bug spread argumen dulu muncul.
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tidak melempar RangeError untuk file jauh di atas batas argumen fungsi', async () => {
    vi.stubGlobal('Buffer', undefined)
    // 1 MB: 1.048.576 argumen pada `String.fromCharCode(...)` langsung, jauh
    // di atas batas V8 (~124 ribu) yang dulu membuat upload gagal.
    const besar = jpg('besar.jpg', 1024 * 1024)
    const url = await fileToDataUrl(besar)
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('hasil base64 sama dengan yang dihasilkan cabang Buffer', async () => {
    const file = jpg('sama.jpg', 300 * 1024)
    const viaBuffer = await fileToDataUrl(file)
    vi.stubGlobal('Buffer', undefined)
    const viaBtoa = await fileToDataUrl(file)
    expect(viaBtoa).toBe(viaBuffer)
  })

  it('menangani file yang ukurannya bukan kelipatan potongannya', async () => {
    vi.stubGlobal('Buffer', undefined)
    // 32768 * 2 + 7: memastikan potongan terakhir yang tidak penuh ikut
    // terambil dan tidak ada byte yang terpotong. Dicek lewat round-trip, bukan
    // lewat panjang base64 — padding membuat panjang base64 bukan kelipatan
    // jumlah byte.
    const ukuran = 32768 * 2 + 7
    const isi = new Uint8Array(ukuran).map((_, i) => i % 256)
    const file = new File([isi], 'aneh.jpg', { type: 'image/jpeg' })

    const url = await fileToDataUrl(file)
    const b64 = url.slice(url.indexOf(',') + 1)
    // Decode pakai `atob`, bukan `Buffer`: global `Buffer` sengaja di-stub
    // jadi undefined di test ini, dan `atob` ada di Node maupun browser —
    // sama persis jalur yang dipakai kode produksi.
    const bin = atob(b64)
    const kembali = Uint8Array.from(bin, (c) => c.charCodeAt(0))

    expect(kembali.byteLength).toBe(ukuran)
    expect(Array.from(kembali)).toEqual(Array.from(isi))
  })
})

describe('prepareFotos tahan terhadap file yang gagal diproses', () => {
  it('file yang gagal tidak menggagalkan file lain dalam batch yang sama', async () => {
    // Barthas ini reproduces bug aslinya: tanpa try/catch, RangeError pada file
    // kedua membuat seluruh promise menolak dan foto pertama ikut hilang.
    const rusak = {
      arrayBuffer: async () => {
        throw new RangeError('too many function arguments')
      },
      type: 'image/jpeg',
      name: 'rusak.jpg',
      size: 100,
    } as unknown as File

    const { added, skipped } = await prepareFotos(
      [],
      [jpg('baik.jpg', 100), rusak],
    )
    expect(added).toHaveLength(1)
    expect(added[0]?.name).toBe('baik.jpg')
    expect(skipped).toBe(1)
  })

  it('semua file gagal tidak melempar, hanya melaporkan skipped', async () => {
    const rusak = {
      arrayBuffer: async () => {
        throw new Error('gagal baca')
      },
      type: 'image/jpeg',
      name: 'rusak.jpg',
      size: 100,
    } as unknown as File

    const { added, skipped } = await prepareFotos([], [rusak])
    expect(added).toHaveLength(0)
    expect(skipped).toBe(1)
  })
})
