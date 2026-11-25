import { describe, expect, it } from 'vitest'
import { MAX_FOTO } from '@/lib/constants'
import {
  daftarFotoJawaban,
  fotoJawabanUntukSimpan,
  nilaiFotoUntukDb,
  tambahFotoJawaban,
} from './foto-jawaban'

function jpg(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
}

describe('daftarFotoJawaban', () => {
  it('membaca foto sah dan membuang yang tidak dikenal', () => {
    expect(
      daftarFotoJawaban([
        { name: 'a.jpg', dataUrl: 'data:image/jpeg;base64,AAA' },
        { name: 'b.jpg', path: 'form/b.jpg', url: 'https://x.test/b' },
        { name: 'kosong' },
        42,
        null,
      ]),
    ).toEqual([
      { name: 'a.jpg', dataUrl: 'data:image/jpeg;base64,AAA' },
      { name: 'b.jpg', path: 'form/b.jpg', url: 'https://x.test/b' },
    ])
  })

  it('nilai bukan array jadi kosong', () => {
    expect(daftarFotoJawaban('form/a.jpg')).toEqual([])
  })

  it('membatasi jumlah foto sesuai kuota', () => {
    const semua = Array.from({ length: MAX_FOTO + 3 }, (_, i) => ({
      name: `${i}.jpg`,
      path: `form/${i}.jpg`,
    }))
    expect(daftarFotoJawaban(semua)).toHaveLength(MAX_FOTO)
  })
})

describe('tambahFotoJawaban', () => {
  it('menambah foto valid sebagai dataUrl', async () => {
    const { fotos, skipped } = await tambahFotoJawaban([], [jpg('a.jpg', 100)])
    expect(skipped).toBe(0)
    expect(fotos).toHaveLength(1)
    expect(fotos[0]?.name).toBe('a.jpg')
    expect(fotos[0]?.dataUrl?.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('memotong nama file yang melebihi batas server', async () => {
    const { fotos } = await tambahFotoJawaban(
      [],
      [jpg(`${'a'.repeat(210)}.jpg`, 100)],
    )
    expect(fotos[0]?.name).toHaveLength(200)
  })

  it('melewati berkas bukan gambar dan file terlalu besar', async () => {
    const txt = new File(['halo'], 'a.txt', { type: 'text/plain' })
    const besar = jpg('besar.jpg', 2 * 1024 * 1024 + 1)
    const { fotos, skipped } = await tambahFotoJawaban([], [txt, besar])
    expect(fotos).toHaveLength(0)
    expect(skipped).toBe(2)
  })

  it('hormati kuota termasuk foto yang sudah ada', async () => {
    const existing = Array.from({ length: MAX_FOTO }, (_, i) => ({
      name: `${i}.jpg`,
      path: `form/${i}.jpg`,
    }))
    const { fotos, skipped } = await tambahFotoJawaban(existing, [
      jpg('baru.jpg', 100),
    ])
    expect(fotos).toHaveLength(MAX_FOTO)
    expect(skipped).toBe(1)
  })
})

describe('bentuk untuk server', () => {
  it('hanya menyimpan name dan path', () => {
    expect(
      nilaiFotoUntukDb([
        {
          name: 'a.jpg',
          path: 'form/a.jpg',
          dataUrl: 'data:image/jpeg;base64,AAA',
          url: 'https://x.test/a.jpg',
        },
      ]),
    ).toEqual([{ name: 'a.jpg', path: 'form/a.jpg' }])
  })

  it('foto yang belum diunggah tidak ikut', () => {
    expect(
      fotoJawabanUntukSimpan({
        name: 'a.jpg',
        dataUrl: 'data:image/jpeg;base64,AAA',
      }),
    ).toBeNull()
  })
})
